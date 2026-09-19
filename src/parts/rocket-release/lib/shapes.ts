import modeling from '@jscad/modeling';
import { fusedLayersMesh, type FusedLayers } from './fused-layers';
import { barrelMesh, barrelShape, plugMesh, plugShape } from './barrel';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial, BufferGeometry, BufferAttribute } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Parameters } from '../../../core/types';
import { buildFastenerGeometry, fastenerPython, fastenerValues } from './core/fasteners';
import { threadSolid, type Thread } from './thread';
import native from './st3215-native.json';
import { hatGeometry } from './hat';
import { threadedPlateMesh, type ThreadedPlate } from './threaded-plate';
import { recoverySolidMesh } from './triangulate';
import { springMesh } from './spring';
export type Vec = [number, number, number];
export type Point = [number, number];
export type Shape =
  | FusedLayers
  | { kind: 'springBarrel' | 'springPlug'; travel: number }
  | ThreadedPlate
  | { kind: 'torus'; radius: number; wireRadius: number; arc: number }
  | ({ kind: 'thread' } & Thread)
  | { kind: 'fastener'; parameters: Parameters }
  | { kind: 'native'; index: number }
  | { kind: 'hat' }
  | { kind: 'rotate'; child: Shape; angle: number; axis: 'x' | 'y' }
  | { kind: 'spring'; radius: number; wire: number; height: number; turns: number; origin: Vec }
  | { kind: 'cone'; bottom: number; top: number; height: number; z: number }
  | { kind: 'box'; size: Vec; origin: Vec }
  | { kind: 'cylinder'; radius: number; height: number; origin: Vec; axis: 'x' | 'z' }
  | { kind: 'plate'; outline: Point[]; holes: Point[][]; z: number; height: number }
  | { kind: 'subtract' | 'union'; children: Shape[] }
  | { kind: 'transform'; child: Shape; angle: number; offset: Vec };
export const rotate = (child: Shape, angle: number, axis: 'x' | 'y'): Shape => ({
  kind: 'rotate',
  child,
  angle,
  axis,
});
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
    case 'fusedLayers':
      return solid(s.solid);
    case 'springPlug':
      return solid(plugShape(s.travel));
    case 'springBarrel':
      return solid(barrelShape(s.travel));
    case 'threadedPlate':
      return b.subtract(
        solid(s.plate),
        ...s.holes.map((h) => solid(transform({ kind: 'thread', ...h }, 0, [h.x, h.y, h.z]))),
      );
    case 'torus':
      return p.torus({
        innerRadius: s.wireRadius,
        outerRadius: s.radius,
        innerSegments: 24,
        outerSegments: 96,
        outerRotation: (s.arc * Math.PI) / 180,
      });
    case 'thread':
      return threadSolid(s);
    case 'fastener':
    case 'native':
    case 'hat':
      throw new Error('Native / fastener is a standalone component.');
    case 'rotate':
      return (s.axis === 'x' ? t.rotateX : t.rotateY)((s.angle * Math.PI) / 180, solid(s.child));
    case 'spring':
      throw new Error('Spring is a standalone component, not a boolean operand.');
    case 'cone':
      return t.translate(
        [0, 0, s.z + s.height / 2],
        p.cylinderElliptic({
          startRadius: [s.bottom, s.bottom],
          endRadius: [s.top, s.top],
          height: s.height,
          segments: 96,
        }),
      );
    case 'box':
      return p.cuboid({ size: s.size, center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec });
    case 'cylinder': {
      let v = p.cylinder({ radius: s.radius, height: s.height, segments: 96 });
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
export function component(shape: Shape, label: string, color: number, cloneGeometry = true): Group {
  if (shape.kind === 'transform' || shape.kind === 'rotate') {
    const placed = new Group().add(component(shape.child, label, color, cloneGeometry));
    if (shape.kind === 'transform') {
      placed.rotation.z = (shape.angle * Math.PI) / 180;
      placed.position.set(...shape.offset);
    } else placed.rotation[shape.axis] = (shape.angle * Math.PI) / 180;
    placed.name = label;
    return placed;
  }
  const key = JSON.stringify(shape);
  let template = cache.get(key);
  if (!template) {
    if (shape.kind === 'fusedLayers') {
      template = fusedLayersMesh(shape);
    } else if (shape.kind === 'springPlug') {
      template = plugMesh(shape.travel);
    } else if (shape.kind === 'springBarrel') {
      template = barrelMesh(shape.travel);
    } else if (shape.kind === 'threadedPlate') {
      template = threadedPlateMesh(shape);
    } else if (shape.kind === 'hat') {
      template = hatGeometry();
    } else if (shape.kind === 'native') {
      const record = native.components[shape.index];
      const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(bytes(record.positions)), 3));
      g.setIndex(new BufferAttribute(new Uint32Array(bytes(record.indices)), 1));
      g.computeVertexNormals();
      g.userData.nativeTopology = true;
      template = new Group().add(new Mesh(g, new MeshStandardMaterial()));
    } else if (shape.kind === 'fastener') {
      template = buildFastenerGeometry(shape.parameters);
      template.position.z = fastenerValues(shape.parameters).total / 2;
    } else if (shape.kind === 'spring') {
      template = springMesh(shape.radius, shape.wire, shape.height, shape.turns);
      template.position.set(...shape.origin);
    } else {
      // Preserve the centre of emitted triangles. CSG bounds may still contain
      // degenerate fragments that are removed by the mesh conformity pass.
      template = recoverySolidMesh(solid(shape));
    }
    // Threaded fasteners and machined plates otherwise repeat each triangle's
    // vertices. Index identical attributes before caching/cloning the assembly.
    // This preserves sharp normals and full thread detail while reducing memory.
    template.traverse((object) => {
      if (!(object instanceof Mesh) || object.geometry.index) return;
      const previous = object.geometry;
      object.geometry = mergeVertices(previous, 1e-6);
      previous.dispose();
    });
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
      if (cloneGeometry) o.geometry = o.geometry.clone();
      o.material = (o.material as MeshStandardMaterial).clone();
      if (shape.kind !== 'hat') (o.material as MeshStandardMaterial).color.setHex(color);
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
    case 'fusedLayers':
      return pythonShape(s.solid);
    case 'springPlug':
      return pythonShape(plugShape(s.travel));
    case 'springBarrel':
      return pythonShape(barrelShape(s.travel));
    case 'threadedPlate':
      return pythonShape(
        subtract(
          s.plate,
          ...s.holes.map((h) => transform({ kind: 'thread', ...h }, 0, [h.x, h.y, h.z])),
        ),
      );
    case 'torus':
      return `Part.makeTorus(${s.radius},${s.wireRadius},App.Vector(),App.Vector(0,0,1),-180,180,${s.arc})`;
    case 'native':
      return `_release_native(${s.index})`;
    case 'hat':
      return '_hat_native()';
    case 'fastener':
      return `_release_fastener(${JSON.stringify(fastenerPython(s.parameters))},${fastenerValues(s.parameters).total / 2})`;
    case 'thread':
      return `_release_thread(${s.diameter},${s.pitch},${s.length},${s.clearance},${s.internal ? 'True' : 'False'})`;
    case 'rotate':
      return `_release_rotate(${pythonShape(s.child)},${s.angle},${JSON.stringify(s.axis)})`;
    case 'spring':
      return `_release_spring(${s.radius},${s.wire},${s.height},${s.turns},${JSON.stringify(s.origin)})`;
    case 'cone':
      return `Part.makeCone(${s.bottom},${s.top},${s.height},App.Vector(0,0,${s.z}))`;
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
