import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import module from '../src/parts/rf-pigtail';
import { disposeModel } from '../src/core/mechanical';

const part = module.part;
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.0002, `${actual} ~= ${expected}`);

test('RF pigtail retains its complete purchased identity and limits installation settings', () => {
  assert.deepEqual(part.validate(part.defaults, 'assembled'), []);
  assert.ok(part.validate({ ...part.defaults, panelThickness: 3 }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, cableLength: 50 }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, model: 'rp-sma' }, 'assembled').length);
  assert.equal(part.product?.supply, 'purchased');
  assert.equal(part.presets[0].catalog?.designation, '095-902-545-100');
  assert.match(part.notes ?? '', /Not manufacturer CAD/);
  assert.ok(part.sources?.some((source) => source.url?.endsWith('/4068032676/')));
});

test('RF pigtail preserves its outward datum and places hardware behind the panel', () => {
  for (const thickness of [0.8, 2.2, 2.3]) {
    const parameters = { ...part.defaults, panelThickness: thickness };
    const group = part.buildGeometry(parameters, 'assembled');
    try {
      group.updateMatrixWorld(true);
      assert.equal(group.children.length, 6);
      const bounds = new Box3().setFromObject(group, true);
      close(bounds.min.z, -10.01);
      close(bounds.max.z, 8.49);
      const size = bounds.getSize(new Vector3()).toArray();
      part.dimensions(parameters, 'assembled').forEach((value, i) => close(value, size[i]));
      const washer = new Box3().setFromObject(
        group.children.find((piece) => /Inner lock washer/.test(piece.name))!,
        true,
      );
      const nut = new Box3().setFromObject(
        group.children.find((piece) => /Inner retaining nut/.test(piece.name))!,
        true,
      );
      const seal = new Box3().setFromObject(
        group.children.find((piece) => /Compressed O-ring/.test(piece.name))!,
        true,
      );
      close(washer.max.z, -thickness);
      close(nut.max.z, washer.min.z);
      close(seal.min.z, 0);
      close(seal.max.z, 0.4);
      assert.ok(
        group.children.every((piece) => !/AMC plug|heatshrink|cable route/.test(piece.name)),
      );
    } finally {
      disposeModel(group);
    }
  }
});

test('RF bulkhead solids have closed positive preview boundaries in both hardware views', () => {
  for (const state of ['assembled', 'exploded']) {
    const group = part.buildGeometry(part.defaults, state);
    try {
      group.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const positions = item.geometry.getAttribute('position');
        const index = item.geometry.index;
        const edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const vertices = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j),
          );
          volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
          const keys = vertices.map((vertex) =>
            vertex
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${item.name}: positive volume`);
        assert.ok(
          [...edges.values()].every((count) => count === 2),
          `${item.name}: closed mesh`,
        );
      });
    } finally {
      disposeModel(group);
    }
  }
});
