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

/** The same truncated 60-degree radial profile drives the mesh and CAD sweep. */
function threadSolid(s: Thread): Geom3 {
  const segments = 40,
    levels = Math.max(1, Math.ceil((s.height / s.pitch) * 12));
  const depth = (((s.internal ? 5 : 17 / 3) * Math.sqrt(3)) / 16) * s.pitch;
  const rings = Array.from({ length: levels + 1 }, (_, level) => {
    const z = (s.height * level) / levels;
    return Array.from({ length: segments }, (_, i): Vec => {
      const a = (2 * Math.PI * i) / segments;
      const phase = z / s.pitch - (s.hand * a) / (2 * Math.PI);
      const distance = Math.abs(phase - Math.round(phase));
      const high = 1 / 16;
      const width = depth / (Math.sqrt(3) * s.pitch);
      const f = Math.max(0, Math.min(1, (high + width - distance) / width));
      const r = s.radius - depth * (1 - f);
      return [s.origin[0] + r * Math.cos(a), s.origin[1] + r * Math.sin(a), s.origin[2] + z];
    });
  });
  const faces: number[][] = [];
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments),
        c = a + segments,
        d = b + segments;
      faces.push([a, b, c], [b, d, c]);
    }
  faces.push(Array.from({ length: segments }, (_, i) => segments - i - 1));
  faces.push(Array.from({ length: segments }, (_, i) => levels * segments + i));
  return modeling.primitives.polyhedron({ points: rings.flat(), faces, orientation: 'outward' });
}
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
      return threadSolid(s);
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
      return `clevis_thread(${num(s.radius)},${num(s.height)},${vector(s.origin)},${num(s.pitch)},${s.hand < 0 ? 'True' : 'False'},${s.internal ? 'True' : 'False'})`;
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
    return solid

def clevis_thread(radius, height, origin, pitch, left, internal):
    depth = (5 if internal else 17/3)*math.sqrt(3)*pitch/16
    minor = radius-depth
    overlap = pitch*0.08
    root_half_width = pitch/2-pitch/16-depth/math.sqrt(3)
    crest_half_width = 7*pitch/16+overlap/math.sqrt(3)
    points = [App.Vector(minor,0,-root_half_width),App.Vector(radius+overlap,0,-crest_half_width),App.Vector(radius+overlap,0,crest_half_width),App.Vector(minor,0,root_half_width)]
    profile = Part.Wire(Part.makePolygon(points+[points[0]]).Edges)
    path = Part.Wire(Part.makeLongHelix(pitch,height+2*pitch,minor,0,left).Edges)
    groove = path.makePipeShell([profile],True,True)
    groove.translate(App.Vector(0,0,-pitch/2))
    solid = Part.makeCylinder(radius,height).cut(groove).removeSplitter()
    solid.translate(origin)
    if solid.isNull() or not solid.isValid(): raise ValueError("Clevis thread construction failed.")
    return solid`;
