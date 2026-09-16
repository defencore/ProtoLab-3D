import { box, cylinder, prism, union, subtract, type Shape } from './shapes';
export { union };
export const cut = subtract;
export const B = (w: number, d: number, h: number, x = 0, y = 0, z = 0): Shape =>
  box([w, d, h], [x - w / 2, y - d / 2, z]);
export const C = (d: number, h: number, z = 0, x = 0, y = 0): Shape =>
  cylinder(d / 2, h, [x, y, z]);
export const ring = (d: number, bore: number, h: number, z = 0): Shape =>
  cut(C(d, h, z), C(bore, h + 2, z - 1));
export const poly = (points: [number, number][], h: number, z = 0): Shape => prism(points, h, z);
export const move = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [x, y, z],
  rotation: [0, 0, 0],
});
export const rotate = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [x, y, z],
});
/** Trapezoidal visual teeth only; used for mechanisms whose production flanks are not specified. */
export function teeth(root: number, tip: number, count: number, h: number, z = 0): Shape {
  return poly(
    Array.from({ length: count * 4 }, (_, i) => {
      const a = (i * Math.PI * 2) / (count * 4),
        r = i % 4 === 1 || i % 4 === 2 ? tip : root;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
    h,
    z,
  );
}
export function link(
  a: [number, number],
  b: [number, number],
  width: number,
  h: number,
  z: number,
  hole = 0,
): Shape {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy),
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  let s = union(B(L, width, h, L / 2, 0, z), C(width, h, z), C(width, h, z, L));
  if (hole) s = cut(s, C(hole, h + 2, z - 1), C(hole, h + 2, z - 1, L));
  return move(rotate(s, 0, 0, angle), a[0], a[1]);
}
