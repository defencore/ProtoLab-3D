import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { generateScript } from '../src/core/freecad';
import blade from '../src/parts/circular-saw-blade/part';

test('blade macro keeps supplier provenance separate from configured geometry evidence', () => {
  for (const preset of blade.presets)
    for (const mode of ['simple', 'full'] as const) {
      const parameters = { ...blade.defaults, ...preset.parameters };
      const code = generateScript(blade, parameters, 'default', preset.id, undefined, mode);
      assert.match(code, /SupplierGeometryEvidence/);
      assert.match(code, /obj\.GeometryEvidence = /);
      assert.match(code, /illustrative tooth form and relative pin-hole clocking/);
      assert.match(code, /slots and exact tooth profile are not reproduced/);
    }
});

test(
  'both blade catalog macros create valid solids with both evidence records in Simple and Full',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    for (const preset of blade.presets)
      for (const mode of ['simple', 'full'] as const) {
        const parameters = { ...blade.defaults, ...preset.parameters };
        const code = generateScript(blade, parameters, 'default', preset.id, undefined, mode);
        const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
          input:
            code +
            `
import json
obj = App.ActiveDocument.getObject('ProtoLab_circular_saw_blade')
assert obj is not None
assert obj.GeometryMode == ${JSON.stringify(mode)}
assert obj.Shape.isValid() and obj.Shape.isClosed() and obj.Shape.Volume > 0
assert len(obj.Shape.Solids) == 1
evidence = json.loads(obj.GeometryEvidence)
assert evidence['presetId'] == ${JSON.stringify(preset.id)}
assert evidence['source'] == ${JSON.stringify(preset.catalog!.sourceUrl)}
assert 'illustrative tooth form' in obj.SupplierGeometryEvidence
assert 'pin-hole PCDs' in obj.SupplierGeometryEvidence
assert obj.Procurement == 'BUY_STANDARD'
assert 'marked maximum RPM' in obj.SpeedLimit
assert 'GeometryEvidence' in obj.PropertiesList and 'SupplierGeometryEvidence' in obj.PropertiesList
print('BLADE_EVIDENCE_OK')
`,
          encoding: 'utf8',
          timeout: 60000,
        });
        assert.equal(result.status, 0, `${preset.id}/${mode}: ${result.stdout}\n${result.stderr}`);
        assert.match(result.stdout, /BLADE_EVIDENCE_OK/);
      }
  },
);
