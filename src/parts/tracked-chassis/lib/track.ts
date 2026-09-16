import { prism, subtract, type Shape } from './shapes';
type Point = [number, number];
export interface Wheel {
  x: number;
  z: number;
  radius: number;
}
function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (ps: Point[]) => {
    const out: Point[] = [];
    for (const p of ps) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}
/** Taut belt around the posed wheels; one connected solid per side, not separate mesh links. */
export function track(wheels: Wheel[], width: number, detailed: boolean): Shape {
  const points = hull(
    wheels.flatMap((w) =>
      Array.from({ length: 96 }, (_, i): Point => {
        const angle = (i * Math.PI) / 48;
        return [
          w.x + (w.radius + 0.45) * Math.cos(angle),
          w.z + (w.radius + 0.45) * Math.sin(angle),
        ];
      }),
    ),
  );
  const offsets = (distance: number): Point[] =>
    points.map((p, i) => {
      const a = points[(i + points.length - 1) % points.length],
        b = points[(i + 1) % points.length];
      const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]),
        l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const n1: Point = [(p[1] - a[1]) / l1, -(p[0] - a[0]) / l1],
        n2: Point = [(b[1] - p[1]) / l2, -(b[0] - p[0]) / l2];
      const k = distance / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
      return [p[0] + k * (n1[0] + n2[0]), p[1] + k * (n1[1] + n2[1])];
    });
  let outer = offsets(detailed ? 3.6 : 5.6);
  if (detailed) {
    const lengths = outer.map((a, i) =>
      Math.hypot(outer[(i + 1) % outer.length][0] - a[0], outer[(i + 1) % outer.length][1] - a[1]),
    );
    const perimeter = lengths.reduce((a, b) => a + b, 0),
      pitch = perimeter / Math.round(perimeter / 8);
    const profile: Point[] = [
      [0, 0],
      [0.16, 0],
      [0.25, 2],
      [0.68, 2],
      [0.8, 0],
      [1, 0],
    ];
    const heightAt = (s: number) => {
      const f = (s / pitch) % 1;
      const j = profile.findIndex((p, i) => i > 0 && p[0] >= f);
      const a = profile[Math.max(0, j - 1)],
        b = profile[Math.max(1, j)];
      return a[1] + ((b[1] - a[1]) * (f - a[0])) / (b[0] - a[0]);
    };
    const result: Point[] = [];
    let travelled = 0;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i],
        b = outer[(i + 1) % outer.length],
        length = lengths[i];
      const distances = [travelled];
      for (let j = Math.floor(travelled / pitch); j <= Math.ceil((travelled + length) / pitch); j++)
        for (const [f] of profile) {
          const d = (j + f) * pitch;
          if (d > travelled + 1e-7 && d < travelled + length - 1e-7) distances.push(d);
        }
      for (const d of [...new Set(distances)].sort((a, b) => a - b)) {
        const t = (d - travelled) / length,
          h = heightAt(d);
        const raised = offsets(3.6 + h);
        // Interpolate matching mitred vertices to preserve the original convex corners.
        result.push([
          raised[i][0] * (1 - t) + raised[(i + 1) % outer.length][0] * t,
          raised[i][1] * (1 - t) + raised[(i + 1) % outer.length][1] * t,
        ]);
      }
      travelled += length;
    }
    outer = result;
  }
  return subtract(
    prism(outer, width, -width / 2, 'y'),
    prism(points, width + 2, -width / 2 - 1, 'y'),
  );
}
