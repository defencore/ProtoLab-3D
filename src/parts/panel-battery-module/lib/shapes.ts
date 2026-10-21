import { box, cylinder, prism, union, type Shape } from '../../../core/assembly/boundary/shapes';
export const rounded = (
  w: number,
  h: number,
  r: number,
  c: readonly [number, number],
  z: number,
  t: number,
): Shape =>
  union(
    box([w - 2 * r, h, t], [c[0] - w / 2 + r, c[1] - h / 2, z]),
    box([w, h - 2 * r, t], [c[0] - w / 2, c[1] - h / 2 + r, z]),
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((y) => cylinder(r, t, [c[0] + x * (w / 2 - r), c[1] + y * (h / 2 - r), z])),
    ),
  );
export const hex = (af: number, z: number, t: number, c: readonly [number, number]): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i): [number, number] => [
      c[0] + (af / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3),
      c[1] + (af / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3),
    ]),
    t,
    z,
  );
/** AMASS S0 female panel outline: square left end, R3.9 right corners, rotated90deg. */
export function xtOpening(c: readonly [number, number], z: number, t: number): Shape {
  const w = 19.3,
    h = 11.85,
    r = 3.9;
  const points: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2 - r, -h / 2],
  ];
  for (let i = 1; i <= 12; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 24;
    points.push([w / 2 - r + r * Math.cos(a), -h / 2 + r + r * Math.sin(a)]);
  }
  points.push([w / 2, h / 2 - r]);
  for (let i = 1; i <= 12; i++) {
    const a = (i * Math.PI) / 24;
    points.push([w / 2 - r + r * Math.cos(a), h / 2 - r + r * Math.sin(a)]);
  }
  points.push([-w / 2, h / 2]);
  return {
    kind: 'transform',
    child: prism(points, t, z),
    rotation: [0, 0, 90],
    translation: [c[0], c[1], 0],
  };
}
