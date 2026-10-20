"""Validate AMASS E/PCB exports: solids, installation patterns and STEP/FCStd."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-xt-panel-cases.json')
OUTPUT = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / 'test-results/xt-panel-native-validation.json')
def bounds(shape):
    b = shape.BoundBox
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]
def valid(shape):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), 'Open or invalid native shape'
    assert len(shape.Solids) == 1 and shape.Volume > 0, ('One closed positive solid per physical component', len(shape.Solids))
def main():
    started = time.perf_counter()
    prepared = json.loads(INPUT.read_text())
    assert len(prepared['cases']) == 28
    for path, expected in prepared['sourceHashes'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == expected, ('Changed source', path)
    report = dict(checkedAt=datetime.now(timezone.utc).isoformat(), freecad='.'.join(App.Version()[:3]), sourceHashes=prepared['sourceHashes'], fixtureSha256=hashlib.sha256(INPUT.read_bytes()).hexdigest(), validatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), scope='Three AMASS E panel and four PCB models, both detail levels, assembled/exploded. Closed native solids, envelope, panel bores or PCB contact/tab positions and projections, preview bounds/volume, no component interference, STEP/FCStd roundtrips for assembled exports. Does not verify contact force, threads or electrical ratings.', cases=[])
    with tempfile.TemporaryDirectory(prefix='protolab-xt-panel-') as temporary:
        for case in prepared['cases']:
            row = dict(name=case['name'], passed=False, scriptSha256=case['scriptSha256'])
            doc = App.newDocument('PanelConnectorAudit')
            try:
                sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
                assert hashlib.sha256(case['script'].encode()).hexdigest() == case['scriptSha256']
                exec(case['script'], {})
                roots = [o for o in doc.RootObjects if o != sentinel]
                assert len(roots) == 1 and doc.getObject(sentinel.Name)
                root = roots[0]
                assert root.PartId == 'electrical-connector' and root.ModelState == case['state']
                assert json.loads(root.Configuration) == case['parameters']
                children = list(root.Group)
                assert len(children) == len(case['components']) == 3 + int(case['model'].get('gasket', False)) + case['model'].get('holdDowns', 0)
                max_bound, max_volume = 0, 0
                for child, expected in zip(children, case['components']):
                    valid(child.Shape)
                    error = max(abs(a-b) for a,b in zip(bounds(child.Shape), expected['bounds']))
                    relative = abs(child.Shape.Volume-expected['volume'])/child.Shape.Volume
                    assert error < .055, (child.Label, 'Preview/native bounds', error)
                    assert relative < .015, (child.Label, 'Preview/native volume', relative)
                    max_bound, max_volume = max(max_bound,error), max(max_volume,relative)
                compound = Part.makeCompound([c.Shape for c in children])
                assert max(abs(a-b) for a,b in zip(bounds(compound), case['bounds'])) < .055
                collisions=[]
                for i,a in enumerate(children):
                    for b in children[i+1:]:
                        common = a.Shape.common(b.Shape)
                        overlap = 0 if common.isNull() else common.Volume
                        if overlap > 1e-6: collisions.append(dict(a=a.Label,b=b.Label,volume=overlap))
                assert not collisions, ('Component intersections', collisions)
                m=case['model']
                if case['state'] == 'assembled':
                    b=compound.BoundBox
                    assert max(abs(a-b) for a,b in zip([b.XLength,b.YLength,b.ZLength],[m['width'],m['height'],m['length']])) < 1e-5
                    if m.get('panel'):
                        assert abs(b.ZMax-m['flangeThickness']) < 1e-5
                        # Probe almost the complete nominal hole, behind and in front of the flange.
                        for x in [-m['mountPitch']/2,m['mountPitch']/2]:
                            probe=Part.makeCylinder(m['mountDiameter']*.49,m['flangeThickness']+2,App.Vector(x,0,-1))
                            assert children[0].Shape.common(probe).Volume < 1e-6, 'Mounting hole is blocked'
                            assert children[0].Shape.isInside(App.Vector(x,m['mountDiameter']/2+.5,m['flangeThickness']/2),1e-5,True), 'Missing flange around hole'
                        row['mountingHolesVerified'] = True
                    else:
                        assert abs(b.ZMax-m['pcbFront']) < 1e-5
                        pcb_plane = 'y' if m['pcb'] == 'right-angle' else 'z'
                        for index, x in enumerate([-m['pitch']/2,m['pitch']/2]):
                            contact = children[index+1].Shape
                            probe = App.Vector(x,-1.5,-m['pcbRowOffset']) if pcb_plane == 'y' else App.Vector(x,0,-1.5)
                            assert contact.isInside(probe,1e-6,True), 'PCB contact misses its published hole centre'
                            minimum = contact.BoundBox.YMin if pcb_plane == 'y' else contact.BoundBox.ZMin
                            assert abs(minimum+m['pinProjection']) < 1e-5, 'Wrong solder-tail projection'
                        if pcb_plane == 'y':
                            assert len(children) == 5 and m['pcbHoldPitch'] == 13.5 and m['pcbRowOffset'] == 6
                            for index,x in enumerate([-m['pcbHoldPitch']/2,m['pcbHoldPitch']/2]):
                                tab = children[index+3].Shape
                                assert tab.isInside(App.Vector(x,-2,0),1e-6,True), 'Hold-down misses PCB slot centre'
                                assert abs(tab.BoundBox.YMin+m['pcbTabProjection']) < 1e-5
                            assert abs(children[0].Shape.BoundBox.YMin) < 1e-5, 'Housing crosses PCB plane'
                        else:
                            assert abs(children[0].Shape.BoundBox.ZMin) < 1e-5, 'Housing crosses PCB plane'
                        row.update(pcbPatternVerified=True,pcbPlane=pcb_plane.upper()+'=0')
                    volume=sum(c.Shape.Volume for c in children)
                    step=Path(temporary)/(m['id']+'-'+case['parameters']['detail']+'.step')
                    Part.export(children,str(step))
                    restored=Part.read(str(step))
                    assert restored.isValid() and restored.isClosed() and len(restored.Solids)==len(children)
                    assert abs(restored.Volume-volume)/volume < 1e-6
                    path=Path(temporary)/(m['id']+'-'+case['parameters']['detail']+'.FCStd')
                    rootname=root.Name
                    doc.saveAs(str(path))
                    App.closeDocument(doc.Name)
                    doc=App.openDocument(str(path))
                    reopened=list(doc.getObject(rootname).Group)
                    assert len(reopened)==len(children)
                    for c in reopened: valid(c.Shape)
                    assert abs(sum(c.Shape.Volume for c in reopened)-volume)/volume < 1e-9
                    row.update(stepRoundtrip=True,fcstdRoundtrip=True)
                row.update(passed=True,solids=len(children),maxBoundsError=max_bound,maxRelativeVolumeError=max_volume,componentInterferences=collisions)
            except Exception as e:
                row['error']=str(e)
            finally:
                if doc and doc.Name in App.listDocuments(): App.closeDocument(doc.Name)
            report['cases'].append(row)
            report.update(passed=sum(r['passed'] for r in report['cases']),failed=sum(not r['passed'] for r in report['cases']),elapsedSeconds=time.perf_counter()-started)
            OUTPUT.parent.mkdir(parents=True,exist_ok=True)
            OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps(row),flush=True)
    return bool(report['failed'])
if __name__=='__main__': sys.exit(main())
