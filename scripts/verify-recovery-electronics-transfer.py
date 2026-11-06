"""Check transferred library macros, native surfaces and the supplied current source.

Prepare with scripts/prepare-recovery-electronics-transfer.ts; execute with a
FreeCAD-enabled Python. All files written by this verifier stay under test-results.
"""
from pathlib import Path
import base64
import hashlib
import json
import os
import sys
import tempfile
import zlib

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
from freecad_tree import component_leaves

case_file = Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/recovery-electronics-transfer/cases.json')
output = Path(sys.argv[2] if len(sys.argv)>2 else 'test-results/recovery-electronics-transfer/native-report.json')
data = json.loads(case_file.read_text())
source_root = Path(data['usbEvidence']['sourceProject'])
source_world = source_root/'revisions/2026-10-11_M5/assembly_current/current_world'
report = {'freecad':'.'.join(App.Version()[:3]),'cases':[],
          'scope':'Native geometry and source-transfer checks; not physical fit or production qualification.'}

def source_shape(index):
    path=source_world/('world_%d.brep'%index)
    shape=Part.Shape();shape.read(str(path))
    return shape,hashlib.sha256(path.read_bytes()).hexdigest()

def box_values(shape):
    b=shape.optimalBoundingBox(False,False)
    return [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]

def difference(a,b):
    return a.cut(b).Volume+b.cut(a).Volume

def center(shape):
    weighted=App.Vector()
    for solid in shape.Solids:weighted+=solid.CenterOfMass*solid.Volume
    return weighted/sum(solid.Volume for solid in shape.Solids)

with tempfile.TemporaryDirectory(prefix='protolab-source-electronics-') as temporary:
    for case in data['cases']:
        row={'name':case['name'],'passed':False,'scriptSha256':hashlib.sha256(case['script'].encode()).hexdigest()}
        doc=App.newDocument('TransferredElectronics')
        try:
            exec(case['script'],{})
            root=doc.RootObjects[0]
            assert root.PartId==case['id'] and root.ModelState==case['state']
            assert json.loads(root.Configuration)==case['parameters']
            children=component_leaves(root)
            assert len(children)==len(case['components'])
            errors=[];volume_errors=[];surfaces={};faces=0
            for child,expected in zip(children,case['components']):
                shape=child.Shape
                assert not shape.isNull() and shape.isValid() and shape.isClosed()
                assert shape.Solids and all(s.isValid() and s.isClosed() and s.Volume>0 for s in shape.Solids)
                delta=max(abs(a-b) for a,b in zip(box_values(shape),expected['min']+expected['max']))
                errors.append(delta);assert delta<.003,(child.Label,'preview bounds',delta)
                relative=abs(shape.Volume-expected['volume'])/shape.Volume
                volume_errors.append(relative);assert relative<.005,(child.Label,'preview volume',relative)
                faces+=len(shape.Faces)
                for face in shape.Faces:
                    name=type(face.Surface).__name__;surfaces[name]=surfaces.get(name,0)+1
                    assert name in ['Plane','Cylinder'],(child.Label,name)
            intersections=[]
            for i,first in enumerate(children):
                for second in children[i+1:]:
                    if not first.Shape.BoundBox.intersect(second.Shape.BoundBox):continue
                    overlap=first.Shape.common(second.Shape).Volume
                    if overlap>1e-6:intersections.append({'first':first.Label,'second':second.Label,'volume':overlap})
            assert not intersections,intersections
            comparisons=[]
            if case['state']=='assembled' and case['id']=='usb-wireless-extender':
                retained=data['usbEvidence']['retainedNativeBrep']
                original=zlib.decompress(base64.b64decode(retained['data']))
                assert hashlib.sha256(original).hexdigest()==retained['sha256']
                retained_file=Path(temporary)/'retained.brep';retained_file.write_bytes(original)
                reference=Part.Shape();reference.read(str(retained_file))
                frame=data['usbEvidence']['sourceFrame']
                reference.translate(-App.Vector(*frame['worldTranslation']))
                reference.rotate(App.Vector(),App.Vector(0,0,1),-frame['worldRotationDeg'][2])
                actual=Part.makeCompound([child.Shape for child in children])
                residual=difference(actual,reference)
                assert residual<1e-5,('USB source mismatch',residual)
                comparisons.append({'sourceId':326,'symmetricDifferenceMm3':residual,'sourceSha256':retained['sha256']})
            elif case['state']=='assembled':
                for child,index,library_id in zip(children,case['sourceIds'],case['sourceLibraryIds']):
                    reference,sha=source_shape(index)
                    reference.translate(App.Vector(0,0,-data['sourceWorldLowerUndersideZ']))
                    residual=difference(child.Shape,reference)
                    limit=.074546 if index==233 else 1e-5
                    assert residual<limit,(index,'source mismatch',residual,limit)
                    comparisons.append({'sourceId':index,'libraryId':library_id,
                        'sourceSha256':sha,'symmetricDifferenceMm3':residual,
                        'comparisonScope':'Documented analytic rounded-corner correction from faceted source' if index==233 else 'Exact source-native geometry, rigidly placed'})
            before=[center(child.Shape) for child in children]
            saved=App.Placement(children[0].Placement);delta=App.Vector(3,-4,5)
            children[0].Placement.Base+=delta;doc.recompute()
            assert (center(children[0].Shape)-before[0]-delta).Length<1e-6
            assert all((center(child.Shape)-old).Length<1e-6 for child,old in zip(children[1:],before[1:]))
            children[0].Placement=saved;doc.recompute()
            count=sum(len(child.Shape.Solids) for child in children)
            volume=sum(child.Shape.Volume for child in children)
            step=Path(temporary)/'transferred.step';Part.export(children,str(step))
            restored=Part.Shape();restored.read(str(step))
            assert restored.isValid() and len(restored.Solids)==count
            assert abs(restored.Volume-volume)<max(.001,volume*1e-6)
            name=root.Name;labels=[child.Label for child in children]
            fcstd=Path(temporary)/'transferred.FCStd';doc.saveAs(str(fcstd));App.closeDocument(doc.Name)
            doc=App.openDocument(str(fcstd));root=doc.getObject(name)
            reopened=component_leaves(root)
            assert [child.Label for child in reopened]==labels
            assert all(child.Shape.isValid() and child.Shape.isClosed() for child in reopened)
            row.update(passed=True,objects=len(children),solids=count,faces=faces,surfaces=surfaces,
                       maxPreviewBoundsDifferenceMm=max(errors),maxRelativePreviewVolumeDifference=max(volume_errors),
                       intersections=intersections,sourceComparisons=comparisons,
                       independentMovement=True,stepRoundtrip=True,fcstdRoundtrip=True)
        except Exception as error:row['error']=str(error)
        finally:
            if doc and doc.Name in App.listDocuments():App.closeDocument(doc.Name)
        report['cases'].append(row)
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(report,indent=2))
        print(json.dumps({key:row[key] for key in ['name','passed','error'] if key in row}),flush=True)
report['passed']=sum(row['passed'] for row in report['cases'])
report['failed']=len(report['cases'])-report['passed']
output.write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'output':str(output)}))
sys.exit(bool(report['failed']))
