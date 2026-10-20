import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import modeling from '@jscad/modeling';
import type { Geom3, Poly3 } from '@jscad/modeling/src/geometries/types';
import { insertTjunctions, triangulateSolid } from '../src/core/jscad-triangulation';

const require = createRequire(import.meta.url);
const upstreamInsert = require('@jscad/modeling/src/operations/modifiers/insertTjunctions') as (
  polygons: Poly3[],
) => Poly3[];
const upstreamGeneralize = modeling.modifiers.generalize as unknown as (
  options: { triangulate: boolean },
  solid: Geom3,
) => Geom3;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
type Point = [number, number, number];

function junction(translation: Point = [0, 0, 0], acute = false): Geom3 {
  const a: Point = [0, 0, 0],
    b: Point = acute ? [200, 0.001, 0.002] : [2, 0, 0],
    m: Point = acute ? [74, 0.00037, 0.00074] : [1, 0, 0],
    c: Point = [0, 2, 0],
    d: Point = [0, 0, 2];
  return modeling.geometries.geom3.create(
    [
      [a, c, b],
      [a, m, d],
      [m, b, d],
      [a, d, c],
      [b, c, d],
    ].map((face) =>
      modeling.geometries.poly3.create(
        face.map((p) => p.map((n, i) => n + translation[i]) as Point),
      ),
    ),
  );
}

const controls: [string, () => Geom3][] = [
  ['empty geometry', () => modeling.geometries.geom3.create()],
  ['authored closed T-junction', () => junction()],
  ['translated T-junction', () => junction([100, -200, 300])],
  ['acute T-junction', () => junction([0, 0, 0], true)],
  ['convex cuboid', () => modeling.primitives.cuboid({ size: [3, 5, 7] })],
  [
    'touching cuboid union',
    () =>
      modeling.booleans.union(
        modeling.primitives.cuboid({ size: [2, 2, 2] }),
        modeling.primitives.cuboid({ size: [2, 2, 2], center: [2, 0, 0] }),
      ),
  ],
  [
    'lazy rotated and translated cylinder',
    () =>
      modeling.transforms.translate(
        [13.25, -27.5, 9],
        modeling.transforms.rotate(
          [0.2, 0.4, -0.7],
          modeling.primitives.cylinder({ radius: 3, height: 5, segments: 9 }),
        ),
      ),
  ],
];
for (const [label, build] of controls) {
  test(`owned JSCAD triangulation exactly matches upstream polygons and properties for ${label}`, () => {
    const original = build();
    const polygons = clone(modeling.geometries.geom3.toPolygons(clone(original)));
    assert.equal(
      JSON.stringify(insertTjunctions(clone(polygons))),
      JSON.stringify(upstreamInsert(clone(polygons))),
    );
    assert.equal(
      JSON.stringify(triangulateSolid(clone(original))),
      JSON.stringify(upstreamGeneralize({ triangulate: true }, clone(original))),
    );
  });
}

for (const count of [3, 4, 7]) {
  test(`triangulation retains the ${count}-vertex colored convex face and upstream midpoint snapping`, () => {
    const polygon = modeling.geometries.poly3.create(
      Array.from(
        { length: count },
        (_, i) =>
          [
            1.234567 + 3 * Math.cos((i * 2 * Math.PI) / count),
            2.345678 + 3 * Math.sin((i * 2 * Math.PI) / count),
            0.1234567,
          ] as Point,
      ),
    );
    polygon.color = [0.2, 0.4, 0.6, 0.8];
    const solid = modeling.geometries.geom3.create([polygon]);
    const result = triangulateSolid(solid);
    const expected = upstreamGeneralize({ triangulate: true }, clone(solid));
    assert.equal(JSON.stringify(result), JSON.stringify(expected));
    assert.equal(result.polygons.length, count === 3 ? 1 : count === 4 ? 2 : 7);
    for (const triangle of result.polygons) assert.deepEqual(triangle.color, polygon.color);
    if (count === 3) assert.equal(result.polygons[0], polygon);
  });
}

test('known T-junction is inserted into its spanning face and the surface encloses the independent volume', () => {
  const solid = junction();
  const polygons = insertTjunctions(solid.polygons);
  assert.equal(polygons.length, 5);
  assert.equal(polygons[0].vertices.length, 4);
  assert.ok(polygons[0].vertices.some((p) => p[0] === 1 && p[1] === 0 && p[2] === 0));
  const result = triangulateSolid(solid);
  let volume = 0;
  const edges = new Map<string, number>();
  const { vec3 } = modeling.maths;
  for (const {
    vertices: [a, b, c],
  } of result.polygons) {
    volume += vec3.dot(a, vec3.cross(vec3.create(), b, c)) / 6;
    for (const [start, end] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const edge = [start.join(','), end.join(',')].sort().join(':');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(Math.abs(volume - 4 / 3) < 1e-12);
  assert.ok([...edges.values()].every((count) => count === 2));
});
