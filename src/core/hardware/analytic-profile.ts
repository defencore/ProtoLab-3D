import { num } from '../geometry';

export type MeridianPoint = [number, number];
export type AnalyticProfileSegment =
  | { kind: 'line'; from: MeridianPoint; to: MeridianPoint }
  | { kind: 'arc'; from: MeridianPoint; through: MeridianPoint; to: MeridianPoint };

const distance = (a: MeridianPoint, b: MeridianPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: MeridianPoint, b: MeridianPoint, c: MeridianPoint) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Recover only straight/circular runs of a sampled, closed turning meridian.
 * Five co-circular points are required: arbitrary three-point corners are never rounded.
 * This is for meridians sampled from smooth authored curves, not polygonal product outlines.
 */
export function analyticProfileSegments(input: MeridianPoint[]): AnalyticProfileSegment[] {
  const scale = Math.max(1, ...input.flat().map(Math.abs));
  const tolerance = scale * 1e-9;
  const points = input.filter(
    (point, index) => !index || distance(point, input[index - 1]) > tolerance * 0.01,
  );
  if (points.length > 1 && distance(points[0], points.at(-1)!) <= tolerance * 0.01) points.pop();
  if (points.length < 3) throw new Error('A turning profile needs three distinct vertices.');
  const closed = [...points, points[0]];
  const segments: AnalyticProfileSegment[] = [];
  for (let start = 0; start < closed.length - 1;) {
    const a = closed[start],
      b = closed[start + 1];
    let lineEnd = start + 1;
    const length = distance(a, b);
    while (
      lineEnd + 1 < closed.length &&
      Math.abs(cross(a, b, closed[lineEnd + 1])) / length <= tolerance
    ) {
      // A collinear reversal is a real contour corner, rather than a redundant sample.
      const previous = closed[lineEnd],
        next = closed[lineEnd + 1];
      if ((next[0] - previous[0]) * (b[0] - a[0]) + (next[1] - previous[1]) * (b[1] - a[1]) <= 0)
        break;
      lineEnd++;
    }
    if (lineEnd > start + 1) {
      segments.push({ kind: 'line', from: a, to: closed[lineEnd] });
      start = lineEnd;
      continue;
    }
    let arcEnd = start + 1;
    if (start + 4 < closed.length) {
      const c = closed[start + 2];
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        vx = c[0] - a[0],
        vy = c[1] - a[1];
      const determinant = 2 * (ux * vy - uy * vx);
      if (Math.abs(determinant) > tolerance * tolerance) {
        const u2 = ux * ux + uy * uy,
          v2 = vx * vx + vy * vy;
        const center: MeridianPoint = [
          a[0] + (u2 * vy - v2 * uy) / determinant,
          a[1] + (ux * v2 - vx * u2) / determinant,
        ];
        const radius = distance(a, center),
          sign = Math.sign(determinant);
        let sweep = 0,
          previousAngle = Math.atan2(a[1] - center[1], a[0] - center[0]);
        for (let next = start + 1; next < closed.length; next++) {
          const point = closed[next];
          if (Math.abs(distance(point, center) - radius) > tolerance) break;
          const angle = Math.atan2(point[1] - center[1], point[0] - center[0]);
          let delta = angle - previousAngle;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          // Dense smooth samples qualify; sparse regular polygons remain polygonal.
          // Splitting at 180 degrees also gives a closed circle two unambiguous arcs.
          if (
            delta * sign <= 0 ||
            Math.abs(delta) > Math.PI / 12 + 1e-9 ||
            Math.abs(sweep + delta) > Math.PI + 1e-9
          )
            break;
          sweep += delta;
          previousAngle = angle;
          arcEnd = next;
        }
      }
    }
    if (arcEnd >= start + 4) {
      segments.push({
        kind: 'arc',
        from: a,
        through: closed[Math.floor((start + arcEnd) / 2)],
        to: closed[arcEnd],
      });
      start = arcEnd;
    } else {
      segments.push({ kind: 'line', from: a, to: b });
      start++;
    }
  }
  return segments;
}

/** Native circular edges replace sampled meridian chords; preview tessellation stays independent. */
export function analyticRevolvePython(profile: MeridianPoint[], zOffset = 0, sweep = 360): string {
  const vector = ([radius, z]: MeridianPoint) => `App.Vector(${num(radius)},0,${num(z + zOffset)})`;
  const segments = analyticProfileSegments(profile);
  if (segments.every((segment) => segment.kind === 'line')) {
    const vertices = [...segments.map((segment) => segment.from), segments.at(-1)!.to];
    return `Part.Face(Part.makePolygon([${vertices.map(vector).join(',')}])).revolve(App.Vector(0,0,0),App.Vector(0,0,1),${num(sweep)})`;
  }
  const edges = segments.map((segment) =>
    segment.kind === 'line'
      ? `Part.makeLine(${vector(segment.from)},${vector(segment.to)})`
      : `Part.Arc(${vector(segment.from)},${vector(segment.through)},${vector(segment.to)}).toShape()`,
  );
  return `Part.Face(Part.Wire([${edges.join(',')}])).revolve(App.Vector(0,0,0),App.Vector(0,0,1),${num(sweep)})`;
}
