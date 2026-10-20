"""Verify prepared control/connector cases using an isolated FreeCAD Python.

node --import tsx scripts/verify-electrical-catalogs.ts [cases.json]
python scripts/verify-electrical-catalogs.py [cases.json] [report.json]
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

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-electrical-catalogs-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-electrical-catalogs-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}


def check_shape(shape, count=None):
    assert not shape.isNull() and shape.isValid(), 'Invalid native component'
    solids = shape.Solids
    assert solids and shape.isClosed(), 'Expected closed native solids'
    assert all(s.isValid() and s.isClosed() and s.Volume > 0 for s in solids), 'Invalid, open or inward solid'
    if count is not None:
        assert len(solids) == count, ('Component solid count changed', len(solids), count)


with tempfile.TemporaryDirectory(prefix='protolab-electrical-catalogs-') as directory:
    for case in cases:
        row = {'name': case['name'], 'passed': False, 'sourceUrl': case.get('sourceUrl'),
               'sourceSha256': case.get('sourceSha256'),
               'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('ElectricalCatalogAudit')
        try:
            sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
            exec(case['script'], {})
            roots = [o for o in doc.RootObjects if o != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name), 'Existing objects must be preserved'
            root = roots[0]
            assert root.PartId == case['id'] and root.ModelState == case['state']
            assert json.loads(root.Configuration) == case['parameters']
            children = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(children) == len(case['components']), 'Preview/native component count mismatch'
            bounds_errors, volume_errors = [], []
            for child, expected in zip(children, case['components']):
                try:
                    check_shape(child.Shape, expected['sourceSolids'])
                except AssertionError as error:
                    raise AssertionError((child.Label, str(error))) from error
                points, _ = child.Shape.tessellate(0.01)
                bound = App.BoundBox()
                for point in points:
                    bound.add(point)
                actual = [bound.XMin, bound.YMin, bound.ZMin, bound.XMax, bound.YMax, bound.ZMax]
                errors = [abs(a - b) for a, b in zip(actual, expected['min'] + expected['max'])]
                assert max(errors) < 0.05, (child.Label, 'Preview/native bounds mismatch', max(errors))
                bounds_errors.extend(errors)
                volume = sum(s.Volume for s in child.Shape.Solids)
                error = abs(volume - expected['volume']) / volume
                assert error < 0.015, (child.Label, 'Preview/native volume mismatch', error)
                volume_errors.append(error)
            intersections = []
            for i, first in enumerate(children):
                for second in children[i + 1:]:
                    if not first.Shape.BoundBox.intersect(second.Shape.BoundBox):
                        continue
                    common = first.Shape.common(second.Shape)
                    overlap = 0 if common.isNull() else common.Volume
                    if overlap > max(1e-6, min(first.Shape.Volume, second.Shape.Volume) * 1e-6):
                        intersections.append({'first': first.Label, 'second': second.Label, 'volume': overlap})
            if not case.get('retainedSource'):
                assert not intersections, ('Reconstructed physical components intersect', intersections)
            if len(children) > 1:
                before = [App.Vector(c.Shape.Solids[0].CenterOfMass) for c in children]
                placement = App.Placement(children[0].Placement)
                delta = App.Vector(3, -4, 5)
                children[0].Placement.Base += delta
                doc.recompute()
                assert (children[0].Shape.Solids[0].CenterOfMass - before[0] - delta).Length < 1e-6
                for child, old in zip(children[1:], before[1:]):
                    assert (child.Shape.Solids[0].CenterOfMass - old).Length < 1e-6
                children[0].Placement = placement
                doc.recompute()
            volume = sum(s.Volume for c in children for s in c.Shape.Solids)
            count = sum(len(c.Shape.Solids) for c in children)
            step = str(Path(directory) / 'catalog.step')
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            row.update(stepSolids=len(restored.Solids), stepValid=restored.isValid())
            assert restored.isValid() and len(restored.Solids) == count, 'STEP topology/solid mismatch'
            step_error = abs(sum(s.Volume for s in restored.Solids) - volume) / volume
            row['stepRelativeVolumeError'] = step_error
            assert step_error < 1e-5, 'STEP volume changed'
            name, labels = root.Name, [c.Label for c in children]
            fcstd = str(Path(directory) / 'catalog.FCStd')
            doc.saveAs(fcstd)
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd)
            root = doc.getObject(name)
            reopened = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert [c.Label for c in reopened] == labels, 'Native component labels changed'
            for child in reopened:
                check_shape(child.Shape)
            row.update(passed=True, components=len(reopened), solids=count,
                       maxBoundsError=max(bounds_errors), maxRelativeVolumeError=max(volume_errors),
                       retainedSourceInterferences=intersections, independentMovement=len(children) > 1,
                       stepRoundtrip=True, fcstdRoundtrip=True)
        except Exception as error:
            row['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        report['cases'].append(row)
        report.update(passed=sum(r['passed'] for r in report['cases']),
                      failed=sum(not r['passed'] for r in report['cases']),
                      elapsedSeconds=time.perf_counter() - started)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))
        print(json.dumps(row), flush=True)
sys.exit(bool(report['failed']))
