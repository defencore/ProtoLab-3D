import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { outline } from './shapes';

type Button = { y: number; z: number };
type Plane = { y: number; z: number; dy: number; dz: number; length: number };
export const bezelSeat = {
  width: 15.5,
  cornerRadius: 1.1,
  shoulderFront: 23.2,
  lipRadius: 0.5,
};
const epsilon = 1e-8;
const key = (point: Vec) => point.map((value) => Math.round(value / epsilon)).join(',');
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Author the bezel recesses in the front skin instead of subtracting a cutter
 * through thousands of nearly coplanar Boolean faces. The original X21 panel
 * remains behind each pocket for the separate keyed switch mounting opening. */
export function applyBezelPockets(
  sourcePoints: Vec[],
  shellFaces: number[][],
  frontFaces: number[][],
  buttons: Button[],
): Shape {
  const points: Vec[] = [],
    pointIds = new Map<string, number>();
  const intern = (point: Vec) => {
    const id = pointIds.get(key(point));
    if (id !== undefined) return id;
    const next = points.length;
    points.push(point);
    pointIds.set(key(point), next);
    return next;
  };
  const sourceIds = sourcePoints.map(intern),
    mappedShell = shellFaces.map((face) => face.map((id) => sourceIds[id]));
  const holes = buttons.map((button) => {
    const loop = outline(
      bezelSeat.width,
      bezelSeat.width,
      bezelSeat.cornerRadius,
      button.y,
      button.z,
    );
    return {
      button,
      loop,
      planes: loop.map(([y, z], i): Plane => {
        const next = loop[(i + 1) % loop.length],
          dy = next[0] - y,
          dz = next[1] - z;
        return { y, z, dy, dz, length: Math.hypot(dy, dz) };
      }),
    };
  });
  const distance = (point: Vec, plane: Plane) => {
    const value =
      (plane.dy * (point[2] - plane.z) - plane.dz * (point[1] - plane.y)) / plane.length;
    return Math.abs(value) < 1e-10 ? 0 : value;
  };
  const clean = (polygon: number[]) =>
    polygon.filter((id, i) => id !== polygon[(i + polygon.length - 1) % polygon.length]);
  const hasArea = (polygon: number[]) =>
    polygon.length >= 3 &&
    Math.abs(
      polygon.reduce((area, id, i) => {
        const a = points[id],
          b = points[polygon[(i + 1) % polygon.length]];
        return area + a[1] * b[2] - b[1] * a[2];
      }, 0),
    ) > 1e-13;
  const split = (polygon: number[], plane: Plane) => {
    const inside: number[] = [],
      outside: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        da = distance(points[a], plane),
        db = distance(points[b], plane);
      if (da >= 0) inside.push(a);
      if (da <= 0) outside.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
        const t = da / (da - db),
          id = intern(points[a].map((value, axis) => value + t * (points[b][axis] - value)) as Vec);
        inside.push(id);
        outside.push(id);
      }
    }
    return { inside: clean(inside), outside: clean(outside) };
  };
  let polygons = frontFaces.map((face) => face.map((id) => sourceIds[id]));
  for (const hole of holes) {
    const next: number[][] = [];
    for (const polygon of polygons) {
      const ys = polygon.map((id) => points[id][1]),
        zs = polygon.map((id) => points[id][2]);
      if (
        Math.max(...ys) < hole.button.y - 7.75 ||
        Math.min(...ys) > hole.button.y + 7.75 ||
        Math.max(...zs) < hole.button.z - 7.75 ||
        Math.min(...zs) > hole.button.z + 7.75
      ) {
        next.push(polygon);
        continue;
      }
      let remaining = polygon;
      for (const plane of hole.planes) {
        if (!hasArea(remaining)) break;
        const divided = split(remaining, plane);
        if (hasArea(divided.outside)) next.push(divided.outside);
        remaining = divided.inside;
      }
    }
    polygons = next;
  }

  // Clipping can split an edge in only one neighboring polygon. Conform all
  // front and shell edges before triangulation, including artificial partition
  // edges between outside pieces. A Y/Z spatial index keeps the lookup local.
  const cells = new Map<string, number[]>(),
    cellKey = (y: number, z: number) => `${y}:${z}`;
  points.forEach((point, id) => {
    const cell = cellKey(Math.floor(point[1]), Math.floor(point[2]));
    cells.set(cell, [...(cells.get(cell) ?? []), id]);
  });
  const splits = new Map<string, number[]>();
  const refine = (face: number[]) => {
    const boundary: number[] = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length],
        edge = edgeKey(a, b);
      let ids = splits.get(edge);
      if (!ids) {
        const start = points[a],
          end = points[b],
          vector = end.map((value, axis) => value - start[axis]),
          squaredLength = vector.reduce((sum, value) => sum + value * value, 0),
          candidates: { id: number; t: number }[] = [];
        for (
          let y = Math.floor(Math.min(start[1], end[1]) - epsilon);
          y <= Math.floor(Math.max(start[1], end[1]) + epsilon);
          y++
        )
          for (
            let z = Math.floor(Math.min(start[2], end[2]) - epsilon);
            z <= Math.floor(Math.max(start[2], end[2]) + epsilon);
            z++
          )
            for (const id of cells.get(cellKey(y, z)) ?? []) {
              if (id === a || id === b) continue;
              const offset = points[id].map((value, axis) => value - start[axis]),
                t =
                  offset.reduce((sum, value, axis) => sum + value * vector[axis], 0) /
                  squaredLength;
              if (t <= 1e-10 || t >= 1 - 1e-10) continue;
              const error = offset.reduce(
                (sum, value, axis) => sum + (value - t * vector[axis]) ** 2,
                0,
              );
              if (error < epsilon ** 2) candidates.push({ id, t });
            }
        ids = [a, ...candidates.sort((left, right) => left.t - right.t).map(({ id }) => id), b];
        splits.set(edge, ids);
      }
      boundary.push(...(ids[0] === a ? ids : [...ids].reverse()).slice(0, -1));
    }
    return clean(boundary);
  };
  const refinedFront = polygons.map(refine),
    refinedShell = mappedShell.map(refine),
    edges = new Map<string, { a: number; b: number; count: number }>();
  for (const face of refinedFront)
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length],
        edge = edgeKey(a, b),
        value = edges.get(edge) ?? { a, b, count: 0 };
      value.count++;
      edges.set(edge, value);
    }
  const faces: number[][] = [];
  const triangulate = (face: number[]) => {
    if (face.length === 3) faces.push(face);
    else if (face.length > 3) {
      const center = intern(
        [0, 1, 2].map(
          (axis) => face.reduce((sum, id) => sum + points[id][axis], 0) / face.length,
        ) as Vec,
      );
      for (let i = 0; i < face.length; i++)
        faces.push([center, face[i], face[(i + 1) % face.length]]);
    }
  };
  [...refinedShell, ...refinedFront].forEach(triangulate);
  for (const hole of holes) {
    const center = intern([21, hole.button.y, hole.button.z]);
    let openingEdges = 0;
    for (const edge of edges.values()) {
      if (edge.count !== 1) continue;
      const a = points[edge.a],
        b = points[edge.b],
        midpoint = a.map((value, axis) => (value + b[axis]) / 2) as Vec;
      if (
        !hole.planes.every((plane) => distance(midpoint, plane) >= -epsilon) ||
        !hole.planes.some(
          (plane) =>
            Math.abs(distance(a, plane)) < epsilon && Math.abs(distance(b, plane)) < epsilon,
        )
      )
        continue;
      if (Math.min(a[0], b[0]) < 21.01)
        throw new Error('A bezel pocket must remain ahead of its X21 mounting panel.');
      const floorA = intern([21, a[1], a[2]]),
        floorB = intern([21, b[1], b[2]]);
      faces.push([edge.b, edge.a, floorA], [edge.b, floorA, floorB], [center, floorB, floorA]);
      openingEdges++;
    }
    if (!openingEdges) throw new Error('The authored bezel pocket has no closed opening boundary.');
  }
  return { kind: 'boundary', points, faces };
}
