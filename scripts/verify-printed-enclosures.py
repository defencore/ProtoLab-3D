"""Audit production native macros, mating paths, analytic topology and STEP/FCStd.

Prepare input with verify-printed-enclosures.ts; use a FreeCAD-enabled Python.
"""
import json
import math
import os
from pathlib import Path
import sys
import traceback

sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

output=Path('test-results/printed-enclosures').resolve()
cases=json.loads((output/'cases.json').read_text())
report={'freecad':App.Version(),'cases':[]}

def inspect(shape):
    assert shape.isValid() and shape.isClosed() and shape.Volume>0
    assert len(shape.Solids)==1,'Each physical component must be a single solid'
    surfaces={}
    for face in shape.Faces:
        name=type(face.Surface).__name__
        surfaces[name]=surfaces.get(name,0)+1
    assert len(shape.Faces)<1000,'Investigate native topology growth'
    return {'volume':shape.Volume,'faces':len(shape.Faces),'surfaces':surfaces}

def clear(a,b,message):
    intersection=a.common(b).Volume
    assert intersection<1e-6,(message,intersection)

def roundtrip(original,restored,count,helical=False):
    assert restored.isValid() and restored.isClosed() and len(restored.Solids)==count
    drift=abs(original.Volume-restored.Volume)
    metrics={'relativeVolumeIntegrationDrift':drift/original.Volume}
    if drift>=max(1e-5,original.Volume*1e-8):
        # STEP refits spline parameterizations; equivalent helices can integrate
        # slightly differently. Accept only after independent solid equivalence.
        assert helical and drift<original.Volume*1e-6
        differences=[]
        for before,after in zip(original.Solids,restored.Solids):
            forward,reverse=before.cut(after).Volume,after.cut(before).Volume
            assert max(forward,reverse)<max(1e-6,before.Volume*1e-9)
            differences.append({'forwardMm3':forward,'reverseMm3':reverse})
        metrics['bidirectionalSolidDifferences']=differences
    a,b=original.optimalBoundingBox(False,False),restored.optimalBoundingBox(False,False)
    assert max(abs(getattr(a,key)-getattr(b,key)) for key in ['XMin','YMin','ZMin','XMax','YMax','ZMax'])<1e-5
    return metrics

def translated(shape,vector):
    result=shape.copy()
    result.translate(App.Vector(*vector))
    return result

