import assert from 'node:assert/strict';
import test from 'node:test';
import { armSites, layouts } from '../src/parts/multicopter-frame/lib/layout';
import part from '../src/parts/multicopter-frame/part';
import { validateParameters } from '../src/core/validation';
import { pieces } from '../src/parts/multicopter-frame/lib/model';

const expected: Record<string, [number, number]> = {
  'quad-plus': [4, 0],
  'quad-x': [4, 0],
  'quad-h': [4, 0],
  'quad-v': [4, 0],
  'quad-y': [3, 1],
  'hexa-plus': [6, 0],
  'hexa-x': [6, 0],
  'hexa-y6': [3, 3],
  'hexa-ly': [3, 3],
  'octa-plus': [8, 0],
  'octa-x': [8, 0],
  'octa-x8': [4, 4],
};
test('all twelve figure configurations have the intended motor sites and coaxial pairs', () => {
  assert.equal(layouts.length, 12);
  for (const layout of layouts) {
    const preset = part.presets.find((p) => p.id === 'layout-' + layout.value)!;
    const sites = armSites(preset.parameters),
      [arms, pairs] = expected[layout.value];
    assert.equal(sites.length, arms);
    assert.equal(sites.filter((s) => s.paired).length, pairs);
    assert.equal(new Set(sites.map((s) => s.angle)).size, arms);
    assert.equal(
      pieces(preset.parameters, 'assembled').filter((p) => p.label.includes('lower coaxial'))
        .length,
      pairs,
    );
    for (const armStyle of ['flat', 'tube'])
      assert.deepEqual(
        validateParameters(part, { ...preset.parameters, armStyle }, 'assembled'),
        [],
      );
  }
});
test('plus, X, V and inverted Y retain different geometry relative to the nose', () => {
  const sites = (layout: string) =>
    armSites({ ...part.defaults, layout, armAngle: 55, rearAngle: 35 }).map((s) => s.angle);
  assert.deepEqual(sites('quad-plus'), [0, 90, 180, 270]);
  assert.deepEqual(sites('quad-v'), [55, 145, 215, 305]);
  assert.notDeepEqual(sites('quad-v'), sites('quad-x'));
  assert.deepEqual(sites('hexa-y6'), [60, 180, 300]);
  assert.deepEqual(sites('hexa-ly'), [0, 120, 240]);
  assert.equal(armSites({ ...part.defaults, layout: 'quad-y' }).find((s) => s.paired)?.angle, 180);
});
test('reject stale configurations and disconnected oversized arm roots', () => {
  assert.throws(() => armSites({ ...part.defaults, layout: 'unknown' }));
  assert.ok(validateParameters(part, { ...part.defaults, layout: 'unknown' }, 'assembled').length);
  assert.ok(
    validateParameters(part, { ...part.defaults, layout: 'octa-plus', armWidth: 50 }, 'assembled')
      .length,
  );
  assert.equal(
    part.parameters.some((p) => p.key === 'arms'),
    false,
  );
});

test('selecting V from a symmetric custom X exposes a distinct front/rear geometry', () => {
  const p = part.updateParameters!(
    { ...part.defaults, layout: 'quad-v', armAngle: 35, rearAngle: 35 },
    'layout',
  );
  assert.notEqual(p.armAngle, p.rearAngle);
  assert.deepEqual(validateParameters(part, p, 'assembled'), []);
});
