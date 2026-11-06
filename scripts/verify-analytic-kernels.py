"""Check real surfaces, exact volumes, boundaries and STEP for analytic kernel cases.

Use a FreeCAD-enabled Python. Arguments: after.json [before.json] [report.json].
"""
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

cases = json.loads(Path(sys.argv[1]).read_text())
before = {case['name']: case for case in json.loads(Path(sys.argv[2]).read_text())} if len(sys.argv) > 2 else {}
destination = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(sys.argv[1]).with_name('native-results.json')
report = {'freecad': App.Version(), 'cases': []}


def evaluate(case):
    scope = {'App': App, 'Part': Part}
    start = time.perf_counter()
    exec(case['source'], scope)
    shape = scope['shape'].removeSplitter()
    assert shape.isValid() and shape.isClosed() and shape.Volume > 0
    assert len(shape.Solids) == 1
    bounds = shape.optimalBoundingBox(False, False)
    return shape, {
        'faces': len(shape.Faces), 'edges': len(shape.Edges),
        'brepBytes': len(shape.exportBrepToString().encode()),
        'codeBytes': len(case['source'].encode()), 'volume': shape.Volume,
        'bounds': [bounds.XMin, bounds.YMin, bounds.ZMin, bounds.XMax, bounds.YMax, bounds.ZMax],
        'seconds': time.perf_counter() - start,
    }


with tempfile.TemporaryDirectory(prefix='protolab-analytic-') as directory:
    for case in cases:
        row = {'name': case['name'], 'passed': False}
        try:
            shape, row['after'] = evaluate(case)
            assert abs(shape.Volume - case['volume']) < max(1e-7, case['volume'] * 1e-8), (case['name'], shape.Volume, case['volume'])
            assert len(shape.Faces) <= case['maxFaces'], (case['name'], len(shape.Faces))
            if case['name'] in before:
                _, row['before'] = evaluate(before[case['name']])
                row['maxBoundsChange'] = max(abs(a-b) for a,b in zip(row['before']['bounds'], row['after']['bounds']))
                assert row['maxBoundsChange'] < 0.02
                row['relativeVolumeChange'] = abs(row['before']['volume'] - shape.Volume) / shape.Volume
                assert row['relativeVolumeChange'] < 0.015
                assert row['after']['faces'] < row['before']['faces']
                assert row['after']['brepBytes'] < row['before']['brepBytes']
            step = str(Path(directory) / 'kernel.step')
            shape.exportStep(step)
            restored = Part.read(step)
            assert restored.isValid() and restored.isClosed() and len(restored.Solids) == 1
            assert abs(restored.Volume - shape.Volume) < max(1e-6, shape.Volume * 1e-8)
            row['stepRoundtrip'] = True
            row['passed'] = True
        except Exception as error:
            row['error'] = str(error)
        report['cases'].append(row)
        report['passed'] = sum(case['passed'] for case in report['cases'])
        report['failed'] = sum(not case['passed'] for case in report['cases'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, indent=2))
print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'output': str(destination)}))
sys.exit(bool(report['failed']))
