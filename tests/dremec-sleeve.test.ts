import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import part from '../src/parts/dremec-spacer-sleeve/part';
import { dremecSleevePresets } from '../src/catalog/dremec-sleeve-presets';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('DREMEC custom sleeves distinguish the published steel example from customer dimensions', () => {
  const presets = dremecSleevePresets();
  assert.equal(presets.length, 4);
  const steel = presets.find((item) => item.parameters.material === 'steel')!;
  assert.equal(steel.catalog?.designation, '324/2.1x10');
  assert.equal(steel.catalog?.geometryEvidence?.kind, 'source-dimensions');
  assert.deepEqual(steel.parameters, {
    material: 'steel',
    outerDiameter: 4,
    bore: 2.1,
    length: 10,
  });
  for (const preset of presets) {
    assert.deepEqual(part.validate(preset.parameters, 'default'), []);
    assert.match(preset.catalog!.sourceUrl, /^https:\/\/dremec\.ua\/product\/spacer-sleeves-/);
    if (preset !== steel) {
      assert.deepEqual(preset.catalog?.verifiedParameters, ['material']);
      assert.equal(preset.catalog?.geometryEvidence?.kind, 'envelope');
    }
  }
});

test('DREMEC sleeve source follows material after custom editing and both modes retain a real bore', () => {
  for (const preset of dremecSleevePresets()) {
    const parameters = { ...preset.parameters, outerDiameter: 8, bore: 3.2, length: 24 };
    for (const mode of ['simple', 'full'] as const) {
      const group = withGeometryMode(mode, () => part.buildGeometry(parameters, 'default'));
      try {
        const size = new Box3().setFromObject(group).getSize(new Vector3()).toArray();
        assert.ok(size.every((value, index) => Math.abs(value - [8, 8, 24][index]) < 0.001));
      } finally {
        disposeModel(group);
      }
      const script = withGeometryMode(mode, () => generateScript(part, parameters, 'default'));
      assert.ok(script.includes(preset.catalog!.sourceUrl));
      assert.ok(
        script.includes('Customer-specified geometry; no stock SKU or availability claim.'),
      );
      assert.ok(script.includes('\\"bore\\":3.2'));
    }
  }
});

test('DREMEC sleeve rejects dimensions that cannot form a tube or exceed the published range', () => {
  const patches: Parameters[] = [
    { bore: 4 },
    { bore: 0 },
    { outerDiameter: 37 },
    { length: 61 },
    { material: 'unknown' },
  ];
  for (const patch of patches)
    assert.ok(part.validate({ ...part.defaults, ...patch }, 'default').length > 0);
});
