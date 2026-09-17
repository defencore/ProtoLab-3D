import test from 'node:test';
import assert from 'node:assert/strict';
import { parts } from '../src/parts';
import type { Parameters } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { pieces, mounts } from '../src/parts/chf-gf5560-180/lib/model';
const part = parts.find((p) => p.id === 'chf-gf5560-180')!;
test('GF5560 presets distinguish winding and supply at the same ratio', () => {
  assert.equal(part.presets.length, 22);
  const high = part.presets.find((p) => p.id === '12v-high-torque-1400')!;
  const standard = part.presets.find((p) => p.id === '12v-standard-1400')!;
  assert.equal(high.catalog!.attributes!.noLoadRpm, 11);
  assert.equal(standard.catalog!.attributes!.noLoadRpm, 5);
  assert.deepEqual(part.defaults, high.parameters);
  assert.deepEqual(
    high.parameters,
    standard.parameters,
    'same envelope with different performance',
  );
  assert.deepEqual(mounts, [
    [3.5, 51.5],
    [51.5, 51.5],
    [51.5, 24],
    [12.5, 3.5],
  ]);
  for (const preset of part.presets) {
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
    assert.equal(preset.parameters.shaftProfile, 'shouldered-d');
    assert.equal(preset.parameters.flatLength, 15);
    assert.ok(
      !Object.hasOwn(preset.parameters, 'ratio'),
      'catalog performance is not an inert geometry control',
    );
  }
});
test('GF5560 inspection states expose physical stages and lightweight removes hidden transmission', () => {
  const complete = pieces(part.defaults, 'assembled');
  const open = pieces(part.defaults, 'open');
  const light = pieces({ ...part.defaults, detail: 'lightweight' }, 'assembled');
  assert.equal(complete.filter((p) => p.label.startsWith('Compound gear')).length, 3);
  assert.equal(complete.filter((p) => p.label.startsWith('Brass helical worm')).length, 1);
  assert.ok(!open.some((p) => p.label.includes('cover') || p.label.startsWith('Cover screw')));
  assert.ok(!light.some((p) => p.label.includes('gear ') || p.label.includes('worm')));
  assert.ok(light.some((p) => p.label === 'Output D-shaft'));
  assert.equal(complete.length - light.length, 11);
  assert.deepEqual(
    pieces({ ...part.defaults, detail: 'lightweight' }, 'open'),
    open,
    'inspection always exposes mechanism',
  );
});
test('GF5560 shaft controls change geometry and impossible flats are rejected', () => {
  const base = part.python(part.defaults, 'assembled');
  for (const patch of [
    { shaftDiameter: 9 },
    { shaftLength: 26 },
    { flatThickness: 6.5 },
    { flatLength: 12 },
    { shaftAngle: 90 },
    { shaftProfile: 'full-d' },
    { detail: 'lightweight' },
  ] as Parameters[]) {
    const p = { ...part.defaults, ...patch };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.notEqual(part.python(p, 'assembled'), base);
  }
  for (const patch of [
    { flatThickness: 8 },
    { flatThickness: 4 },
    { flatLength: 21 },
    { shaftLength: 10 },
  ] as Parameters[])
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
});
