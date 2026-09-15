import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../../core/solid-union';
import { num } from '../../../../core/geometry';

export type Vec = [number, number, number];
type Cylinder = {
  kind: 'cylinder';
  radius: number;
  height: number;
  origin: Vec;
  axis: 'z' | 'y';
};
type Box = { kind: 'box'; size: Vec; origin: Vec };
type BooleanShape = { kind: 'union' | 'subtract'; children: Shape[] };
export type Shape = Cylinder | Box | BooleanShape;
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'z' | 'y' = 'z',
): Cylinder => ({ kind: 'cylinder', radius, height, origin, axis });
export const box = (size: Vec, origin: Vec): Box => ({
  kind: 'box',
  size,
  origin,
});
export const union = (...children: Shape[]): BooleanShape => ({
  kind: 'union',
  children,
});
export const subtract = (...children: Shape[]): BooleanShape => ({
  kind: 'subtract',
  children,
});
function toSolid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'cylinder': {
      let solid = modeling.primitives.cylinder({
        radius: s.radius,
        height: s.height,
        segments: 64,
      });
      if (s.axis === 'y') solid = modeling.transforms.rotateX(-Math.PI / 2, solid);
      const center = [...s.origin] as Vec;
      center[s.axis === 'y' ? 1 : 2] += s.height / 2;
      return modeling.transforms.translate(center, solid);
    }
    case 'box':
      return modeling.primitives.cuboid({
        size: s.size,
        center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec,
      });
    case 'union':
      return modeling.booleans.union(...s.children.map(toSolid));
    case 'subtract':
      return modeling.booleans.subtract(...s.children.map(toSolid));
  }
}
// Pose changes reuse the illustrative arm triangulation; returned models own their buffers.
const cache = new Map<string, Group>();
export function component(s: Shape, label: string, color: number, shift: Vec): Group {
  const key = JSON.stringify(s);
  let template = cache.get(key);
  if (!template) {
    const solid = toSolid(s),
      bb = modeling.measurements.measureBoundingBox(solid);
    template = solidUnionMesh(solid);
    template.position.set(...(bb[0].map((v, i) => (v + bb[1][i]) / 2) as Vec));
    cache.set(key, template);
    if (cache.size > 20) {
      const oldest = cache.keys().next().value!;
      cache.get(oldest)!.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          (child.material as MeshStandardMaterial).dispose();
        }
      });
      cache.delete(oldest);
    }
  }
  const group = template.clone(true);
  group.name = label;
  group.position.x += shift[0];
  group.position.y += shift[1];
  group.position.z += shift[2];
  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.name = label;
      child.geometry = child.geometry.clone();
      child.material = (child.material as MeshStandardMaterial).clone();
      child.material.color.setHex(color);
    }
  });
  return group;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'cylinder':
      return `Part.makeCylinder(${num(s.radius)},${num(s.height)},${vector(s.origin)},${s.axis === 'y' ? 'App.Vector(0,1,0)' : 'App.Vector(0,0,1)'})`;
    case 'box':
      return `Part.makeBox(${s.size.map(num).join(',')},${vector(s.origin)})`;
    default:
      return s.children
        .slice(1)
        .reduce(
          (expr, child) => `${expr}.${s.kind === 'union' ? 'fuse' : 'cut'}(${pythonShape(child)})`,
          pythonShape(s.children[0]),
        );
  }
}
