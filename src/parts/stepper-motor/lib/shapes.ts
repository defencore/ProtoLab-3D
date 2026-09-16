import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { num } from '../../../core/geometry';
export type Vec = [number, number, number];
export type Shape =
  | { kind: 'box'; size: Vec; origin: Vec }
  | {
      kind: 'cylinder';
      radius: number;
      height: number;
      origin: Vec;
      axis: 'y' | 'z';
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
  axis: 'y' | 'z' = 'z',
): Shape => ({ kind: 'cylinder', radius, height, origin, axis });
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
function solid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'box':
      return modeling.primitives.cuboid({
        size: s.size,
        center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec,
      });
    case 'cylinder': {
      let value = modeling.primitives.cylinder({
        radius: s.radius,
        height: s.height,
        segments: 48,
      });
      if (s.axis === 'y') value = modeling.transforms.rotateX(-Math.PI / 2, value);
      const center = [...s.origin] as Vec;
      center[s.axis === 'y' ? 1 : 2] += s.height / 2;
      return modeling.transforms.translate(center, value);
    }
    case 'prism': {
      let value = modeling.extrusions.extrudeLinear(
        { height: s.depth },
        modeling.primitives.polygon({ points: s.points }),
      );
      if (s.axis === 'y')
        return modeling.transforms.translate(
          [0, s.origin + s.depth, 0],
          modeling.transforms.rotateX(Math.PI / 2, value),
        );
      return modeling.transforms.translate([0, 0, s.origin], value);
    }
    case 'union':
      return modeling.booleans.union(...s.children.map(solid));
    case 'subtract': {
      const base = s.children[0],
        holes = s.children.slice(1);
      if ((base.kind === 'prism' || base.kind === 'cylinder') && base.axis === 'z') {
        const z = base.kind === 'prism' ? base.origin : base.origin[2];
        const depth = base.kind === 'prism' ? base.depth : base.height;
        if (
          holes.every(
            (h) =>
              h.kind === 'cylinder' &&
              h.axis === 'z' &&
              h.origin[2] <= z &&
              h.origin[2] + h.height >= z + depth,
          )
        ) {
          const outer =
            base.kind === 'prism'
              ? modeling.primitives.polygon({ points: base.points })
              : modeling.primitives.circle({
                  radius: base.radius,
                  segments: 48,
                  center: [base.origin[0], base.origin[1]],
                });
          const section = modeling.booleans.subtract(
            outer,
            ...holes.map((h) => {
              if (h.kind !== 'cylinder') throw new Error('Expected a profile hole');
              return modeling.primitives.circle({
                radius: h.radius,
                segments: 48,
                center: [h.origin[0], h.origin[1]],
              });
            }),
          );
          return modeling.transforms.translate(
            [0, 0, z],
            modeling.extrusions.extrudeLinear({ height: depth }, section),
          );
        }
      }
      return modeling.booleans.subtract(...s.children.map(solid));
    }
  }
}
const cache = new Map<string, Group>();
export function component(
  shape: Shape,
  label: string,
  color: number,
  position: Vec = [0, 0, 0],
  angle = 0,
): Group {
  const key = JSON.stringify(shape);
  let template = cache.get(key);
  if (!template) {
    const value = solid(shape),
      bounds = modeling.measurements.measureBoundingBox(value);
    template = solidUnionMesh(value);
    template.position.set(...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as Vec));
    cache.set(key, template);
    if (cache.size > 128) {
      const oldest = cache.keys().next().value!;
      cache.get(oldest)!.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshStandardMaterial).dispose();
        }
      });
      cache.delete(oldest);
    }
  }
  const item = template.clone(true);
  item.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry = o.geometry.clone();
      o.material = (o.material as MeshStandardMaterial).clone();
      (o.material as MeshStandardMaterial).color.setHex(color);
      o.name = label;
    }
  });
  const group = new Group().add(item);
  group.name = label;
  group.position.set(...position);
  group.rotation.z = (angle * Math.PI) / 180;
  return group;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'box':
      return `Part.makeBox(${s.size.map(num).join(',')},${vector(s.origin)})`;
    case 'cylinder':
      return `Part.makeCylinder(${num(s.radius)},${num(s.height)},${vector(s.origin)},${s.axis === 'y' ? 'App.Vector(0,1,0)' : 'App.Vector(0,0,1)'})`;
    case 'prism': {
      const points = [...s.points, s.points[0]].map(([a, b]) =>
        vector(s.axis === 'y' ? [a, s.origin, b] : [a, b, s.origin]),
      );
      return `Part.Face(Part.makePolygon([${points.join(',')}])).extrude(${vector(s.axis === 'y' ? [0, s.depth, 0] : [0, 0, s.depth])})`;
    }
    default:
      return s.children
        .slice(1)
        .reduce(
          (expr, child) => `${expr}.${s.kind === 'union' ? 'fuse' : 'cut'}(${pythonShape(child)})`,
          pythonShape(s.children[0]),
        );
  }
}