for index,case in enumerate(cases):
    row={'name':case['name'],'passed':False}
    doc=None
    try:
        doc=App.newDocument('PrintedEnclosureAudit')
        exec(case['script'],{})
        features=[obj for obj in doc.Objects if obj.TypeId=='Part::Feature']
        assert len(features)==case['expectedComponents'],(len(features),case['expectedComponents'])
        shapes=[obj.Shape for obj in features]
        row['components']=[inspect(s) for s in shapes]
        for i,a in enumerate(shapes):
            for j,b in enumerate(shapes[i+1:],i+1): clear(a,b,f'Unexpected component interference: {i} {features[i].Label} / {j} {features[j].Label}')
        whole=Part.makeCompound(shapes)
        bounds=whole.optimalBoundingBox(False,False)
        row['nativeDimensions']=[bounds.XLength,bounds.YLength,bounds.ZLength]
        assert max(abs(a-b) for a,b in zip(row['nativeDimensions'],case['dimensions']))<0.04,(row['nativeDimensions'],case['dimensions'])
        if case['state']=='print':
            assert all(abs(s.optimalBoundingBox(False,False).ZMin)<1e-6 for s in shapes),'Print parts must lie on Z=0'
            assert len(shapes)==2
            assert shapes[0].distToShape(shapes[1])[0]>7.99
        if case['partId']=='printed-threaded-enclosure':
            assert len(case['meshVolumes'])==2
            row['meshNativeVolumeErrors']=[]
            for shape,mesh in zip(shapes,case['meshVolumes']):
                error=abs(mesh-shape.Volume)/shape.Volume
                row['meshNativeVolumeErrors'].append(error)
                assert error<0.015,('Helical mesh/native volume mismatch',error)
            assert any(key not in ['Plane','Cylinder','Cone'] for c in row['components'] for key in c['surfaces']),'Native screw flanks must retain helical surfaces'
        if case['state']=='assembled':
            p=case['parameters']
            if case['partId'] in ['printed-rim-enclosure','printed-self-centering-enclosure']:
                for step in range(41):
                    clear(shapes[0],translated(shapes[1],[0,0,(p['rimDepth']+8)*step/40]),'Blocked axial lid removal')
                row['axialPathSamples']=41
                if case['partId']=='printed-self-centering-enclosure':
                    capture=p['clearance']+p['leadIn']
                    for sx,sy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                        for step in range(21):
                            u=step/20
                            offset=(capture-0.05)*(1-u)
                            clear(shapes[0],translated(shapes[1],[sx*offset,sy*offset,p['rimDepth']-p['leadIn']*u]),'Blocked taper entry guidance envelope')
                    row['taperGuidanceSamples']=168
                    row['taperScope']='Representative friction-free guided translations; no contact force or unique final centering proof'
            elif case['partId']=='printed-bayonet-enclosure':
                turn=p['turnAngle']
                unlocked=shapes[1].copy()
                unlocked.rotate(App.Vector(0,0,0),App.Vector(0,0,1),-turn)
                for step in range(41):
                    clear(shapes[0],translated(unlocked,[0,0,(p['neckHeight']+8)*step/40]),'Blocked bayonet entry')
                for step in range(73):
                    rotating=unlocked.copy()
                    rotating.rotate(App.Vector(0,0,0),App.Vector(0,0,1),turn*step/72)
                    clear(shapes[0],rotating,'Blocked bayonet turn')
                blocked=translated(shapes[1],[0,0,p['axialClearance']+min(p['lugThickness'],p['wall'])/2])
                assert shapes[0].common(blocked).Volume>1e-5,'Locked bayonet must capture axial withdrawal'
                angle_gap=p['tangentialClearance']/(p['diameter']/2-p['wall'])*180/math.pi
                stop=shapes[1].copy()
                stop.rotate(App.Vector(0,0,0),App.Vector(0,0,1),2*angle_gap+1)
                assert shapes[0].common(stop).Volume>1e-5,'Closed channel end must stop overrotation'
                row['bayonetMotion']={'entrySamples':41,'turnSamples':73,'lockedAxialCapture':True,'angularEndStop':True}
                assert row['components'][0]['surfaces'].get('Cylinder',0)>=2
                assert row['components'][1]['surfaces'].get('Cylinder',0)>=3
            elif case['partId']=='printed-threaded-enclosure':
                turns=(p['threadLength']+p['pitch'])/p['pitch']
                for step in range(49):
                    angle=360*turns*step/48
                    moved=shapes[1].copy()
                    moved.rotate(App.Vector(0,0,0),App.Vector(0,0,1),angle)
                    moved.translate(App.Vector(0,0,p['pitch']*angle/360))
                    clear(shapes[0],moved,'Blocked helical cap removal')
                blocked=translated(shapes[1],[0,0,p['pitch']/2])
                assert shapes[0].common(blocked).Volume>1e-5,'Engaged printed screw must block direct axial withdrawal'
                row['threadMotion']={'helicalSamples':49,'axialCapture':True}
            elif case['partId']=='printed-screw-enclosure':
                for step in range(41):
                    clear(shapes[0],translated(shapes[1],[0,0,(p['height']+8)*step/40]),'Lid must lift after hardware removal')
                row['lidRemovalSamples']=41
                centers=[]
                for shape in shapes[3::2]:
                    b=shape.BoundBox
                    centers.append(((b.XMin+b.XMax)/2,(b.YMin+b.YMax)/2))
                for nut,(x,y) in zip(shapes[3::2],centers):
                    for step in range(21):
                        clear(shapes[0],translated(nut,[-x*(1-step/20),0,-p['pocketClearance']/2]),'Blocked captive-nut side insertion')
                    for step in range(11):
                        clear(shapes[0],translated(nut,[0,0,-p['pocketClearance']/2*(1-step/10)]),'Blocked nut seating lift')
                row['nutInsertion']={'nuts':4,'sidePathSamplesPerNut':21,'seatingSamplesPerNut':11}
                assert all(hasattr(obj,'PresetId') and obj.PresetId for obj in features[2:]),'Purchased hardware must retain exact preset identities'
                if p['headStyle']=='countersunk':
                    assert row['components'][1]['surfaces'].get('Cone',0)>=4,'Countersinks must be native conical seats'
        identity_keys=['LibraryId','PresetId','LibraryEntryId','ConfigurationKey','ModelState','Configuration']
        root=next(obj for obj in doc.Objects if hasattr(obj,'PartId'))
        root_identity={key:getattr(root,key) for key in identity_keys}
        assert root.LibraryId==case['partId'] and root.ModelState==case['state']
        child_identity=[(obj.Label,obj.ESKDIdentityJSON) for obj in features]
        filename=output/f'case-{index:03d}'
        whole.exportStep(str(filename)+'.step')
        row['stepEquivalence']=roundtrip(whole,Part.read(str(filename)+'.step'),len(shapes),case['partId']=='printed-threaded-enclosure')
        row['stepRoundtrip']=True
        doc.saveAs(str(filename)+'.FCStd')
        App.closeDocument(doc.Name)
        doc=App.openDocument(str(filename)+'.FCStd')
        features=[obj for obj in doc.Objects if obj.TypeId=='Part::Feature']
        root=next(obj for obj in doc.Objects if hasattr(obj,'PartId'))
        assert {key:getattr(root,key) for key in identity_keys}==root_identity
        assert [(obj.Label,obj.ESKDIdentityJSON) for obj in features]==child_identity
        roundtrip(whole,Part.makeCompound([obj.Shape for obj in features]),len(shapes))
        row['fcstdGeometryIdentityRoundtrip']=True
        row['passed']=True
    except Exception:
        row['error']=traceback.format_exc()
    finally:
        if doc:App.closeDocument(doc.Name)
        report['cases'].append(row)
        report['passed']=sum(item['passed'] for item in report['cases'])
        report['failed']=sum(not item['passed'] for item in report['cases'])
        (output/'native-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'report':str(output/'native-report.json')}))
sys.exit(bool(report['failed']))
