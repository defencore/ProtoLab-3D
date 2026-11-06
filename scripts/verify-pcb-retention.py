"""Execute PCB retention production macros and independent native motion witnesses."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

root = Path(__file__).resolve().parents[1]
output = root / 'test-results/pcb-retention'
manifest = json.loads((output / 'native-cases.json').read_text())
for file, expected in manifest['sourceHashes'].items():
    assert hashlib.sha256((root/file).read_bytes()).hexdigest() == expected, 'Stale native input: '+file
spec = importlib.util.spec_from_file_location('retention_checks', root/'scripts/field-daq-retention-checks.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
report = {'freecad':App.Version(), 'cases':[]}

def evaluate(source):
    scope = {'App':App, 'Part':Part, 'math':math}
    exec(source, scope)
    return scope

def inspect(shape):
    assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0
    surfaces={}
    for face in shape.Faces:
        name=type(face.Surface).__name__
        surfaces[name]=surfaces.get(name,0)+1
    return {'faces':len(shape.Faces), 'volumeMm3':shape.Volume, 'surfaces':surfaces}

def equivalence(a,b):
    assert a.isValid() and b.isValid() and len(a.Solids)==len(b.Solids)
    forward, reverse = a.cut(b).Volume, b.cut(a).Volume
    assert max(forward,reverse)<1e-5,(forward,reverse)
    return {'removedMm3':forward,'addedMm3':reverse}

def moved(shape,x=0,y=0,z=0):
    result=shape.copy()
    result.translate(App.Vector(x,y,z))
    return result

def clear(a,b,label):
    volume=a.common(b).Volume
    assert volume<1e-5,(label,volume)
    return volume

def blocked(a,b,label):
    volume=a.common(b).Volume
    assert volume>.005,(label,volume)
    return volume

def macro_audit(macro,part_id,filename,count):
    doc=App.newDocument('PcbRetentionMacro')
    try:
        evaluate(macro['code'])
        objects=[obj for obj in doc.Objects if obj.TypeId=='Part::Feature']
        assert len(objects)==count,(len(objects),count)
        for obj in objects: inspect(obj.Shape)
        solid=Part.makeCompound([obj.Shape for obj in objects])
        parent=next(obj for obj in doc.Objects if hasattr(obj,'PartId'))
        identity_keys=['LibraryId','LibraryEntryId','PresetId','ConfigurationKey','Configuration','ModelState']
        identity={key:getattr(parent,key) for key in identity_keys}
        assert parent.LibraryId==part_id and parent.ModelState==macro['state']
        if macro['state']=='print':
            for obj in objects:
                assert abs(obj.Shape.optimalBoundingBox(False,False).ZMin)<1e-6
            for i,obj in enumerate(objects):
                for other in objects[i+1:]:
                    assert obj.Shape.distToShape(other.Shape)[0]>=7.99
        solid.exportStep(str(filename)+'.step')
        data={'state':macro['state'],'components':count,'stepEquivalence':equivalence(solid,Part.read(str(filename)+'.step'))}
        doc.saveAs(str(filename)+'.FCStd')
        App.closeDocument(doc.Name)
        doc=App.openDocument(str(filename)+'.FCStd')
        reopened=[obj for obj in doc.Objects if obj.TypeId=='Part::Feature']
        parent=next(obj for obj in doc.Objects if hasattr(obj,'PartId'))
        assert {key:getattr(parent,key) for key in identity_keys}==identity
        data['fcstdEquivalence']=equivalence(solid,Part.makeCompound([obj.Shape for obj in reopened]))
        return data
    finally:
        App.closeDocument(doc.Name)

for case_index,case in enumerate(manifest['cases']):
    row={'name':case['name'],'passed':False}
    try:
        if case['kind']=='field-daq':
            scope=evaluate(case['code'])
            by_id=dict(zip(case['ids'],scope['components']))
            row['physical']=[{'id':key,**inspect(by_id[key])} for key in case['physicalIds']]
            row['retentionChecks']=checks.verify_retention(case,by_id,evaluate)
            row['macros']=[]
            for macro_index,macro in enumerate(case['macros']):
                filename=output/('field-'+str(case_index)+'-'+macro['state'])
                row['macros'].append(macro_audit(macro,'field-daq-enclosure',filename,1))
            if case['parameters']['boardThickness']==1.6 and case['parameters']['fitClearance']==0.25:
                snapshot=json.loads(Path(manifest['prioritySnapshot']).read_text())
                before=evaluate(snapshot['code'])
                after=evaluate(case['physicalCode'])
                assert [r['id'] for r in snapshot['components']]==case['physicalIds']
                row['unchangedComponents']=[]
                for index,(name,a,b) in enumerate(zip(case['physicalIds'],before['components'],after['components'])):
                    if name=='base':
                        removed,added=a.cut(b),b.cut(a)
                        regions=[]
                        d=case['layout']
                        for board in d['boards']:
                            x=min(board['innerX'],board['innerX']-board['direction']*10.5)
                            for side in [-1,1]:
                                y=side*board['width']/2
                                y0=y-10.5 if side>0 else y-6
                                regions.append(Part.makeBox(10.5,16.5,d['boardZ']+d['boardThickness']+d['clearance']+2-d['baseTop']+.1,
                                                           App.Vector(x,y0,d['baseTop']-.1)))
                        allowed=Part.makeCompound(regions)
                        assert removed.cut(allowed).Volume<1e-5 and added.cut(allowed).Volume<1e-5,'Base changed outside the four pocket envelopes'
                        assert added.Volume>removed.Volume>0,'Pocket redesign must replace the old fin with a broader body'
                        old_meta,new_meta=before['component_metadata'][index],after['component_metadata'][index]
                        assert old_meta['LibraryId']==new_meta['LibraryId'] and old_meta['Supply']==new_meta['Supply']
                        row['intentionalPocketRedesign']={'id':name,'beforeFaces':len(a.Faces),'afterFaces':len(b.Faces),
                            'beforeVolumeMm3':a.Volume,'afterVolumeMm3':b.Volume,'removedMm3':removed.Volume,'addedMm3':added.Volume,
                            'changesConfinedToPocketEnvelopes':True,'libraryIdentityRetained':True}
                    else:
                        row['unchangedComponents'].append({'id':name,'beforeFaces':len(a.Faces),'afterFaces':len(b.Faces),**equivalence(a,b)})
                        assert before['component_metadata'][index]==after['component_metadata'][index],name+': unchanged physical identity'
        elif case['kind']=='mount':
            scope=evaluate(case['code'])
            by_id=dict(zip(case['ids'],scope['components']))
            carrier=by_id['carrier']
            d=case['layout']; p=case['parameters']
            boards=[by_id['reference-'+b['id']] for b in d['boards']]
            keys=[by_id[name] for name in case['physicalIds'] if name!='carrier']
            row['physical']=[{'id':name,**inspect(by_id[name])} for name in case['physicalIds']]
            physical=[by_id[name] for name in case['physicalIds']]
            for i,a in enumerate(physical):
                for b in physical[i+1:]:clear(a,b,'Installed physical parts')
            for board in boards:
                for part in physical:clear(board,part,'Bare substrate fit')
            row['keyMotion']=[]
            if d['lock']:
                released=evaluate(case['releasedCode'])['components']
                obstacles=Part.makeCompound([carrier,*boards])
                for i,(key,release) in enumerate(zip(keys,released)):
                    blocked(moved(key,z=.1),carrier,'Bayonet upward capture')
                    blocked(moved(key,y=-.3),carrier,'Unloaded latch reverse stop')
                    clear(release,obstacles,'Prescribed released leaf')
                    for step in range(13):
                        clear(moved(release,y=-3*step/12),obstacles,'Released key slide')
                    for step in range(31):
                        clear(moved(release,y=-3,z=step*.5),obstacles,'Released key lift')
                    row['keyMotion'].append({'key':i+1,'slideSamples':13,'liftSamples':31,'upwardCapture':True,'reverseStop':True})
            row['boardService']=[]
            row['pocketRoots']=[]
            for i,(info,board) in enumerate(zip(d['boards'],boards)):
                peer_boards=[other for j,other in enumerate(boards) if j!=i]
                obstacles=Part.makeCompound([carrier,*peer_boards])
                dx=0 if not d['lock'] or (0<i<len(boards)-1) else (9.5 if i==0 else -9.5)
                for step in range(20):
                    clear(moved(board,x=dx*step/19),obstacles,'PCB withdrawal after key removal')
                for step in range(25):
                    clear(moved(board,x=dx,z=step*.5),obstacles,'PCB vertical service')
                row['boardService'].append({'board':info['id'],'withdrawalMm':dx,'slideSamples':20,'liftSamples':25})
                for side in [-1,1]:
                    for edge_x in [info['x'],info['x']+info['length']-3]:
                        edge_y=-info['width']/2 if side<0 else info['width']/2-3
                        witness=Part.makeBox(3,3,info['thickness'],App.Vector(edge_x,edge_y,info['seatZ']))
                        clear(witness,carrier,'Nominal corner witness')
                        blocked(moved(witness,y=side*(d['c']+.2)),carrier,'Local corner Y restraint')
                        left=edge_x==info['x']
                        roof=d['lock'] and (info['index']==1 if left else d['count']>1 and info['index']==d['count'])
                        if not roof:
                            row['pocketRoots'].append({'board':info['id'],'side':side,'left':left,
                                **checks.verify_open_pocket(carrier,info['x'] if left else info['x']+info['length'],
                                                           side*info['width']/2,1 if left else -1,side,d['seatZ'],d['baseZ'])})
            row['supportContacts']=[]
            row['lockLandContacts']=[]
            for bridge_index,s in enumerate(d['specs']):
                left=s['centerX']-s['gap']/2
                right=s['centerX']+s['gap']/2
                for board in d['boards']:
                    x=None
                    if abs(board['x']+board['length']-left)<1e-6:x=left-2
                    if abs(board['x']-right)<1e-6:x=right+2
                    if x is not None:
                        for cy in s['stationCentres']:
                            probe=Part.makeBox(1,1,.05,App.Vector(x-.5,cy-2,d['seatZ']-.05))
                            assert probe.cut(carrier).Volume<1e-6,'Missing mandatory lower lock land'
                            row['lockLandContacts'].append({'bridge':bridge_index+1,'board':board['id'],'stationY':cy-1.5})
            for board in d['boards']:
                contact_points=[]
                if d['mode'] in ['side','both']:
                    contact_points += [(board['x']+board['length']/2,side*(board['width']/2-2.5)) for side in [-1,1]]
                if d['mode'] in ['under','both']:
                    spans=max(1,math.ceil((board['length']-16)/p['supportPitch']))
                    contact_points += [(board['x']+8+(board['length']-16)*i/spans,0) for i in range(spans+1)]
                for x,y in contact_points:
                    probe=Part.makeBox(1,1,.05,App.Vector(x-.5,y-.5,d['seatZ']-.05))
                    assert probe.cut(carrier).Volume<1e-6,'Missing anti-flex support contact'
                row['supportContacts'].append({'board':board['id'],'checkedContactPoints':len(contact_points)})
            row['macros']=[]
            for macro in case['macros']:
                filename=output/('mount-'+str(case_index)+'-'+macro['state'])
                row['macros'].append(macro_audit(macro,'pcb-retention-mount',filename,len(physical)))
        else:
            raise ValueError('Unsupported retention verification case')
        row['passed']=True
    except Exception:
        row['error']=traceback.format_exc()
    report['cases'].append(row)
    report['passed']=sum(item['passed'] for item in report['cases'])
    report['failed']=sum(not item['passed'] for item in report['cases'])
    (output/'native-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'report':str(output/'native-report.json')}))
sys.exit(bool(report['failed']))
