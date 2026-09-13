import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import ball from "../src/parts/ball-bearing/part";
import flange2 from "../src/parts/flange-2-bolt-bearing/part";
import flange4 from "../src/parts/flange-4-bolt-bearing/part";
import worm, { wormValues } from "../src/parts/worm-drive/part";
import profileGuide from "../src/parts/linear-guide/part";
import roundGuide from "../src/parts/round-linear-guide/part";
import { profileCircuit, roundCircuit } from "../src/parts/linear-bearing/lib/parts/guide-circuits";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

for (const part of [flange2, flange4, worm])
  test(`${part.id}: closed outward meshes, dimensions and default variants`, () => {
    const samples = [part.defaults, ...part.presets.map((preset) => preset.parameters)];
    for (const parameters of samples)
      for (const state of part.states?.map((state) => state.id) ?? ['default']) {
        assert.deepEqual(validateParameters(part, parameters, state), []);
        const model = part.buildGeometry(parameters, state);
        try {
          const size = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
          part
            .dimensions(parameters, state)
            .forEach((length, axis) => assert.ok(Math.abs(size[axis] - length) < 0.025));
          model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            const positions = child.geometry.getAttribute('position'),
              index = child.geometry.getIndex(),
              edges = new Map<string, number>();
            let volume = 0;
            for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
              const v = [i, i + 1, i + 2].map((j) =>
                new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
              );
              assert.ok(v.every((point) => point.toArray().every(Number.isFinite)));
              assert.ok(
                v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length() > 1e-9,
                `${part.id}: collapsed triangle`,
              );
              volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
              const keys = v.map((point) =>
                point
                  .toArray()
                  .map((value) => Math.round(value * 1e5))
                  .join(','),
              );
              for (let side = 0; side < 3; side++) {
                const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
                edges.set(key, (edges.get(key) ?? 0) + 1);
              }
            }
            assert.ok(volume > 0, `${part.id}: reversed component`);
            for (const count of edges.values())
              assert.equal(count, 2, `${part.id}: nonmanifold edge`);
          });
        } finally {
          disposeModel(model);
        }
      }
  });

test('ball bearings distinguish open, single-closure and double-closure constructions', () => {
  const models = ['open', 'metal-one', 'rubber-one', 'metal', 'rubber'].map((seals) =>
    ball.buildGeometry({ ...ball.defaults, seals }, 'assembled'),
  );
  try {
    const count = models[0].children.length;
    assert.equal(models[1].children.length, count + 1);
    assert.equal(models[2].children.length, count + 1);
    assert.equal(models[3].children.length, count + 2);
    assert.equal(models[4].children.length, count + 2);
  } finally {
    models.forEach(disposeModel);
  }
});

test('guide ball circuits include separated loaded and return rows with no overlapping balls', () => {
  for (const part of [profileGuide, roundGuide]) assert.equal(part.states?.[0].id, 'assembled');
  for (const part of [profileGuide, roundGuide])
    for (const preset of part.presets) {
      const v =
        part === profileGuide ? profileCircuit(preset.parameters) : roundCircuit(preset.parameters);
      assert.ok(v.points.length > 40);
      for (let i = 0; i < v.points.length; i++)
        for (let j = i + 1; j < v.points.length; j++)
          assert.ok(
            v.points[i].distanceTo(v.points[j]) > v.radius * 2,
            `${part.id}/${preset.id}: intersecting return balls`,
          );
      assert.ok(v.returned > v.loaded + 2 * v.radius);
      assert.ok(part.states?.some((state) => state.id === 'cutaway'));
    }
});

test('worm pitch, starts and wheel ratio use the axial-module relationship', () => {
  for (const preset of worm.presets) {
    const v = wormValues(preset.parameters);
    assert.equal(v.pitch, Math.PI * v.m);
    assert.equal(v.lead, v.pitch * v.starts);
    assert.ok(v.halfTip > 0 && v.halfTip < v.halfRoot && v.halfRoot < v.pitch / 2);
    assert.ok(Math.abs(2 * v.wheel.pitchRadius - v.teeth * v.m) < 1e-9);
    assert.ok(Math.abs(Math.tan(v.gamma) - v.lead / (2 * Math.PI * v.wormR)) < 1e-9);
  }
  assert.equal(
    wormValues(worm.presets[0].parameters).teeth / wormValues(worm.presets[0].parameters).starts,
    40,
  );
  assert.equal(
    wormValues(worm.presets[1].parameters).teeth / wormValues(worm.presets[1].parameters).starts,
    20,
  );
});
