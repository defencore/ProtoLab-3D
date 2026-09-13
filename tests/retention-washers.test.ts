import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import split from "../src/parts/split-lock-washer/part";
import eRing from "../src/parts/e-ring/part";
import { retentionWasherExclusions } from '../src/catalog/retention-washers';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

for (const part of [split, eRing])
  test(`${part.id}: reference presets export closed outward components with exact bounds`, () => {
    for (const preset of part.presets)
      for (const state of part.states?.map((s) => s.id) ?? ['default']) {
        assert.deepEqual(validateParameters(part, preset.parameters, state), []);
        const model = part.buildGeometry(preset.parameters, state);
        try {
          const actual = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
          part
            .dimensions(preset.parameters, state)
            .forEach((d, axis) => assert.ok(Math.abs(actual[axis] - d) < 0.025));
          assert.equal(model.children.length, 1);
          model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            const p = child.geometry.getAttribute('position'),
              ix = child.geometry.getIndex(),
              edges = new Map<string, number>();
            let volume = 0;
            for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
              const v = [i, i + 1, i + 2].map((j) =>
                new Vector3().fromBufferAttribute(p, ix ? ix.getX(j) : j),
              );
              assert.ok(v.every((p) => p.toArray().every(Number.isFinite)));
              assert.ok(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length() > 1e-10);
              volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
              const keys = v.map((p) =>
                p
                  .toArray()
                  .map((n) => Math.round(n * 1e6))
                  .join(','),
              );
              for (let side = 0; side < 3; side++) {
                const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
                edges.set(key, (edges.get(key) ?? 0) + 1);
              }
            }
            assert.ok(volume > 0);
            for (const count of edges.values()) assert.equal(count, 2);
            if (part === split) {
              const p = preset.parameters,
                arc = 2 * Math.PI * (1 - Number(p.gapAngle) / 360);
              const expected =
                (arc / 8) *
                (Number(p.outerDiameter) ** 2 - Number(p.innerDiameter) ** 2) *
                Number(p.thickness);
              assert.ok(Math.abs(volume - expected) / expected < 0.001);
            }
          });
        } finally {
          disposeModel(model);
        }
      }
  });

test('supplier sizes stay separate from unverified profile reference dimensions', () => {
  assert.equal(split.presets.length, 24);
  assert.equal(eRing.presets.length, 16);
  assert.equal(
    split.presets.reduce((n, p) => n + p.catalog!.productCodes!.length, 0),
    45,
  );
  assert.equal(
    eRing.presets.reduce((n, p) => n + p.catalog!.productCodes!.length, 0),
    16,
  );
  for (const p of split.presets) {
    assert.deepEqual(p.catalog!.verifiedParameters, ['diameter']);
    assert.equal(p.catalog!.standard, undefined);
  }
  for (const p of eRing.presets)
    assert.deepEqual(p.catalog!.verifiedParameters, ['grooveDiameter']);
  assert.deepEqual(retentionWasherExclusions.map((p) => p.sku).sort(), [
    '060-260-018',
    '060-290-019',
    '060-400-004-1',
  ]);
});
