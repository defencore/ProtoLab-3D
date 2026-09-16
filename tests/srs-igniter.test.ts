import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/srs-igniter/part';
import type { Parameters } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { modelEvidence } from '../src/core/model-evidence';

const variants = [
  part.defaults,
  { ...part.defaults, bodyDiameter: 16, overallHeight: 30 },
  {
    ...part.defaults,
    bodyDiameter: 8,
    capDiameter: 5,
    collarDiameter: 6,
    baseDiameter: 5.5,
    overallHeight: 15,
    capHeight: 2,
  },
  {
    ...part.defaults,
    bodyDiameter: 30,
    capDiameter: 25,
    collarDiameter: 28,
    baseDiameter: 28,
    overallHeight: 60,
    capHeight: 35,
  },
];
for (const [i, p] of variants.entries())
  test(`exterior ${i}: declared envelope and fixed contacts`, () => {
    assert.deepEqual(validateParameters(part, p, 'exterior'), []);
    const group = part.buildGeometry(p, 'exterior');
    try {
      assert.equal(group.children.length, 4);
      const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
      bounds.forEach((v, k) => assert.ok(Math.abs(v - part.dimensions(p, 'exterior')[k]) < 1e-4));
      const pins = group.children.slice(2).map((o) => new Box3().setFromObject(o, true));
      for (const pin of pins) {
        const size = pin.getSize(new Vector3());
        assert.ok(Math.abs(size.x - 1) < 1e-5);
        assert.ok(Math.abs(size.z - 7.3) < 1e-5);
      }
      assert.ok(
        Math.abs(pins[1].getCenter(new Vector3()).x - pins[0].getCenter(new Vector3()).x - 4) <
          1e-6,
      );
      group.traverse((o) => {
        if (o instanceof Mesh)
          assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite));
      });
    } finally {
      disposeModel(group);
    }
  });
test('invalid exterior proportions and obsolete parameters fail clearly', () => {
  const invalid: Parameters[] = [
    { overallHeight: 15, capHeight: 10 },
    { capDiameter: 9 },
    { baseDiameter: 12 },
    { collarDiameter: 12 },
    { bodyDiameter: NaN },
    { model: 'user-envelope' },
  ];
  for (const values of invalid)
    assert.ok(validateParameters(part, { ...part.defaults, ...values }, 'exterior').length);
  assert.ok(part.validate(part.defaults, 'envelope').length);
});
test('source evidence distinguishes dimensioned envelope from illustrative contact geometry', () => {
  assert.equal(modelEvidence(part, part.defaults).kind, 'envelope');
  assert.deepEqual(part.presets[0].catalog?.verifiedParameters, ['bodyDiameter', 'overallHeight']);
  assert.match(part.notes!, /compatibility is not verified/);
  assert.equal(modelEvidence(part, { ...part.defaults, bodyDiameter: 12 }).kind, 'parametric');
});
