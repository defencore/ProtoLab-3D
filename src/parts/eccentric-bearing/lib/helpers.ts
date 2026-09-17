import { cylinder, prism, type Shape } from './shapes';
export const move = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [x, y, z],
  rotation: [0, 0, 0],
});
export const hex = (af: number, height: number, z = 0): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i) => [
      (af / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3),
      (af / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3),
    ]),
    height,
    z,
  );
export const C = (d: number, h: number, z = 0, x = 0, y = 0) => cylinder(d / 2, h, [x, y, z]);
