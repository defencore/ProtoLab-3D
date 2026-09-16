/** Sampled involute reference profiles. No cutter fillet or strength calculation.
 * Pitch diameters follow m*z; standard pressure angle 20 degrees.
 */
import { C, cut, poly } from './helpers';
import type { Shape, Vec } from './shapes';
export function profile(module: number, count: number, internal = false): [number, number][] {
  const R = (module * count) / 2,
    base = R * Math.cos(Math.PI / 9);
  const inv = (r: number) => {
    const a = Math.acos(Math.min(1, base / r));
    return Math.tan(a) - a;
  };
  const low = R - (internal ? 1 : 1.25) * module,
    high = R + (internal ? 1.25 : 1) * module;
  const half = (r: number) =>
    Math.PI / (2 * count) + inv(R) - inv(r) + ((internal ? 1 : -1) * 0.06 * module) / R;
  const points: [number, number][] = [];
  const put = (r: number, a: number) => points.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    put(low, a - Math.PI / count);
    for (let j = 0; j <= 5; j++) {
      const r = low + ((high - low) * j) / 5;
      put(r, a - half(r));
    }
    put(high, a);
    for (let j = 5; j >= 0; j--) {
      const r = low + ((high - low) * j) / 5;
      put(r, a + half(r));
    }
  }
  return points;
}
export function gear(
  module: number,
  count: number,
  bore: number,
  height: number,
  z: number,
): Shape {
  return cut(poly(profile(module, count), height, z), C(bore, height + 2, z - 1));
}
/** Straight conical tooth reference for a 1:1, 90-degree miter pair. */
export function miter(radius: number, height: number, count: number, bore: number): Shape {
  const outer = profile((radius * 2) / count, count);
  const N = outer.length;
  const points: Vec[] = [
    ...outer.map(([x, y]): Vec => [x, y, -radius]),
    ...outer.map(([x, y]): Vec => [
      x * (1 - height / radius),
      y * (1 - height / radius),
      -radius + height,
    ]),
  ];
  for (const z of [-radius, -radius + height])
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N - Math.PI / count;
      points.push([(Math.cos(a) * bore) / 2, (Math.sin(a) * bore) / 2, z]);
    }
  const faces: number[][] = [];
  const quad = (a: number, b: number, c: number, d: number) => faces.push([a, b, c], [a, c, d]);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    quad(i, j, N + j, N + i);
    quad(2 * N + j, 2 * N + i, 3 * N + i, 3 * N + j);
    quad(j, i, 2 * N + i, 2 * N + j);
    quad(N + i, N + j, 3 * N + j, 3 * N + i);
  }
  return { kind: 'boundary', points, faces };
}
