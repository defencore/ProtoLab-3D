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
