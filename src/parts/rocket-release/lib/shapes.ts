import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { springMesh } from './spring';
export type Vec = [number, number, number];
export type Point = [number, number];
export type Shape =
  | { kind: 'spring'; radius: number; wire: number; height: number; turns: number; origin: Vec }
  | { kind: 'box'; size: Vec; origin: Vec }
  | { kind: 'cylinder'; radius: number; height: number; origin: Vec; axis: 'x' | 'z' }
  | { kind: 'plate'; outline: Point[]; holes: Point[][]; z: number; height: number }
  | { kind: 'subtract' | 'union'; children: Shape[] }
  | { kind: 'transform'; child: Shape; angle: number; offset: Vec };
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
function solid(s: Shape): Geom3 {
  const { primitives: p, transforms: t, booleans: b, extrusions: e } = modeling;
  switch (s.kind) {
    case 'spring':
      throw new Error('Spring is a standalone component, not a boolean operand.');
    case 'box':
      return p.cuboid({ size: s.size, center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec });
    case 'cylinder': {
      let v = p.cylinder({ radius: s.radius, height: s.height, segments: 120 });
      if (s.axis === 'x') v = t.rotateY(Math.PI / 2, v);
      const center = [...s.origin] as Vec;
      center[s.axis === 'x' ? 0 : 2] += s.height / 2;
      return t.translate(center, v);
    }
    case 'plate': {
      let section = p.polygon({ points: s.outline });
      if (s.holes.length)
        section = b.subtract(section, ...s.holes.map((points) => p.polygon({ points })));
      return t.translate([0, 0, s.z], e.extrudeLinear({ height: s.height }, section));
    }
    case 'transform':
      return t.translate(s.offset, t.rotateZ((s.angle * Math.PI) / 180, solid(s.child)));
    case 'subtract':
      return b.subtract(...s.children.map(solid));
    case 'union':
      return b.union(...s.children.map(solid));
  }
}
const cache = new Map<string, Group>();
export function component(shape: Shape, label: string, color: number): Group {
  const key = JSON.stringify(shape);
  let template = cache.get(key);
  if (!template) {
    if (shape.kind === 'spring') {
      template = springMesh(shape.radius, shape.wire, shape.height, shape.turns);
      template.position.set(...shape.origin);
    } else {
      const value = solid(shape),
        bounds = modeling.measurements.measureBoundingBox(value);
      template = solidUnionMesh(value);
      template.position.set(...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as Vec));
    }
    cache.set(key, template);
    if (cache.size > 180) {
      const first = cache.keys().next().value!;
      cache.get(first)!.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshStandardMaterial).dispose();
        }
      });
      cache.delete(first);
    }
  }
  const result = template.clone(true);
  result.name = label;
  result.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry = o.geometry.clone();
      o.material = (o.material as MeshStandardMaterial).clone();
      (o.material as MeshStandardMaterial).color.setHex(color);
      o.name = label;
    }
  });
  const group = new Group().add(result);
  group.name = label;
  return group;
}
const vector = (v: Vec) => `App.Vector(${v.join(',')})`;
function wire(points: Point[], z: number): string {
  if (points.length >= 24) {
    const x = points.reduce((v, p) => v + p[0], 0) / points.length,
      y = points.reduce((v, p) => v + p[1], 0) / points.length;
    const radius = Math.hypot(points[0][0] - x, points[0][1] - y);
    if (points.every((p) => Math.abs(Math.hypot(p[0] - x, p[1] - y) - radius) < 1e-7))
      return `Part.Wire([Part.makeCircle(${radius},App.Vector(${x},${y},${z}))])`;
  }
  return `Part.makePolygon([${[...points, points[0]].map(([x, y]) => vector([x, y, z])).join(',')}])`;
}
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'spring':
      return `_release_spring(${s.radius},${s.wire},${s.height},${s.turns},${JSON.stringify(s.origin)})`;
    case 'box':
      return `Part.makeBox(${s.size.join(',')},${vector(s.origin)})`;
    case 'cylinder':
      return `Part.makeCylinder(${s.radius},${s.height},${vector(s.origin)},${vector(s.axis === 'x' ? [1, 0, 0] : [0, 0, 1])})`;
    case 'plate':
      return `${s.holes.reduce((v, hole) => `${v}.cut(Part.Face(${wire(hole, s.z)}))`, `Part.Face(${wire(s.outline, s.z)})`)}.extrude(App.Vector(0,0,${s.height}))`;
    case 'transform':
      return `_release_place(${pythonShape(s.child)},${s.angle},${JSON.stringify(s.offset)})`;
    default:
      return s.children
        .slice(1)
        .reduce(
          (v, child) => `${v}.${s.kind === 'union' ? 'fuse' : 'cut'}(${pythonShape(child)})`,
          pythonShape(s.children[0]),
        );
  }
}
