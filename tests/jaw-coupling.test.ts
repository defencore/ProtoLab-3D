import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from "../src/parts/jaw-coupling/part";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('D25 L30 reference includes every unique visible bore pair without inventing internal dimensions', () => {
  assert.equal(part.presets.length, 38);
  assert.equal(
    new Set(part.presets.map((p) => `${p.parameters.boreA}/${p.parameters.boreB}`)).size,
    38,
  );
  for (const preset of part.presets) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembly'), []);
    assert.deepEqual(preset.catalog!.verifiedParameters, [
      'outerDiameter',
      'length',
      'boreA',
      'boreB',
    ]);
    assert.equal(preset.catalog!.sourceKind, 'attachment');
    assert.equal(preset.parameters.outerDiameter, 25);
    assert.equal(preset.parameters.length, 30);
  }
});

test('jaw coupling component states have closed outward meshes and independent bores at the size boundaries', () => {
  for (const [boreA, boreB] of [
    [5, 5],
    [14, 14],
    [5, 14],
    [12.7, 6.35],
  ]) {
    const p = { ...part.defaults, boreA, boreB };
    for (const state of part.states!) {
      const model = part.buildGeometry(p, state.id);
      try {
        const bounds = new Box3().setFromObject(model, true);
        assert.ok(bounds.getCenter(new Vector3()).length() < 1e-5);
        const dimensions = bounds.getSize(new Vector3()).toArray();
        part
          .dimensions(p, state.id)
          .forEach((d, i) => assert.ok(Math.abs(d - dimensions[i]) < 0.001));
        if (state.id === 'assembly')
          dimensions.forEach((d, i) => assert.ok(Math.abs(d - [25, 25, 30][i]) < 0.001));
        let meshes = 0;
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          meshes++;
          const positions = child.geometry.getAttribute('position'),
            indices = child.geometry.getIndex();
          const edges = new Map<string, number>();
          let volume = 0;
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            const vertices = [0, 1, 2].map((j) =>
              new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
            );
            assert.ok(
              vertices[1]
                .clone()
                .sub(vertices[0])
                .cross(vertices[2].clone().sub(vertices[0]))
                .lengthSq() > 1e-18,
            );
            volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
            const keys = vertices.map((v) =>
              v
                .toArray()
                .map((x) => Math.round(x * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0);
          for (const [edge, uses] of edges)
            assert.equal(uses, 2, `${state.id} ${boreA}/${boreB}: ${edge}`);
        });
        assert.equal(meshes, state.id === 'spider' ? 1 : state.id.startsWith('hub-') ? 2 : 5);
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('invalid couplings are rejected before the clamps or spider break into the shaft bore', () => {
  const changes: Parameters[] = [
    { boreA: 18 },
    { length: 15 },
    { jawDepth: 9 },
    { headDiameter: 8 },
    { slitWidth: 3 },
    { axialClearance: 2 },
  ];
  for (const change of changes)
    assert.ok(validateParameters(part, { ...part.defaults, ...change }, 'assembly').length > 0);
});
