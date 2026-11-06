#!/usr/bin/env python3
"""Package the verified axial lid fit correction, retaining the tried kit baseline."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/grandado-tube-mount'
BASELINE = ROOT / 'test-results/grandado-lid-axial-fit/baseline/native-input.json'
report = json.loads((OUT / 'native-report.json').read_text())
assert report.get('completed') and report.get('passed') and not report['errors']
assert report.get('lidGasketGroove', {}).get('passed')
assert report.get('lidAxialFit', {}).get('passed'), 'The X-only differential fit check must pass.'
assert report['lidGasketGroove']['gland']['axialFitAllowance'] == 0.5
for path, expected in report['sourceHashes'].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, f'Stale native verification: {path}'

def recipes(path):
    fixture = json.loads(path.read_text())
    return {(group, row['id']): (row['python'], row['installedPython'])
            for group in ('printed', 'nominalJig') for row in fixture[group]}

before = recipes(BASELINE)
after = recipes(OUT / 'native-input.json')
assert before.keys() == after.keys()
changed = sorted(key for key in before if before[key] != after[key])
assert changed == [('printed', 'grandado-curved-replacement-lid')], changed
identity = changed[0][1]
manifest = {
    'baseline': str(BASELINE),
    'nativeCheckedAt': report['checkedAt'],
    'reprintIds': [identity],
    'unchangedManufacturedRecipes': len(before) - 1,
    'comparison': 'Complete installed and print-pose native recipes compared byte for byte.',
    'scope': 'Trial correction: 0.5 mm total inward relief of the two straight inner end flanks; physical closure remains to be tried.',
}
manifest_path = OUT / 'lid-fit-change-manifest.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
row = next(item for item in report['printedParts'] if item['id'] == identity)
archive = OUT / 'grandado-lid-axial-fit-0p5.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for extension in ('stl', 'step'):
        path = Path(row[extension])
        package.write(path, path.name)
    for name in ('LID-FIT-UA.md', 'lid-fit-change-manifest.json', 'native-report.json'):
        package.write(OUT / name, name)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for extension in ('stl', 'step'):
        path = Path(row[extension])
        assert package.read(path.name) == path.read_bytes()
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, **manifest}))
