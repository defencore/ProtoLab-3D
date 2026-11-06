#!/usr/bin/env python3
"""Package only the four changed cassette prints after complete native verification."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/grandado-tube-mount'
BASELINE = ROOT / 'test-results/grandado-before-body-ear-cable-correction/native-input.json'
report = json.loads((OUT / 'native-report.json').read_text())
assert report.get('completed') and report.get('passed') and not report['errors']
assert report.get('attachedCableAssembly', {}).get('passed'), 'Attached-wire assembly motion must pass.'
for path, expected in report['sourceHashes'].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, f'Stale native verification: {path}'

before = {item['id']: item for item in json.loads(BASELINE.read_text())['printed']}
after = {item['id']: item for item in json.loads((OUT / 'native-input.json').read_text())['printed']}
assert before.keys() == after.keys(), 'The update must preserve physical detail IDs.'
unchanged = sorted(identity for identity in before if all(
    before[identity][key] == after[identity][key] for key in ('python', 'installedPython')
))
changed = sorted(set(after) - set(unchanged))
expected = {'upper-cylinder-shell', 'lower-cylinder-negative', 'lower-cylinder-positive', 'cell-keeper-bridge'}
assert set(changed) == expected, f'Unexpected reprint scope: {changed}'
assert {'grandado-curved-replacement-lid', 'end-disc-negative', 'end-disc-positive'}.issubset(unchanged)

manifest = {
    'baseline': str(BASELINE),
    'nativeCheckedAt': report['checkedAt'],
    'comparison': 'Byte-identical complete installed and print-pose native Python recipes establish unchanged geometry. Inspection references are excluded from the manufactured-detail comparison.',
    'reprintIds': changed,
    'reuseIds': unchanged,
    'scope': 'Four changed cassette details; the previously corrected 78.7 mm lid, end discs and jig retain their exact native recipes.',
}
manifest_path = OUT / 'geometry-change-manifest.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
archive = OUT / 'grandado-cassette-update-ears6.zip'
records = {item['id']: item for item in report['printedParts'] if item['variant'] == 'fitting-kit'}
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for identity in changed:
        for extension in ('stl', 'step'):
            path = Path(records[identity][extension])
            package.write(path, path.name)
    for name in ('ASSEMBLY-UA.md', 'native-report.json', manifest_path.name):
        package.write(OUT / name, name)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert sum(name.endswith('.stl') for name in package.namelist()) == 4
    assert sum(name.endswith('.step') for name in package.namelist()) == 4
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'reprintIds': changed}))
