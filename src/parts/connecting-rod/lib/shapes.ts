import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { num } from '../../../core/geometry';
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
// State changes reuse solids, but every displayed component owns its geometry and material.
const cache = new Map<string, { shape: Geom3; bounds: Bounds; mesh?: Group }>();
function cached(s: Shape) {
  const key = JSON.stringify(s);
  let entry = cache.get(key);
  if (!entry) {
    const shape = solid(s);
    entry = { shape, bounds: modeling.measurements.measureBoundingBox(shape) as Bounds };
    cache.set(key, entry);
    if (cache.size > 18) {
      const oldest = cache.keys().next().value!;
      cache.get(oldest)!.mesh?.traverse((c) => {
        if (c instanceof Mesh) {
          c.geometry.dispose();
          (c.material as MeshStandardMaterial).dispose();
        }
      });
      cache.delete(oldest);
    }
  } else {
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry;
}
export const bounds = (s: Shape): Bounds => cached(s).bounds;
export function component(s: Shape, label: string, color: number): Group {
  const c = cached(s);
  if (!c.mesh) {
    c.mesh = solidUnionMesh(c.shape);
    c.mesh.position.set(...(c.bounds[0].map((v, i) => (v + c.bounds[1][i]) / 2) as Vec));
  }
  const mesh = c.mesh.clone(true);
  mesh.name = label;
  mesh.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry = child.geometry.clone();
      child.material = (child.material as MeshStandardMaterial).clone();
      (child.material as MeshStandardMaterial).color.setHex(color);
    }
  });
  return mesh;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'cylinder':
      return s.segments === 6
        ? `rod_hex(${num(s.radius)},${num(s.height)},${vector(s.origin)})`
        : `Part.makeCylinder(${num(s.radius)},${num(s.height)},${vector(s.origin)},${s.axis === 'y' ? 'App.Vector(0,1,0)' : 'App.Vector(0,0,1)'})`;
    case 'box':
      return `Part.makeBox(${s.size.map(num).join(',')},${vector(s.origin)})`;
    case 'prism': {
      const pts = s.points.map(([x, z]) => vector([x, s.y, z]));
      return `Part.Face(Part.makePolygon([${[...pts, pts[0]].join(',')}])).extrude(App.Vector(0,${num(s.height)},0))`;
    }
    default: {
      const method = s.kind === 'union' ? 'fuse' : s.kind === 'subtract' ? 'cut' : 'common';
      return s.children
        .slice(1)
        .reduce((out, c) => `${out}.${method}(${pythonShape(c)})`, pythonShape(s.children[0]));
    }
  }
}
export const pythonHelpers = `def rod_hex(radius,height,origin):
    points = [App.Vector(radius*math.cos(i*math.pi/3),radius*math.sin(i*math.pi/3),0) for i in range(6)]
    solid = Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    solid.translate(origin)
    return solid`;
