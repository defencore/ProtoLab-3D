import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { num } from '../../../core/geometry';

export type Vec = [number, number, number];
type Cylinder = { kind: 'cylinder'; radius: number; height: number; origin: Vec; axis: 'z' | 'y' };
type Box = { kind: 'box'; size: Vec; origin: Vec };
type BooleanShape = { kind: 'union' | 'subtract'; children: Shape[] };
export type Shape = Cylinder | Box | BooleanShape;
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'z' | 'y' = 'z',
): Cylinder => ({ kind: 'cylinder', radius, height, origin, axis });
export const box = (size: Vec, origin: Vec): Box => ({ kind: 'box', size, origin });
export const union = (...children: Shape[]): BooleanShape => ({ kind: 'union', children });
export const subtract = (...children: Shape[]): BooleanShape => ({ kind: 'subtract', children });
export const annulus = (outer: number, inner: number, height: number, z: number) =>
  subtract(cylinder(outer, height, [0, 0, z]), cylinder(inner, height + 2, [0, 0, z - 1]));
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
export function bounds(s: Shape): [Vec, Vec] {
  if (s.kind === 'box') return [s.origin, s.origin.map((v, i) => v + s.size[i]) as Vec];
  if (s.kind === 'cylinder') {
    const axis = s.axis === 'y' ? 1 : 2;
    return [
      s.origin.map((v, i) => v - (i === axis ? 0 : s.radius)) as Vec,
      s.origin.map((v, i) => v + (i === axis ? s.height : s.radius)) as Vec,
    ];
  }
  if (s.kind === 'subtract') return bounds(s.children[0]);
  const children = s.children.map(bounds);
  return [
    [0, 1, 2].map((i) => Math.min(...children.map((b) => b[0][i]))) as Vec,
    [0, 1, 2].map((i) => Math.max(...children.map((b) => b[1][i]))) as Vec,
  ];
}
export function component(s: Shape, label: string, color: number, shift: Vec): Group {
  const solid = toSolid(s),
    bb = modeling.measurements.measureBoundingBox(solid);
  const group = solidUnionMesh(solid);
  group.name = label;
  group.position.set(...(bb[0].map((v, i) => (v + bb[1][i]) / 2 + shift[i]) as Vec));
  group.traverse((object) => {
    if (object instanceof Mesh) (object.material as MeshStandardMaterial).color.setHex(color);
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
