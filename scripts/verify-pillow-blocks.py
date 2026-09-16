"""Validate KP pillow-block macros with a FreeCAD-enabled Python.

Prepare with: node --import tsx scripts/verify-pillow-blocks.ts [cases.json]
Run with: python scripts/verify-pillow-blocks.py [cases.json] [report.json]
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

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-pillow-blocks-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-pillow-blocks-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}

def check_shape(shape):
    assert not shape.isNull() and shape.isValid(), 'Invalid shape'
    assert len(shape.Solids) == 1 and shape.Volume > 0, 'Expected one positive solid per physical component'
    assert shape.isClosed(), 'Open component shell'

with tempfile.TemporaryDirectory(prefix='protolab-pillow-blocks-') as directory:
    for case in cases:
        record = {'name': case['name'], 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('PillowBlockAudit')
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
            p = case['parameters']
            housing = children[0].Shape
            # Independently probe the dimensioned mounting-hole centres and the
            # shaft bore in native CAD, not only in the browser tessellation.
            for side in (-1, 1):
                x = side * p['mountPitch'] / 2
                probe = Part.makeCylinder(p['hole'] / 2 - 0.01, p['baseThickness'] + 2,
                    App.Vector(x, 0, -p['centerHeight'] - 1))
                assert housing.common(probe).Volume < 1e-6, 'Mounting hole is blocked'
            probe = Part.makeCylinder(p['bore'] / 2 - 0.01, 200,
                App.Vector(0, -100, 0), App.Vector(0, 1, 0))
            for child in children:
                assert child.Shape.common(probe).Volume < 1e-6, 'Shaft bore is blocked'
            if p['insertOffset'] == -3.25:
                b = children[2].Shape.optimalBoundingBox(False, False)
                assert abs(b.YMin + 10.5) < 1e-6 and abs(b.YMax - 4) < 1e-6, 'KP001 B/S datums changed'
            intersections = []
            for i, first in enumerate(children):
                for second in children[i + 1:]:
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
            step = str(Path(directory) / 'pillow-blocks.step')
            volume = sum(child.Shape.Volume for child in children)
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            assert restored.isValid() and len(restored.Solids) == len(children), 'STEP component mismatch'
            assert abs(restored.Volume - volume) < max(0.001, volume * 1e-5), 'STEP changed volume'
            name, labels = root.Name, [child.Label for child in children]
            fcstd = str(Path(directory) / 'pillow-blocks.FCStd')
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
