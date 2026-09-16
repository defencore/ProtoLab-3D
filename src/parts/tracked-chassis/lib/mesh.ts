import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { material } from '../../../core/geometry';

/** Repair CSG T-junctions before producing connected preview meshes. */
export function solidUnionMesh(
  solid: Geom3,
  options: { minimumTriangleArea?: number } = {},
): Group {
  const minimumCrossProductSquared = (2 * (options.minimumTriangleArea ?? 5e-8)) ** 2;
  // Upstream 2.13 declares generalize as a module although its runtime export is callable.
  const generalize = modeling.modifiers.generalize as unknown as (
    options: { triangulate: boolean },
    value: Geom3,
  ) => Geom3;
  const boundary = generalize({ triangulate: true }, solid);
  const vertices: Vector3[] = [],
    vertexIds = new Map<string, number>();
  const rawTriangles: number[][] = [];
  for (const polygon of modeling.geometries.geom3.toPolygons(boundary)) {
    const triangle = polygon.vertices.map((point) => {
      const key = point.map((value) => Math.round(value * 1e8)).join(',');
      let index = vertexIds.get(key);
      if (index === undefined) {
        index = vertices.length;
        vertices.push(new Vector3(...point));
        vertexIds.set(key, index);
      }
      return index;
    });
    const [a, b, c] = triangle.map((index) => vertices[index]);
    if (
      new Set(triangle).size === 3 &&
      b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > minimumCrossProductSquared
    )
      rawTriangles.push(triangle);
  }
  const coincident = new Map<string, { triangle: number[]; balance: number }>();
  for (const triangle of rawTriangles) {
    const key = [...triangle].sort((a, b) => a - b).join(':');
    const first = triangle.indexOf(Math.min(...triangle));
    const sign = triangle[(first + 1) % 3] < triangle[(first + 2) % 3] ? 1 : -1;
    const group = coincident.get(key) ?? { triangle, balance: 0 };
    group.balance += sign;
    coincident.set(key, group);
  }
  const triangles = [...coincident.values()]
    .filter((group) => group.balance !== 0)
    .map(({ triangle, balance }) => {
      const first = triangle.indexOf(Math.min(...triangle));
      const sign = triangle[(first + 1) % 3] < triangle[(first + 2) % 3] ? 1 : -1;
      return Math.sign(balance) === sign ? triangle : [...triangle].reverse();
    });
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const edges = new Map<string, number>();
  for (const triangle of triangles)
    for (let side = 0; side < 3; side++) {
      const key = edgeKey(triangle[side], triangle[(side + 1) % 3]);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const openEdges = [...edges]
    .filter(([, count]) => count === 1)
    .map(([key]) => key.split(':').map(Number));
  const candidates = [...new Set(openEdges.flat())];
  const refinements = new Map<string, number[]>();
  for (const [first, last] of openEdges) {
    const a = vertices[first],
      direction = vertices[last].clone().sub(a),
      lengthSq = direction.lengthSq();
    const points = candidates
      .filter((index) => index !== first && index !== last)
      .map((index) => {
        const offset = vertices[index].clone().sub(a),
          t = offset.dot(direction) / lengthSq;
        return { index, t, distance: offset.addScaledVector(direction, -t).lengthSq() };
      })
      .filter((point) => point.t > 1e-7 && point.t < 1 - 1e-7 && point.distance < 1e-4)
      .sort((a, b) => a.t - b.t);
    if (points.length)
      refinements.set(edgeKey(first, last), [first, ...points.map((point) => point.index), last]);
  }
  const positions: number[] = [];
  for (const triangle of triangles) {
    const outline: number[] = [];
    for (let side = 0; side < 3; side++) {
      const a = triangle[side],
        b = triangle[(side + 1) % 3],
        refinement = refinements.get(edgeKey(a, b));
      const ordered = refinement
        ? refinement[0] === a
          ? refinement
          : [...refinement].reverse()
        : [a, b];
      outline.push(...ordered.slice(0, -1));
    }
    if (outline.length === 3)
      positions.push(...triangle.flatMap((index) => vertices[index].toArray()));
    else {
      const centre = triangle
        .reduce((sum, index) => sum.add(vertices[index]), new Vector3())
        .multiplyScalar(1 / 3);
      for (let side = 0; side < outline.length; side++)
        positions.push(
          ...centre.toArray(),
          ...vertices[outline[side]].toArray(),
          ...vertices[outline[(side + 1) % outline.length]].toArray(),
        );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox!.getCenter(new Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  geometry.computeVertexNormals();
  return new Group().add(new Mesh(geometry, material(0x85898e)));
}
export const { booleans, primitives, transforms } = modeling;
