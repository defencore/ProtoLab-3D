"""Audit saved wall-mount candidate BReps against an immutable native release."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy

import FreeCAD as App
import Part


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def boxes_overlap(first, second):
    return all(
        min(getattr(first, axis + 'Max'), getattr(second, axis + 'Max'))
        - max(getattr(first, axis + 'Min'), getattr(second, axis + 'Min')) > 1e-7
        for axis in 'XYZ'
    )


def overlap(first, second):
    assert not first.isNull() and not second.isNull()
    if not boxes_overlap(first.BoundBox, second.BoundBox):
        return 0
    if max(len(first.Solids), len(second.Solids)) < 32:
        try:
            common = first.common(second)
        except Exception:
            first.exportBrep(str(stage / 'null-common-first.brep'))
            second.exportBrep(str(stage / 'null-common-second.brep'))
            print('NULL_COMMON_DIAGNOSTIC=' + json.dumps([
                {'volume': shape.Volume, 'valid': shape.isValid(), 'closed': shape.isClosed(),
                 'solids': len(shape.Solids), 'faces': len(shape.Faces),
                 'bounds': [shape.BoundBox.XMin, shape.BoundBox.YMin, shape.BoundBox.ZMin,
                            shape.BoundBox.XMax, shape.BoundBox.YMax, shape.BoundBox.ZMax]}
                for shape in [first, second]
            ]), flush=True)
            raise
        return 0 if common.isNull() else common.Volume
    return sum(
        a.common(b).Volume for a in first.Solids for b in second.Solids
        if boxes_overlap(a.BoundBox, b.BoundBox)
    )


parser = argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('--stage', required=True)
parser.add_argument('--baseline', required=True)
args = parser.parse_args()
case = json.loads(Path(args.input).read_text())
assert hashlib.sha256(case['script'].encode()).hexdigest() == case['codeSha256']
stage = Path(args.stage)
stage_file = stage / 'stage-validation.json'
candidate = json.loads(stage_file.read_text())
assert candidate['passed'] and candidate['sourceCodeSha256'] == case['codeSha256']
baseline = Path(args.baseline)
baseline_records = json.loads((baseline / 'case-panel-components.json').read_text())['components']
baseline_report = json.loads((baseline / 'native-export-validation.json').read_text())
fcstd = baseline / 'servo-toggle-case-panel.FCStd'
assert digest(fcstd) == baseline_report['fcstdSha256']
assert candidate['baselineSourceCodeSha256'] == baseline_report['sourceCodeSha256']
doc = App.openDocument(str(fcstd))
children = sorted((obj for obj in doc.Objects if hasattr(obj, 'ComponentIndex')),
                  key=lambda obj: obj.ComponentIndex)
assert len(children) == len(baseline_records)
original = {record['id']: obj.Shape for record, obj in zip(baseline_records, children)}
changed = set(candidate['changedComponentIds'])
rows = {row['id']: row for row in candidate['parts']}
shapes, files = [], []
for record in case['components']:
    id = record['id']
    if id in changed:
        file = stage / (id + '.brep')
        shape = Part.Shape()
        shape.read(str(file))
        assert shape.isValid() and shape.isClosed() and len(shape.Solids) == rows[id]['solids']
        if record['supply'] == 'manufactured':
            assert len(shape.Solids) == 1
        assert abs(shape.Volume - rows[id]['volumeMm3']) <= max(1e-7, shape.Volume * 1e-9)
        files.append({'id': id, 'file': file.name, 'sha256': digest(file)})
    else:
        shape = original[id]
    shapes.append(shape)
fixture = Path(__file__).with_name('case-panel-wall-mount-fixture.py')
case_fixture = Path(__file__).with_name('case-panel-native-fixture.py')
wall = runpy.run_path(str(fixture))['audit_wall_mounts'](
    case, shapes, overlap, case['wallMounts'], runpy.run_path(str(case_fixture)),
)
report = {
    'sourceCodeSha256': case['codeSha256'],
    'baselineSourceCodeSha256': baseline_report['sourceCodeSha256'],
    'baselineFcstdSha256': baseline_report['fcstdSha256'],
    'stageReportSha256': digest(stage_file), 'candidateBreps': files,
    'fixtureCodeSha256': {fixture.name: digest(fixture), case_fixture.name: digest(case_fixture)},
    **wall,
}
output = stage / 'native-wall-mount-stage-validation.json'
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report), flush=True)
App.closeDocument(doc.Name)
raise SystemExit(0 if report['passed'] else 1)
