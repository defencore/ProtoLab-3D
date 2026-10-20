"""Validate actual generated holder macros without wires and their CAD roundtrips.

node --import tsx scripts/validate-18650-holders.ts [cases.json]
FreeCAD Python scripts/validate-18650-holders.py [cases.json] [report.json]
Every housing/contact pair must be free of volumetric interference in both
inspection states. External wires are omitted from every generated model.
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

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-18650-holder-cases.json')
OUTPUT = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / 'test-results/18650-holder-assembly-validation.json')


def shape_bounds(shape):
    points, _ = shape.tessellate(.005)
    b = App.BoundBox()
    for point in points:
        b.add(point)
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def volume(shape):
    return sum(s.Volume for s in shape.Solids)


def check_shape(shape, count=None):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), 'Invalid/open native geometry'
    assert shape.Solids and all(s.isClosed() and s.isValid() and s.Volume > 0 for s in shape.Solids)
    if count is not None:
        assert len(shape.Solids) == count, ('Unexpected native solid count', len(shape.Solids), count)


def main():
    started = time.perf_counter()
    prepared = json.loads(INPUT.read_text())
    assert len(prepared['cases']) == 12
    assert len({case['name'] for case in prepared['cases']}) == 12
    assert len({case['model'] for case in prepared['cases']}) == 6
    for path, expected in prepared['sourceHashes'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, ('Source changed after preparing cases', path)
    report = {
        'checkedAt': datetime.now(timezone.utc).isoformat(),
        'freecad': '.'.join(App.Version()[:3]),
        'sourceHashes': prepared['sourceHashes'],
        'fixtureSha256': hashlib.sha256(INPUT.read_bytes()).hexdigest(),
        'validatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'scope': 'All six holder models without external wires, assembled and separated inspection. Native leaf validity/counts, preview bounds/volume agreement, and zero volumetric interference between every housing/contact pair. STEP and FCStd roundtrips for all three BeiLaMoo sizes. No electrical, thermal or contact-force rating.',
        'cases': [],
    }
    with tempfile.TemporaryDirectory(prefix='protolab-18650-holder-audit-') as temp:
        for case in prepared['cases']:
            row = {'name': case['name'], 'passed': False, 'scriptSha256': case['scriptSha256']}
            doc = App.newDocument('HolderAudit')
            try:
                sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
                assert hashlib.sha256(case['script'].encode()).hexdigest() == case['scriptSha256']
                exec(case['script'], {})
                roots = [o for o in doc.RootObjects if o != sentinel]
                assert len(roots) == 1 and doc.getObject(sentinel.Name)
                root = roots[0]
                assert root.PartId == case['id'] and root.ModelState == case['state']
                assert json.loads(root.Configuration) == case['parameters']
                assert case['parameters'] == {'model': case['model']}
                assert case['expectedComponents'] == 1 + 2 * case['cells']
                children = list(root.Group) if root.TypeId == 'App::Part' else [root]
                assert len(children) == len(case['components']) == case['expectedComponents']
                bound_errors, volume_errors = [], []
                all_bounds = App.BoundBox()
                for child, expected in zip(children, case['components']):
                    check_shape(child.Shape, 1)
                    actual = shape_bounds(child.Shape)
                    errors = [abs(a - b) for a, b in zip(actual, expected['min'] + expected['max'])]
                    assert max(errors) < .055, (child.Label, 'Preview/native bounds', max(errors), actual, expected['min'] + expected['max'])
                    bound_errors.extend(errors)
                    relative = abs(volume(child.Shape) - expected['volume']) / volume(child.Shape)
                    assert relative < .015, (child.Label, 'Preview/native volume', relative)
                    volume_errors.append(relative)
                    all_bounds.add(App.Vector(*actual[:3]))
                    all_bounds.add(App.Vector(*actual[3:]))
                overall = [all_bounds.XMin, all_bounds.YMin, all_bounds.ZMin, all_bounds.XMax, all_bounds.YMax, all_bounds.ZMax]
                overall_error = max(abs(a - b) for a, b in zip(overall, case['bounds']))
                assert overall_error < .055
                intersections = []
                for i, first in enumerate(children):
                    for j in range(i + 1, len(children)):
                        second = children[j]
                        if not first.Shape.BoundBox.intersect(second.Shape.BoundBox):
                            continue
                        common = first.Shape.common(second.Shape)
                        overlap = volume(common) if not common.isNull() else 0
                        if overlap < 1e-6:
                            continue
                        intersections.append({'first': first.Label, 'second': second.Label, 'volume': overlap})
                row['componentInterferences'] = intersections
                assert not intersections, ('Holder components collide', intersections)
                count = sum(len(child.Shape.Solids) for child in children)
                total_volume = sum(volume(child.Shape) for child in children)
                if case['roundtrip']:
                    step = Path(temp) / (case['model'] + '.step')
                    Part.export(children, str(step))
                    restored = Part.read(str(step))
                    check_shape(restored, count)
                    step_error = abs(volume(restored) - total_volume) / total_volume
                    assert step_error < 1e-6, ('STEP roundtrip volume', step_error)
                    name, labels = root.Name, [c.Label for c in children]
                    fcstd = Path(temp) / (case['model'] + '.FCStd')
                    doc.saveAs(str(fcstd))
                    App.closeDocument(doc.Name)
                    doc = App.openDocument(str(fcstd))
                    root = doc.getObject(name)
                    reopened = list(root.Group)
                    assert len(reopened) == len(children)
                    assert [c.Label for c in reopened] == labels
                    assert json.loads(root.Configuration) == case['parameters']
                    for child in reopened:
                        check_shape(child.Shape, 1)
                    fcstd_error = abs(sum(volume(c.Shape) for c in reopened) - total_volume) / total_volume
                    assert fcstd_error < 1e-9
                    row.update(stepRoundtrip=True, fcstdRoundtrip=True, stepRelativeVolumeError=step_error, fcstdRelativeVolumeError=fcstd_error)
                row.update(
                    passed=True, components=len(case['components']), solids=count,
                    volume=total_volume, maxBoundsError=max(bound_errors), overallBoundsError=overall_error,
                    maxRelativeVolumeError=max(volume_errors),
                )
            except Exception as error:
                row['error'] = str(error)
            finally:
                if doc and doc.Name in App.listDocuments():
                    App.closeDocument(doc.Name)
            report['cases'].append(row)
            report.update(
                passed=sum(r['passed'] for r in report['cases']),
                failed=sum(not r['passed'] for r in report['cases']),
                elapsedSeconds=time.perf_counter() - started,
            )
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT.write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(row), flush=True)
    return bool(report['failed'])


if __name__ == '__main__':
    sys.exit(main())
