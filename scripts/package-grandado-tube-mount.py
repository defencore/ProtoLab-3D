#!/usr/bin/env python3
"""Package only the currently verified cylindrical kit, never superseded generated files."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/grandado-tube-mount'
report = json.loads((OUT / 'native-report.json').read_text())
assert report.get('completed') and report['passed'] and not report['errors'], 'Native verification has not completed and passed.'
assert report.get('cableRouting', {}).get('passed'), 'Continuous cable routing and both end-disc exits have not passed native verification.'
assert report.get('lidGasketGroove', {}).get('passed'), 'The corrected lid-side gasket groove and full body-rim contact have not passed native verification.'
assert report.get('lidAxialFit', {}).get('passed'), 'The X-only differential lid fit check has not passed.'
assert report.get('attachedCableAssembly', {}).get('passed'), 'Continuous closure with the already attached cable has not passed native verification.'
assert report['lidGasketGroove']['gland']['measuredBodyRim']['outerLength'] == 78.7, 'The remeasured 78.7 mm rim must be used; the initial 77.9 mm reading is superseded.'
assert report['lidGasketGroove']['gland']['axialFitAllowance'] == 0.5, 'Package the current 0.5 mm total axial lid fit correction.'
assert report.get('smoothLidEnvelope', {}).get('passed'), 'The smooth cylindrical cover envelope has not passed native verification.'
assert all(key in report for key in ('assemblyPaths', 'cellRetention', 'assemblyArtifacts', 'retentionScope')), 'Native assembly and retention verification is incomplete.'
assert len(report['printedParts']) == 30, 'Expected 19 fitting/coupon prints and 11 alternate nominal jig parts.'
for path, expected in report['sourceHashes'].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, f'Stale verification: {path}'

javascript = r'''
import part from './src/parts/grandado-tube-mount/part.ts';
const rows=part.composition(part.defaults).components.filter(c=>c.supply==='standard');
const grouped=new Map();
for(const c of rows){const key=c.libraryId+JSON.stringify(c.parameters);const v=grouped.get(key);if(v)v.quantity+=c.quantity;else grouped.set(key,{name:c.name,quantity:c.quantity});}
console.log(JSON.stringify([...grouped.values()]));
'''
hardware = json.loads(subprocess.run(['node','--import','tsx','--input-type=module','-e',javascript],cwd=ROOT,check=True,text=True,capture_output=True).stdout)
text = '# Hardware\n\n| Quantity | Description |\n|---:|---|\n'
text += ''.join(f"| {row['quantity']} | {row['name']} |\n" for row in hardware)
text += '\nExternal countersunk screw lengths include the head. Check the actual head dimensions before countersinking.\n'
text += '\nThe Grandado lid reuses four screws from the original enclosure. For recessed heads, the model requires shortening only the tip of each screw by 2 mm (12.3 mm under the head). First check the actual lengths and blind-hole depths; after shortening, deburr the tips and verify that the lid clamps before a screw bottoms out.\n'
(OUT / 'HARDWARE-EN.md').write_text(text)

archive = OUT / 'grandado-d90-86-axial-fit-0p5-kit.zip'
parts = report['printedParts']
assert any(v['id'] == 'upper-cylinder-shell' for v in parts), 'Old non-cylindrical kit cannot be packaged.'
assert {'cell-keeper-bridge', 'lower-cylinder-negative', 'lower-cylinder-positive', 'end-disc-negative', 'end-disc-positive', 'grandado-curved-replacement-lid'}.issubset({v['id'] for v in parts}), 'Final passive cylinder, solid discs and curved lid are required.'
assert not any('jcg108' in v['id'] or 'antenna-shroud' in v['id'] for v in parts), 'The cancelled antenna cover cannot be packaged.'
assert 'jcg108-antenna-backing' not in {v['id'] for v in parts}, 'The raised antenna backing is superseded.'
assert not any('outer-saddle' in v['id'] or 'upper-spacer' in v['id'] for v in parts)
counts = {}
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for item in parts:
        if item['variant'] == 'nominal-83x58-jig': folder = 'template-83x58'
        elif item['role'] == 'jig': folder = 'template-83.6x58.6'
        elif item['role'] == 'coupon': folder = 'fit-coupon'
        else: folder = 'cassette'
        counts[folder] = counts.get(folder, 0) + 1
        for extension in ('stl', 'step'):
            path = Path(item[extension])
            assert path.is_file(), path
            package.write(path, f'{folder}/{path.name}')
    for name in ('ASSEMBLY-UA.md', 'HARDWARE-EN.md', 'LID-FIT-UA.md', 'native-report.json', 'assembly.FCStd', 'assembly.step'):
        package.write(OUT / name, name)
    package.write(ROOT / 'src/parts/grandado-tube-mount/GUIDE.md', 'GUIDE-EN.md')
    package.write(OUT / 'render-report.json', 'verification/render-report.json')
    renders=json.loads((OUT/'render-report.json').read_text())
    for path, expected in renders['sourceHashes'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected, f'Stale render: {path}'
    for name in ('assembled.png','cutaway.png','exploded.png','template.png','antenna-underside.png','cover-underside.png','cover-only.png','gasket-interface.png'):
        assert name in renders['outputs'], f'Missing current render: {name}'
        package.write(OUT/name, 'preview/'+name)
manifest = {'archive': str(archive), 'bytes': archive.stat().st_size, 'partCounts': counts, 'nativeCheckedAt': report['checkedAt']}
(OUT / 'package-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest))
