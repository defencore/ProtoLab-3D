import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import part from "../src/parts/cotter-pin/part";
import inventory from '../src/catalog/data/gvyntok-shplinty-i-strubtsiny.json';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { geometrySamples } from './catalog-samples';

test('all 141 DIN 94 supplier SKUs have complete presets and valid installation states', () => {
  const source = inventory.products.filter((row) => row.standard === 'DIN 94');
  assert.equal(source.length, 141);
  assert.equal(part.presets.length, 141);
  for (const row of source) {
    const preset = part.presets.find((candidate) =>
      candidate.catalog?.productCodes?.includes(row.sku),
    );
    assert.ok(preset, row.sku);
    assert.equal(preset.parameters.diameter, row.diameter);
    assert.equal(preset.parameters.length, row.length);
    assert.equal(preset.catalog?.sourceUrl, row.url);
    for (const state of part.states!)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${row.sku}/${state.id}`,
      );
  }
});

test('cotter pin size boundaries and bent legs keep one closed outward shell', () => {
  for (const preset of geometrySamples(part)) {
    for (const state of part.states!) {
      const label = `${preset.id}/${state.id}`;
      const model = part.buildGeometry(preset.parameters, state.id);
      const bounds = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
      assert.equal(model.children.length, 1);
      part
        .dimensions(preset.parameters, state.id)
        .forEach((length, axis) => assert.ok(Math.abs(bounds[axis] - length) < 1e-5, label));
      const mesh = model.children[0] as Mesh;
      const position = mesh.geometry.getAttribute('position');
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < position.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((offset) =>
          new Vector3().fromBufferAttribute(position, i + offset),
        );
        assert.ok(
          b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
          `${label}: nondegenerate faces`,
        );
        volume += a.dot(b.clone().cross(c)) / 6;
        const ids = [a, b, c].map((point) =>
          point
            .toArray()
            .map((value) => Math.round(value * 1e5))
            .join(','),
        );
        for (let j = 0; j < 3; j++) {
          const key = [ids[j], ids[(j + 1) % 3]].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.ok(volume > 0, `${label}: outward shell`);
      for (const count of edges.values()) assert.equal(count, 2, `${label}: manifold edges`);
      disposeModel(model);
    }
  }
});

test('cotter pin dimensions distinguish nominal hole and actual shank', () => {
  const preset = part.presets.find((candidate) => candidate.catalog?.designation === 'DIN 94 4 × 32')!;
  assert.equal(preset.parameters.shankDiameter, 3.7);
  assert.equal(preset.parameters.eyeLength, 8);
  assert.equal(preset.parameters.eyeWidth, 7.4);
  assert.equal(preset.parameters.tailExtension, 2);
  const dimensions = part.dimensions(preset.parameters, 'straight');
  assert.ok(Math.abs(dimensions[0] - 7.4) < 1e-5);
  assert.ok(Math.abs(dimensions[2] - 42) < 1e-5);
  assert.ok(validateParameters(part, { ...preset.parameters, bendRadius: 30 }, 'bent').length > 0);
});
