import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
export type Vec = [number, number, number];
export type Bounds = [Vec, Vec];
type Cylinder = {
  kind: 'cylinder';
  radius: number;
  height: number;
  origin: Vec;
  axis: 'z' | 'y';
  segments: number;
};
type Box = { kind: 'box'; size: Vec; origin: Vec };
type Prism = { kind: 'prism'; points: [number, number][]; height: number; y: number };
type BooleanShape = { kind: 'union' | 'subtract' | 'intersect'; children: Shape[] };
export type Shape = Cylinder | Box | Prism | BooleanShape;
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'z' | 'y' = 'y',
  segments = 64,
): Cylinder => ({ kind: 'cylinder', radius, height, origin, axis, segments });
export const box = (size: Vec, origin: Vec): Box => ({ kind: 'box', size, origin });
export const prism = (points: [number, number][], height: number, y: number): Prism => ({
  kind: 'prism',
  points,
  height,
  y,
});
export const union = (...children: Shape[]): BooleanShape => ({ kind: 'union', children });
export const subtract = (...children: Shape[]): BooleanShape => ({ kind: 'subtract', children });
export const intersect = (...children: Shape[]): BooleanShape => ({ kind: 'intersect', children });
function solid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'cylinder': {
      let shape = modeling.primitives.cylinder({
        radius: s.radius,
        height: s.height,
        segments: s.segments,
      });
      if (s.axis === 'y') shape = modeling.transforms.rotateX(-Math.PI / 2, shape);
      const center = [...s.origin] as Vec;
      center[s.axis === 'y' ? 1 : 2] += s.height / 2;
      return modeling.transforms.translate(center, shape);
    }
    case 'box':
      return modeling.primitives.cuboid({
        size: s.size,
        center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec,
      });
    case 'prism':
      return modeling.transforms.translate(
        [0, s.y + s.height, 0],
        modeling.transforms.rotateX(
          Math.PI / 2,
          modeling.extrusions.extrudeLinear(
            { height: s.height },
            modeling.primitives.polygon({ points: s.points }),
          ),
        ),
      );
    case 'union':
      return modeling.booleans.union(...s.children.map(solid));
    case 'subtract':
      return modeling.booleans.subtract(...s.children.map(solid));
    case 'intersect':
      return modeling.booleans.intersect(...s.children.map(solid));
  }
}
// Bounds are independent of display state; actual physical components render through the library.
const cache = new Map<string, { bounds: Bounds }>();
function cached(s: Shape) {
  const key = JSON.stringify(s);
  let entry = cache.get(key);
  if (!entry) {
    const shape = solid(s);
    entry = { bounds: modeling.measurements.measureBoundingBox(shape) as Bounds };
    cache.set(key, entry);
    if (cache.size > 18) {
      const oldest = cache.keys().next().value!;
      cache.delete(oldest);
    }
  } else {
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry;
}
export const bounds = (s: Shape): Bounds => cached(s).bounds;
