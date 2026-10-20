export type Vec = [number, number, number];
export type Point = [number, number];
export type Shape =
  | { kind: 'sphere'; radius: number; origin: Vec }
  | { kind: 'box'; size: Vec; origin: Vec }
  | { kind: 'cylinder'; radius: number; height: number; origin: Vec; axis: 'x' | 'z' }
  | { kind: 'plate'; outline: Point[]; holes: Point[][]; z: number; height: number }
  | { kind: 'subtract' | 'union'; children: Shape[] }
  | { kind: 'transform'; child: Shape; angle: number; offset: Vec }
  | { kind: 'rotate'; child: Shape; angle: number; axis: 'x' | 'y' };
export const sphere = (radius: number, origin: Vec): Shape => ({ kind: 'sphere', radius, origin });
export const box = (size: Vec, origin: Vec): Shape => ({ kind: 'box', size, origin });
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'x' | 'z' = 'z',
): Shape => ({ kind: 'cylinder', radius, height, origin, axis });
export const subtract = (...children: Shape[]): Shape => ({ kind: 'subtract', children });
export const union = (...children: Shape[]): Shape => ({ kind: 'union', children });
export const transform = (child: Shape, angle: number, offset: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  angle,
  offset,
});
export const rotate = (child: Shape, angle: number, axis: 'x' | 'y'): Shape => ({
  kind: 'rotate',
  child,
  angle,
  axis,
});
export const circle = (radius: number, x = 0, y = 0, count = 120): Point[] =>
  Array.from({ length: count }, (_, i) => [
    x + radius * Math.cos((i * Math.PI * 2) / count),
    y + radius * Math.sin((i * Math.PI * 2) / count),
  ]);
function ccw(points: Point[]): Point[] {
  const area = points.reduce((sum, [x, y], i) => {
    const next = points[(i + 1) % points.length];
    return sum + x * next[1] - y * next[0];
  }, 0);
  return area < 0 ? [...points].reverse() : points;
}
export const plate = (outline: Point[], holes: Point[][], z: number, height: number): Shape => ({
  kind: 'plate',
  outline: ccw(outline),
  holes: holes.map(ccw),
  z,
  height,
});
export const ring = (
  outer: number,
  inner: number,
  z: number,
  height: number,
  x = 0,
  y = 0,
): Shape =>
  subtract(cylinder(outer, height, [x, y, z]), cylinder(inner, height + 2, [x, y, z - 1]));

export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  z?: number;
  position?: Vec;
  angle?: number;
}
