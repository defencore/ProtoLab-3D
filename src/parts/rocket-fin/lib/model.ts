import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { prism } from '../../../core/assembly/boundary/shapes';

type Point = [number, number];
const EPSILON = 1e-7;
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (a: Point, b: Point, c: Point) =>
  Math.abs(cross(a, b, c)) <= EPSILON &&
  c[0] >= Math.min(a[0], b[0]) - EPSILON &&
  c[0] <= Math.max(a[0], b[0]) + EPSILON &&
  c[1] >= Math.min(a[1], b[1]) - EPSILON &&
  c[1] <= Math.max(a[1], b[1]) + EPSILON;

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c),
    abD = cross(a, b, d);
  const cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
      ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}

export function freeformPoints(value: string): Point[] {
  if (value.length > 16000) throw new Error('The freeform outline text is too long.');
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    throw new Error('Enter a JSON array of [x, y] coordinate pairs.');
  }
  if (
    !Array.isArray(input) ||
    input.length < 3 ||
    input.length > 64 ||
    !input.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(
          (coordinate) =>
            typeof coordinate === 'number' &&
            Number.isFinite(coordinate) &&
            Math.abs(coordinate) <= 2000,
        ),
    )
  )
    throw new Error('Use 3 to 64 finite [x, y] pairs with coordinates within +/-2000 mm.');
  const points = input as Point[];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++)
      if (Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) < 1e-6)
        throw new Error('List each outline vertex once; do not repeat the closing point.');
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const edgeScale = Math.max(
      1,
      Math.hypot(points[i][0] - previous[0], points[i][1] - previous[1]) *
        Math.hypot(next[0] - points[i][0], next[1] - points[i][1]),
    );
    if (Math.abs(cross(previous, points[i], next)) <= EPSILON * edgeScale)
      throw new Error('Remove collinear corners or reversed edges from the outline.');
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (intersects(points[i], next, points[j], points[(j + 1) % points.length]))
        throw new Error('The freeform outline must not cross or touch itself.');
    }
  }
  const twiceArea = points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  const xs = points.map((point) => point[0]),
    ys = points.map((point) => point[1]);
  if (
    Math.abs(twiceArea) < 0.0002 ||
    Math.max(...xs) - Math.min(...xs) < 0.1 ||
    Math.max(...ys) - Math.min(...ys) < 0.1
  )
    throw new Error('The outline must have positive area and at least 0.1 mm extent on both axes.');
  return points;
}

export function finOutline(p: Parameters): Point[] {
  if (p.shape === 'freeform') return freeformPoints(String(p.points));
  const root = n(p, 'rootChord'),
    span = n(p, 'span');
  if (p.shape === 'elliptical') {
    const points: Point[] = [
      [0, 0],
      [root, 0],
    ];
    for (let i = 1; i < 64; i++) {
      const angle = Math.PI * (1 - i / 64);
      points.push([(root / 2) * (1 - Math.cos(angle)), span * Math.sin(angle)]);
    }
    return points;
  }
  return [
    [0, 0],
    [root, 0],
    [n(p, 'sweep') + n(p, 'tipChord'), span],
    [n(p, 'sweep'), span],
  ];
}

export const finShape = (p: Parameters) =>
  prism(finOutline(p), n(p, 'thickness'), -n(p, 'thickness') / 2);

export function finDimensions(p: Parameters): [number, number, number] {
  const outline = finOutline(p),
    xs = outline.map((point) => point[0]),
    ys = outline.map((point) => point[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), n(p, 'thickness')];
}
