import type { Parameters } from '../../../core/types';
import { cylinder, prism, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { layout } from './layout';

/** Flexible, unanchored extraction sling. Feed its soft loop through the lid when opening. */
export function ribbonRoute(p: Parameters): [number, number][] {
  const d = layout(p),
    outer = d.holder.width / 2 + 0.5;
  return [
    [-0.8, -3.5],
    [-outer, -3.5],
    [-outer, -18.1],
    ...d.pinRows.flatMap((y): [number, number][] => [
      [y - 8.2, -18.1],
      [y - 5, -22.9],
      [y + 5, -22.9],
      [y + 8.2, -18.1],
    ]),
    [outer, -18.1],
    [outer, -3.5],
    [0.8, -3.5],
    [0.8, 8.5],
    [11, 17],
    [11, 20],
    [7, 24],
    [-7, 24],
    [-11, 20],
    [-11, 17],
    [-0.8, 8.5],
  ];
}

export function ribbonShape(p: Parameters): Shape {
  const d = layout(p),
    path = ribbonRoute(p),
    half = d.strapThickness / 2;
  return union(
    ...path.map(([y, z], i): Shape => {
      const [ny, nz] = path[(i + 1) % path.length];
      const length = Math.hypot(ny - y, nz - z);
      const dy = (-(nz - z) * half) / length,
        dz = ((ny - y) * half) / length;
      return {
        kind: 'transform',
        rotation: [0, 0, 90],
        translation: [0, 0, 0],
        child: prism(
          [
            [y + dy, z + dz],
            [ny + dy, nz + dz],
            [ny - dy, nz - dz],
            [y - dy, z - dz],
          ],
          d.strapWidth,
          -d.strapWidth / 2,
          'y',
        ),
      };
    }),
    ...path.map(([y, z]) => cylinder(half, d.strapWidth, [-d.strapWidth / 2, y, z], 'x')),
  );
}
