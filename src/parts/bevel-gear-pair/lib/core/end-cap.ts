import { Vector3 } from 'three';

type Point = [number, number, number];

/** Keep the body annulus planar and confine axial tooth relief to its radial band. */
export function appendBevelEndCap(
  points: Point[],
  faces: number[][],
  contour: number[],
  hole: number[],
  rootRadius: number,
  rootZ: number,
  top: boolean,
): void {
  const key = (point: Point) => point.map((value) => Math.round(value * 1e9)).join(',');
  const vertices = new Map(points.map((point, index) => [key(point), index]));
  const roots = contour.map((index) => {
    const [x, y] = points[index];
    const scale = rootRadius / Math.hypot(x, y);
    const point: Point = [x * scale, y * scale, rootZ];
    const existing = vertices.get(key(point));
    if (existing !== undefined) return existing;
    const next = points.length;
    points.push(point);
    vertices.set(key(point), next);
    return next;
  });
  const triangle = (indices: number[]) => {
    if (new Set(indices).size < 3) return;
    const [a, b, c] = indices.map((index) => new Vector3(...points[index]));
    if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-20) return;
    faces.push(top ? indices : [...indices].reverse());
  };
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    triangle([roots[i], contour[i], contour[j]]);
    triangle([roots[i], contour[j], roots[j]]);
  }
  // Radial root relief can project two neighboring profile samples to the same root.
  const boundary = roots.filter(
    (index, i) => index !== roots[(i + roots.length - 1) % roots.length],
  );
  const ordered = (ring: number[]) =>
    ring
      .map((index) => ({ index, angle: Math.atan2(points[index][1], points[index][0]) }))
      .sort((a, b) => a.angle - b.angle);
  const outer = ordered(boundary);
  const inner = ordered(hole);
  // Advance along the two star-shaped rings by polar angle. Every triangle spans
  // the annulus; no almost-collinear ears are cut from the densely sampled root.
  let start = -1;
  for (let index = 0; index < inner.length; index++)
    if (inner[index].angle <= outer[0].angle) start = index;
  if (start < 0) start = inner.length - 1;
  const innerRing = [...inner.slice(start), ...inner.slice(0, start)].map((vertex, i) => ({
    ...vertex,
    angle: vertex.angle + (i >= inner.length - start ? 2 * Math.PI : 0),
  }));
  if (innerRing[0].angle > outer[0].angle)
    for (const vertex of innerRing) vertex.angle -= 2 * Math.PI;
  const at = (ring: typeof outer, i: number) => ({
    index: ring[i % ring.length].index,
    angle: ring[i % ring.length].angle + (i >= ring.length ? 2 * Math.PI : 0),
  });
  let i = 0,
    j = 0;
  while (i < outer.length || j < innerRing.length) {
    if (
      i < outer.length &&
      (j === innerRing.length || at(outer, i + 1).angle <= at(innerRing, j + 1).angle)
    ) {
      triangle([at(outer, i).index, at(outer, i + 1).index, at(innerRing, j).index]);
      i++;
    } else {
      triangle([at(outer, i).index, at(innerRing, j + 1).index, at(innerRing, j).index]);
      j++;
    }
  }
}
