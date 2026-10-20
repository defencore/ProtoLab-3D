import type { Parameters } from '../../../core/types';
export type Vec = [number, number, number];
export type Shape =
  | { kind: 'library-ball-screw'; parameters: Parameters; state: 'screw' | 'nut' }
  | { kind: 'library-guide'; parameters: Parameters; state: 'rail' | 'carriage' }
  | { kind: 'transform'; child: Shape; translation: Vec; rotation: Vec }
  | { kind: 'loft'; rings: Vec[][] }
  | { kind: 'revolve'; profile: [number, number][] }
  | { kind: 'box'; size: Vec; origin: Vec }
  | {
      kind: 'cylinder';
      thread?: { pitch: number; internal?: boolean; rounded?: boolean };
      radius: number;
      height: number;
      origin: Vec;
      axis: 'x' | 'y' | 'z';
    }
  | {
      kind: 'prism';
      points: [number, number][];
      depth: number;
      origin: number;
      axis: 'y' | 'z';
    }
  | { kind: 'union'; children: Shape[] }
  | { kind: 'subtract'; children: Shape[] };
export const box = (size: Vec, origin: Vec): Shape => ({
  kind: 'box',
  size,
  origin,
});
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'x' | 'y' | 'z' = 'z',
  thread?: { pitch: number; internal?: boolean; rounded?: boolean },
): Shape => ({ kind: 'cylinder', radius, height, origin, axis, thread });
export const prism = (
  points: [number, number][],
  depth: number,
  origin: number,
  axis: 'y' | 'z' = 'z',
): Shape => {
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0);
  return {
    kind: 'prism',
    points: area < 0 ? [...points].reverse() : points,
    depth,
    origin,
    axis,
  };
};
export const union = (...children: Shape[]): Shape => ({
  kind: 'union',
  children,
});
export const subtract = (...children: Shape[]): Shape => ({
  kind: 'subtract',
  children,
});

export function roundedRect(w: number, h: number, r: number, z: number, depth: number): Shape {
  const points: [number, number][] = [];
  for (let corner = 0; corner < 4; corner++) {
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - r);
    const cy = (corner < 2 ? 1 : -1) * (h / 2 - r);
    for (let i = 0; i <= 8; i++) {
      const a = ((corner * 90 + (i * 90) / 8) * Math.PI) / 180;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return prism(points, depth, z);
}
export const ring = (r: number, inner: number, z: number, h: number, x = 0, y = 0): Shape =>
  subtract(cylinder(r, h, [x, y, z]), cylinder(inner, h + 2, [x, y, z - 1]));
