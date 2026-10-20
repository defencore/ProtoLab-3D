import assert from 'node:assert/strict';
import test from 'node:test';
import modeling from '@jscad/modeling';
import { Box3, Mesh, Vector3 } from 'three';
import { solidUnionMesh } from '../src/core/solid-union';

type Point = [number, number, number];
function tetrahedron(end: Point, middle: Point, translation: Point = [0, 0, 0]) {
  const a: Point = [0, 0, 0],
    c: Point = [0, 2, 0],
    d: Point = [0, 0, 2];
  const faces = [
    [a, c, end],
    [a, middle, d],
    [middle, end, d],
    [a, d, c],
    [end, c, d],
  ];
  return modeling.geometries.geom3.create(
    faces.map((face) =>
      modeling.geometries.poly3.create(
        face.map((point) => point.map((n, i) => n + translation[i]) as Point),
      ),
    ),
  );
}
function topology(model: ReturnType<typeof solidUnionMesh>) {
  const geometry = (model.children[0] as Mesh).geometry;
  const p = geometry.getAttribute('position');
  const edges = new Map<string, number>();
  let volume = 0;
  const key = (v: Vector3) =>
    v
      .toArray()
      .map((n) => Math.round(n / 1e-6))
      .join(',');
  for (let i = 0; i < p.count; i += 3) {
    const points = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(p, i + j));
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    for (let j = 0; j < 3; j++) {
      const edge = [key(points[j]), key(points[(j + 1) % 3])].sort().join(':');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  return {
    triangles: p.count / 3,
    volume,
    unpaired: [...edges.values()].filter((n) => n !== 2).length,
  };
}
for (const translation of [
  [0, 0, 0],
  [100, -200, 300],
] as Point[]) {
  test(`solid union closes an authored T-junction without changing tetrahedron volume at ${translation}`, () => {
    const model = solidUnionMesh(tetrahedron([2, 0, 0], [1, 0, 0], translation), {
      alreadyTriangulated: true,
      edgeTolerance: 1e-6,
      preserveOrigin: true,
    });
    const result = topology(model);
    assert.equal(result.triangles, 8);
    assert.equal(result.unpaired, 0);
    assert.ok(Math.abs(result.volume - 4 / 3) < 1e-6);
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true);
    assert.deepEqual(bounds.min.toArray(), translation);
    assert.deepEqual(
      bounds.max.toArray(),
      translation.map((n) => n + 2),
    );
  });
}
test('solid union retains the closed acute diagonal edge and its independently calculated volume', () => {
  const model = solidUnionMesh(tetrahedron([200, 0.001, 0.002], [74, 0.00037, 0.00074]), {
    alreadyTriangulated: true,
    edgeTolerance: 1e-6,
  });
  const result = topology(model);
  assert.equal(result.triangles, 8);
  assert.equal(result.unpaired, 0);
  assert.ok(Math.abs(result.volume - (200 * 2 * 2) / 6) < 1e-4);
});
for (const [distance, triangles] of [
  [0.999e-6, 8],
  [1e-6, 5],
  [1.001e-6, 5],
]) {
  test(`solid union keeps the original strict junction distance at ${distance}`, () => {
    const model = solidUnionMesh(tetrahedron([2, 0, 0], [1, distance, 0]), {
      alreadyTriangulated: true,
      edgeTolerance: 1e-6,
    });
    assert.equal(topology(model).triangles, triangles);
  });
}

test('solid union preserves original candidate order when two junctions have equal segment projection', () => {
  const a: Point = [0, 0, 0],
    b: Point = [2, 0, 0],
    c: Point = [0, 2, 0],
    d: Point = [0, 0, 2];
  const first: Point = [1, 2e-7, 0],
    second: Point = [1, -2e-7, 0];
  const solid = modeling.geometries.geom3.create(
    [
      [a, c, b],
      [a, first, d],
      [first, second, d],
      [second, b, d],
      [a, d, c],
      [b, c, d],
    ].map((face) => modeling.geometries.poly3.create(face)),
  );
  const mesh = solidUnionMesh(solid, { alreadyTriangulated: true, edgeTolerance: 1e-6 })
    .children[0] as Mesh;
  const p = mesh.geometry.getAttribute('position');
  assert.equal(p.count / 3, 10);
  // The original bottom-face traversal is B -> second -> first -> A.
  assert.ok(p.getY(8) < -1);
  assert.ok(p.getY(10) < -1);
  assert.ok(p.getY(11) > -1);
  assert.ok(p.getY(13) > -1);
});
