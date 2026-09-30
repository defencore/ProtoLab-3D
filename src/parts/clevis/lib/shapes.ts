import { showThreads, type VisualThread } from '../../../core/thread-visual';
import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { num } from '../../../core/geometry';
import { conformThreadMesh } from './conform';

export type Vec = [number, number, number];
type Cylinder = {
  kind: 'cylinder';
  radius: number;
  height: number;
  origin: Vec;
  axis: 'z' | 'y';
  segments: number;
};
type Box = { kind: 'box'; size: Vec; origin: Vec };
type BooleanShape = { kind: 'union' | 'subtract' | 'intersect'; children: Shape[] };
type Thread = {
  kind: 'thread';
  radius: number;
  height: number;
  origin: Vec;
  pitch: number;
  hand: number;
  internal: boolean;
};
export type Shape = Cylinder | Box | BooleanShape | Thread;
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'z' | 'y' = 'z',
  segments = 48,
): Cylinder => ({ kind: 'cylinder', radius, height, origin, axis, segments });
export const box = (size: Vec, origin: Vec): Box => ({ kind: 'box', size, origin });
export const union = (...children: Shape[]): BooleanShape => ({ kind: 'union', children });
export const subtract = (...children: Shape[]): BooleanShape => ({ kind: 'subtract', children });
export const intersect = (...children: Shape[]): BooleanShape => ({ kind: 'intersect', children });
export const thread = (
  radius: number,
  height: number,
  origin: Vec,
  pitch: number,
  hand: number,
  internal: boolean,
): Thread => ({ kind: 'thread', radius, height, origin, pitch, hand, internal });

export function toSolid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'cylinder': {
      let solid = modeling.primitives.cylinder({
        radius: s.radius,
        height: s.height,
        segments: s.segments,
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
    case 'thread':
      return toSolid(cylinder(s.radius, s.height, s.origin, 'z', 64));
    case 'union':
      return modeling.booleans.union(...s.children.map(toSolid));
    case 'subtract':
      return modeling.booleans.subtract(...s.children.map(toSolid));
    case 'intersect':
      return modeling.booleans.intersect(...s.children.map(toSolid));
  }
}
// Keep a small geometry cache so assembly-state changes do not repeat thread Booleans.
const componentCache = new Map<string, Group>();
export function component(s: Shape, label: string, color: number): Group {
  const key = JSON.stringify(s);
  let cached = componentCache.get(key);
  if (!cached) {
    const solid = toSolid(s),
      bounds = modeling.measurements.measureBoundingBox(solid);
    cached = conformThreadMesh(solidUnionMesh(solid));
    cached.position.set(...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as Vec));
    componentCache.set(key, cached);
    if (componentCache.size > 8) {
      const oldest = componentCache.keys().next().value!;
      componentCache.get(oldest)!.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          (child.material as MeshStandardMaterial).dispose();
        }
      });
      componentCache.delete(oldest);
    }
  } else {
    componentCache.delete(key);
    componentCache.set(key, cached);
  }
  const group = cached.clone(true);
  group.name = label;
  group.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry = child.geometry.clone();
    child.material = (child.material as MeshStandardMaterial).clone();
    (child.material as MeshStandardMaterial).color.setHex(color);
    const threads: VisualThread[] = [];
    const walk = (s: Shape) => {
      if (s.kind === 'thread')
        threads.push({
          origin: s.origin.map((v, i) => v - cached!.position.getComponent(i)) as Vec,
          axis: [0, 0, 1],
          diameter: 2 * s.radius,
          pitch: s.pitch,
          length: s.height,
          internal: s.internal,
          left: s.hand < 0,
        });
      else if ('children' in s) s.children.forEach(walk);
    };
    walk(s);
    if (threads.length) showThreads(child, threads);
  });
  return group;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'cylinder':
      return s.segments === 6
        ? `clevis_hex(${num(s.radius)},${num(s.height)},${vector(s.origin)},${s.axis === 'y' ? 'True' : 'False'})`
        : `Part.makeCylinder(${num(s.radius)},${num(s.height)},${vector(s.origin)},${s.axis === 'y' ? 'App.Vector(0,1,0)' : 'App.Vector(0,0,1)'})`;
    case 'box':
      return `Part.makeBox(${s.size.map(num).join(',')},${vector(s.origin)})`;
    case 'thread':
      return `Part.makeCylinder(${num(s.radius)},${num(s.height)},${vector(s.origin)})`;
    default: {
      const method = s.kind === 'union' ? 'fuse' : s.kind === 'subtract' ? 'cut' : 'common';
      return s.children
        .slice(1)
        .reduce(
          (expr, child) => `${expr}.${method}(${pythonShape(child)})`,
          pythonShape(s.children[0]),
        );
    }
  }
}
export const pythonHelpers = `def clevis_hex(radius, height, origin, along_y):
    points = [App.Vector(radius*math.cos(i*math.pi/3),radius*math.sin(i*math.pi/3),0) for i in range(6)]
    solid = Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    if along_y: solid.rotate(App.Vector(0,0,0),App.Vector(1,0,0),-90)
    solid.translate(origin)
    return solid`;
