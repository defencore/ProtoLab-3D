import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import needle from "../src/parts/needle-bearing/part";
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const envelopes = [
  { bore: 12, outer: 18, width: 16, elements: 12 },
  { bore: 16, outer: 22, width: 16, elements: 12 },
  { bore: 45, outer: 52, width: 20, elements: 12 },
  { bore: 1, outer: 3, width: 1, elements: 4 },
  { bore: 500, outer: 1000, width: 300, elements: 8 },
  { bore: 100, outer: 106, width: 1, elements: 64 },
];

function closedMesh(mesh: Mesh) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const vertices = [i, i + 1, i + 2].map((j) =>
      new Vector3().fromBufferAttribute(position, index ? index.getX(j) : j),
    );
    for (const vertex of vertices) assert.ok(vertex.toArray().every(Number.isFinite));
    assert.ok(
      vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).length() >
        1e-12,
    );
    volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
    const keys = vertices.map((vertex) =>
      vertex
        .toArray()
        .map((value) => Math.round(value * 1e5))
        .join(','),
    );
    for (let j = 0; j < 3; j++) {
      const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0, 'Component must have outward winding.');
  for (const count of edges.values())
    assert.equal(count, 2, 'Each welded mesh edge must have two faces.');
}

test('HK double lip seals fit behind the retaining rim and clear the shortened cage', () => {
  for (const parameters of envelopes) {
    const p = { ...parameters, seals: 'rubber' };
    for (const state of ['assembled', 'exploded']) {
      assert.deepEqual(validateParameters(needle, p, state), []);
      const model = needle.buildGeometry(p, state);
      try {
        assert.equal(model.children.length, parameters.elements + 4);
        const actual = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
        needle
          .dimensions(p, state)
          .forEach((value, axis) => assert.ok(Math.abs(value - actual[axis]) < 0.015));
        for (const mesh of model.children as Mesh[]) closedMesh(mesh);
        const cage = new Box3().setFromObject(model.children[1]);
        const seals = model.children.slice(-2).map((mesh) => new Box3().setFromObject(mesh));
        const offset = state === 'exploded' ? parameters.width * 0.9 : 0;
        assert.ok(seals[0].max.z < offset - parameters.width * 0.35);
        assert.ok(seals[1].min.z > offset + parameters.width * 0.35);
        if (state === 'assembled') {
          assert.ok(seals[0].max.z < cage.min.z);
          assert.ok(seals[1].min.z > cage.max.z);
        }
        const lip = model.children.at(-1) as Mesh;
        const positions = lip.geometry.getAttribute('position');
        let minimumRadius = Infinity;
        for (let i = 0; i < positions.count; i++)
          minimumRadius = Math.min(minimumRadius, Math.hypot(positions.getX(i), positions.getY(i)));
        assert.ok(
          Math.abs(minimumRadius - parameters.bore / 2) < 0.0001,
          'The lip must meet the shaft envelope without closing the bore.',
        );
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('Needle defaults stay open while catalog presets preserve their seal construction', () => {
  assert.equal(needle.defaults.seals, 'open');
  for (const preset of needle.presets) {
    const designation = preset.catalog?.designation ?? preset.name;
    const sealed = /(?:2RS|LL)(?:\/|\s|$)/i.test(designation);
    assert.equal(preset.parameters.seals, sealed ? 'rubber' : 'open', designation);
  }
  assert.ok(needle.presets.some((preset) => preset.parameters.seals === 'rubber'));
  assert.deepEqual(needle.dimensions(needle.defaults, 'exploded'), [10, 10, 14.928]);
  const open = needle.buildGeometry(needle.defaults, 'assembled');
  const sealed = needle.buildGeometry({ ...needle.defaults, seals: 'rubber' }, 'assembled');
  try {
    assert.equal(sealed.children.length, open.children.length + 2);
    assert.ok(
      new Box3().setFromObject(sealed.children[1]).getSize(new Vector3()).z <
        new Box3().setFromObject(open.children[1]).getSize(new Vector3()).z,
    );
  } finally {
    disposeModel(open);
    disposeModel(sealed);
  }
  assert.ok(validateParameters(needle, { ...needle.defaults, seals: 'metal' }, 'assembled').length);
});
