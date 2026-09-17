"""Verify all FAULHABER native solids, preview agreement and STEP/FCStd round trips.

Prepare: node --import tsx scripts/verify-faulhaber.ts
Run with FreeCAD Python: scripts/verify-faulhaber.py [cases.json] [report.json]

OCC recalculates volume integrals after STEP spline reparameterization. BX4
volume changes by up to 1.55e-5 while surface samples agree within 1e-10 mm.
Use a 2e-5 integral tolerance, with independent topology, vertex and surface
checks at 1e-6 mm to prevent the tolerance masking changed geometry.
Planetary gearheads reach 2.17e-5 integral error (26/1R), while vertices and
surface samples agree within 1e-11 mm; allow 3e-5 for that family only.
"""
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

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-faulhaber-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-faulhaber-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}

def check_shape(shape):
    assert not shape.isNull() and shape.isValid(), 'Invalid shape'
    assert len(shape.Solids) == 1 and shape.Volume > 0, 'Expected one positive solid per physical component'
    assert shape.isClosed(), 'Open component shell'

with tempfile.TemporaryDirectory(prefix='protolab-faulhaber-') as directory:
    for case in cases:
        record = {'name': case['name'], 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('ElectronicsAudit')
        try:
            sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
            exec(case['script'], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name), 'The macro must preserve existing document objects'
            root = roots[0]
            assert root.PartId == case['id'] and root.ModelState == case['state']
            assert json.loads(root.Configuration) == case['parameters']
            children = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(children) == len(case['components']), 'Preview/CAD component count mismatch'
            bound_errors, volume_errors = [], []
            for child, expected in zip(children, case['components']):
                check_shape(child.Shape)
                b = child.Shape.optimalBoundingBox(False, False)
                for actual, wanted in zip([b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax], expected['min'] + expected['max']):
                    bound_errors.append(abs(actual - wanted))
                    assert abs(actual - wanted) < 0.05, (child.Label, actual, wanted)
                error = abs(child.Shape.Volume - expected['volume']) / child.Shape.Volume
                volume_errors.append(error)
                assert error < 0.015, (child.Label, 'Preview/CAD volume mismatch', error)
            intersections = []
            for i, first in enumerate(children):
                for second in children[i + 1:]:
                    if not first.Shape.BoundBox.intersect(second.Shape.BoundBox):
                        continue
                    common = first.Shape.common(second.Shape)
                    overlap = 0 if common.isNull() else common.Volume
                    if overlap > max(1e-6, min(first.Shape.Volume, second.Shape.Volume) * 1e-6):
                        intersections.append({'first': first.Label, 'second': second.Label, 'volume': overlap})
            assert not intersections, ('Physical components intersect', intersections)
            if len(children) > 1:
                before = [App.Vector(child.Shape.Solids[0].CenterOfMass) for child in children]
                saved = App.Placement(children[0].Placement)
                delta = App.Vector(3, -4, 5)
                children[0].Placement.Base += delta
                doc.recompute()
                assert (children[0].Shape.Solids[0].CenterOfMass - before[0] - delta).Length < 1e-6
                for child, old in zip(children[1:], before[1:]):
                    assert (child.Shape.Solids[0].CenterOfMass - old).Length < 1e-6
                children[0].Placement = saved
                doc.recompute()
            step = str(Path(directory) / 'faulhaber.step')
            volume = sum(child.Shape.Volume for child in children)
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            assert restored.isValid() and len(restored.Solids) == len(children), 'STEP component mismatch'
            integral_tolerance = 3e-5 if case['id'] == 'faulhaber-planetary' else 2e-5
            assert abs(restored.Volume - volume) < max(0.001, volume * integral_tolerance), 'STEP changed volume'
            if case['id'] in ('faulhaber-am', 'faulhaber-bx4'):
                assert len(children) == 1, 'Supplier motor must remain one installation solid'
            original = Part.makeCompound([child.Shape for child in children]) if len(children) > 1 else children[0].Shape
            assert len(original.Faces) == len(restored.Faces), 'STEP changed face topology'
            points = [v.Point for v in restored.Vertexes]
            vertex_error = max(min((v.Point - p).Length for p in points) for v in original.Vertexes)
            assert vertex_error < 1e-6, ('STEP changed vertices', vertex_error)
            surface_errors = []
            for face in original.Faces:
                u0, u1, v0, v1 = face.ParameterRange
                samples = [.25, .5, .75] if case['id'] in ('faulhaber-am', 'faulhaber-bx4', 'faulhaber-planetary') else [.5]
                for u in samples:
                    for v in samples:
                        point = face.valueAt(u0 + (u1-u0)*u, v0 + (v1-v0)*v)
                        if face.isInside(point, 1e-6, True):
                            surface_errors.append(Part.Vertex(point).distToShape(restored)[0])
            assert surface_errors and max(surface_errors) < 1e-6, 'STEP changed surfaces'
            record.update(stepVertexError=vertex_error, stepSurfaceError=max(surface_errors),
                          stepRelativeVolumeError=abs(restored.Volume-volume)/volume)
            name, labels = root.Name, [child.Label for child in children]
            fcstd = str(Path(directory) / 'faulhaber.FCStd')
            doc.saveAs(fcstd)
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd)
            root = doc.getObject(name)
            reopened = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert [child.Label for child in reopened] == labels, 'FCStd component mismatch'
            for child in reopened:
                check_shape(child.Shape)
            record.update(passed=True, components=len(reopened), maxBoundsError=max(bound_errors),
                          maxRelativeVolumeError=max(volume_errors), intersections=intersections,
                          independentMovement=len(reopened) > 1, stepRoundtrip=True, fcstdRoundtrip=True)
        except Exception as error:
            record['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        report['cases'].append(record)
        report.update(passed=sum(row['passed'] for row in report['cases']),
                      failed=sum(not row['passed'] for row in report['cases']),
                      elapsedSeconds=time.perf_counter() - started)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))
        print(json.dumps(record), flush=True)
print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'output': str(output)}), flush=True)
sys.exit(bool(report['failed']))
