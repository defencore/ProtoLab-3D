import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/landing-gear/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

for (const preset of part.presets) {
  test(`landing gear mechanical clearance: ${preset.id}`, () => {
    const model = part.buildGeometry(preset.parameters, 'assembled');
    try {
      const bounds = (label: string) => {
        const item = model.children.find((c) => c.name === label);
        assert.ok(item, label);
        return new Box3().setFromObject(item, true);
      };
      const tyres = model.children
        .filter((c) => c.name.endsWith('rounded tyre'))
        .map((c) => new Box3().setFromObject(c, true));
      const fork = bounds('Wheel fork · bored cheeks and crown');
      const axle = bounds('Wheel axle');
      const slider = bounds('Lower sliding strut');
      for (const tyre of tyres) {
        assert.ok(tyre.min.y > fork.min.y && tyre.max.y < fork.max.y, 'tyre fits between cheeks');
        assert.ok(axle.min.y < tyre.min.y && axle.max.y > tyre.max.y, 'axle spans wheel');
        assert.ok(slider.min.z > tyre.max.z, 'strut ends above the tyre');
      }
      if (tyres.length === 2)
        assert.ok(tyres[0].max.y < tyres[1].min.y, 'twin tyres are separated');
      assert.ok(model.children.length <= 18, 'bounded FreeCAD object count');
    } finally {
      disposeModel(model);
    }
  });
}
test('landing gear rejects colliding or unsupported layouts', () => {
  const invalid: Parameters[] = [
    { strut: 50 },
    { rod: 8 },
    { axle: 25 },
    { plate: 15 },
    { form: 'braced', braceSpan: 30 },
    { form: 'folding', kneeOffset: 100 },
    { form: 'unknown' },
    { wheels: 'unknown' },
    { width: 3, clearance: 1 },
  ];
  for (const patch of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length,
      JSON.stringify(patch),
    );
});
