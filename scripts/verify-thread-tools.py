"""Validate thread tools macros with a FreeCAD-enabled Python.

Prepare with: node --import tsx scripts/verify-thread-tools.ts [cases.json]
Run with: python scripts/verify-thread-tools.py [cases.json] [report.json]
"""
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-thread-tools-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-thread-tools-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}

def check_shape(shape):
    assert not shape.isNull() and shape.isValid(), 'Invalid shape'
    assert len(shape.Solids) == 1 and shape.Volume > 0, 'Expected one positive solid per physical component'
    assert shape.isClosed(), 'Open component shell'

with tempfile.TemporaryDirectory(prefix='protolab-thread-tools-') as directory:
    for case in cases:
        record = {'name': case['name'], 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('ThreadAudit')
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
            shape = children[0].Shape
            p = case['parameters']
            length = p['length']
            diameter = p['diameter']
            if case['state'] == 'internal':
                target = Part.makeBox(diameter*2, diameter*2, length*.8,
                                      App.Vector(-diameter, -diameter, length*.1))
                result = target.cut(shape)
                check_shape(result)
                assert result.Volume < target.Volume, 'Cut did not remove material'
                assert not result.isInside(App.Vector(0,0,length/2), 1e-7, True), 'Bore core was not removed'
            else:
                base = Part.makeBox(diameter*2, diameter*2, length*.3,
                                    App.Vector(-diameter,-diameter,-length*.2))
                result = base.fuse(shape).removeSplitter()
                check_shape(result)
                assert result.Volume > shape.Volume and result.Volume > base.Volume, 'Union did not join overlapping solids'
            # Test the native radial profile against independently evaluated preview points.
            for sample in case['radialSamples']:
                x,y,z = sample['outside']
                angle = math.atan2(y,x)
                radius = math.hypot(x,y)
                inside_radius = math.hypot(*sample['inside'][:2])
                # OCC point classification near small helical faces can be ambiguous;
                # an exact line/solid intersection measures the actual radial boundary.
                ray = Part.makeLine(App.Vector(0,0,z), App.Vector(diameter*math.cos(angle),diameter*math.sin(angle),z))
                section = shape.common(ray)
                actual_radius = max(math.hypot(v.Point.x,v.Point.y) for v in section.Vertexes)
                assert inside_radius < actual_radius < radius, ('Native/preview radial mismatch', actual_radius, inside_radius, radius)
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
            step = str(Path(directory) / 'thread-tools.step')
            volume = sum(child.Shape.Volume for child in children)
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            assert restored.isValid() and len(restored.Solids) == len(children), 'STEP component mismatch'
            assert abs(restored.Volume - volume) < max(0.001, volume * 1e-5), 'STEP changed volume'
            name, labels = root.Name, [child.Label for child in children]
            fcstd = str(Path(directory) / 'thread-tools.FCStd')
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
                          independentMovement=len(reopened) > 1, stepRoundtrip=True, fcstdRoundtrip=True, booleanOperation="Cut" if case["state"] == "internal" else "Union", radialProfile=True)
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
