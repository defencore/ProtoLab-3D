import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { material } from './geometry';
import { triangulateSolid } from './jscad-triangulation';

/** Resolve primitive intersections and conform shared edges before STL export. */
export function solidUnionMesh(
  solid: Geom3,
  options: {
    minimumTriangleArea?: number;
    alreadyTriangulated?: boolean;
    edgeTolerance?: number;
    vertexTolerance?: number;
    preserveOrigin?: boolean;
  } = {},
): Group {
  const minimumCrossProductSquared = (2 * (options.minimumTriangleArea ?? 5e-8)) ** 2;
  const boundary = options.alreadyTriangulated ? solid : triangulateSolid(solid);
  const vertices: Vector3[] = [],
    vertexIds = new Map<string, number>();
  const rawTriangles: number[][] = [];
  for (const polygon of modeling.geometries.geom3.toPolygons(boundary)) {
    const triangle = polygon.vertices.map((point) => {
      const key = point
        .map((value) => Math.round(value / (options.vertexTolerance ?? 1e-8)))
        .join(',');
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
  const axes = ['x', 'y', 'z'] as const;
  const finiteCandidates = candidates.every((index) =>
    axes.every((axis) => Number.isFinite(vertices[index][axis])),
  );
  const candidateRank = new Map(candidates.map((index, rank) => [index, rank]));
  const axisIndexes = axes.map((axis) =>
    [...candidates].sort((a, b) => vertices[a][axis] - vertices[b][axis]),
  );
  const bound = (indexes: number[], axis: (typeof axes)[number], value: number, upper: boolean) => {
    let low = 0,
      high = indexes.length;
    while (low < high) {
      const middle = (low + high) >>> 1,
        coordinate = vertices[indexes[middle]][axis];
      if (coordinate < value || (upper && coordinate === value)) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const edgeTolerance = Math.abs(options.edgeTolerance ?? 1e-6);
  const refinements = new Map<string, number[]>();
  for (const [first, last] of openEdges) {
    const a = vertices[first],
      b = vertices[last],
      direction = vertices[last].clone().sub(a),
      lengthSq = direction.lengthSq();
    // Any point passing the original segment-distance test lies inside this box.
    // Roundoff padding keeps the prefilter conservative for translated coordinates;
    // it does not change the exact t/distance acceptance test below.
    let nearby = candidates;
    if (
      finiteCandidates &&
      Number.isFinite(edgeTolerance) &&
      Number.isFinite(lengthSq) &&
      lengthSq > 0
    ) {
      const ranges = axes.map((axis, index) => {
        const padding =
            edgeTolerance + 16 * Number.EPSILON * Math.max(1, Math.abs(a[axis]), Math.abs(b[axis])),
          minimum = Math.min(a[axis], b[axis]) - padding,
          maximum = Math.max(a[axis], b[axis]) + padding;
        return {
          axis,
          minimum,
          maximum,
          indexes: axisIndexes[index],
          first: bound(axisIndexes[index], axis, minimum, false),
          last: bound(axisIndexes[index], axis, maximum, true),
        };
      });
      const narrowest = ranges.reduce((a, b) => (b.last - b.first < a.last - a.first ? b : a));
      nearby = narrowest.indexes
        .slice(narrowest.first, narrowest.last)
        .filter((index) =>
          ranges.every(({ axis, minimum, maximum }) => {
            const coordinate = vertices[index][axis];
            return coordinate >= minimum && coordinate <= maximum;
          }),
        )
        // Equal t values must retain the original Set insertion order.
        .sort((a, b) => candidateRank.get(a)! - candidateRank.get(b)!);
    }
    const points = nearby
      .filter((index) => index !== first && index !== last)
      .map((index) => {
        const offset = vertices[index].clone().sub(a),
          t = offset.dot(direction) / lengthSq;
        return { index, t, distance: offset.addScaledVector(direction, -t).lengthSq() };
      })
      .filter(
        (point) =>
          point.t > 1e-7 &&
          point.t < 1 - 1e-7 &&
          point.distance < (options.edgeTolerance ?? 1e-6) ** 2,
      )
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
  const result = new Group().add(new Mesh(geometry, material(0x85898e)));
  if (options.preserveOrigin) result.position.copy(centre);
  return result;
}
export const { booleans, primitives, transforms } = modeling;
