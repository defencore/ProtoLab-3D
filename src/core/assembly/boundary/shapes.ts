import { currentGeometryMode } from '../../geometry-mode';
import { nativeThreadExpression } from '../../thread-native';
import { metricThreadCallout, type ThreadCallout } from '../../thread-callouts';
import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import {
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  Vector2,
  ShapeUtils,
} from 'three';
import { solidUnionMesh } from '../../solid-union';
import { num } from '../../geometry';
import { shaftBoreOutline, type ShaftBore } from '../../hardware/shaft-bore';
import { showThreads, type VisualThread } from '../../thread-visual';
export type Vec = [number, number, number];
export type Shape =
  | { kind: 'shaft-bore'; profile: ShaftBore; length: number; z: number }
  | { kind: 'transform'; child: Shape; translation: Vec; rotation: Vec }
  | { kind: 'loft'; rings: Vec[][] }
  | {
      kind: 'curve-loft';
      segments: { kind: 'line' | 'arc' | 'spline'; points: [number, number][] }[];
      layers: { scale: number; angle: number; z: number }[];
      shaftBore?: ShaftBore;
    }
  | {
      kind: 'helical-worm';
      rings: Vec[][];
      tip: number;
      root: number;
      length: number;
      lead: number;
      starts: number;
      phase: number;
      hand: 1 | -1;
      grooveRoot: number;
      grooveTip: number;
      radialExtra: number;
      startZ: number;
    }
  | { kind: 'boundary'; points: Vec[]; faces: number[][]; nativeCuts?: Shape[] }
  | { kind: 'revolve'; profile: [number, number][]; segments?: number; sweep?: number }
  | {
      kind: 'plate';
      outline: [number, number][];
      holes: [number, number][][];
      z: number;
      height: number;
    }
  | { kind: 'sphere'; radius: number; origin: Vec; segments?: number }
  | {
      kind: 'torus';
      major: number;
      minor: number;
      origin: Vec;
      innerSegments?: number;
      outerSegments?: number;
    }
  | { kind: 'box'; size: Vec; origin: Vec }
  | {
      kind: 'cylinder';
      segments?: number;
      radius: number;
      height: number;
      origin: Vec;
      axis: 'x' | 'y' | 'z';
      thread?: {
        pitch: number;
        /** Authored radial inspection fit; nominal drawing diameter remains radius*2. */
        radialClearance?: number;
        internal?: boolean;
        rounded?: boolean;
        left?: boolean;
        /** Explicit source designation; an approximate profile must say so. */
        designation?: string;
        /** A shared cutter crossing component seams is annotated once on its owning part. */
        callout?: boolean;
      };
    }
  | {
      kind: 'prism';
      points: [number, number][];
      depth: number;
      origin: number;
      axis: 'y' | 'z';
    }
  | { kind: 'union'; children: Shape[] }
  | { kind: 'subtract'; children: Shape[] }
  | { kind: 'intersect'; children: Shape[] };
export const box = (size: Vec, origin: Vec): Shape => ({
  kind: 'box',
  size,
  origin,
});
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'x' | 'y' | 'z' = 'z',
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
    case 'shaft-bore':
      return solid({
        kind: 'prism',
        points: shaftBoreOutline(s.profile).map(({ x, y }) => [x, y]),
        depth: s.length,
        origin: s.z,
        axis: 'z',
      });
    case 'curve-loft': {
      const points = s.segments.flatMap((segment) => segment.points.slice(0, -1));
      const rings = s.layers.map((layer) =>
        points.map(([x, y]): Vec => [
          layer.scale * (x * Math.cos(layer.angle) - y * Math.sin(layer.angle)),
          layer.scale * (x * Math.sin(layer.angle) + y * Math.cos(layer.angle)),
          layer.z,
        ]),
      );
      if (!s.shaftBore) return solid({ kind: 'loft', rings });
      // Build the complete annular loft directly. Extending a Boolean bore across
      // dense tooth flanks creates sliver edges that are absent in the design.
      const bore = shaftBoreOutline(s.shaftBore);
      const vertices: Vec[] = [],
        faces: number[][] = [];
      const wall = (a: Vec[], b: Vec[], inward = false) => {
        const base = vertices.length;
        vertices.push(...a, ...b);
        for (let i = 0; i < a.length; i++) {
          const j = (i + 1) % a.length;
          for (const face of [
            [base + i, base + j, base + i + a.length],
            [base + j, base + j + a.length, base + i + a.length],
          ])
            faces.push(inward ? face.reverse() : face);
        }
      };
      for (let i = 1; i < rings.length; i++) wall(rings[i - 1], rings[i]);
      const first = s.layers[0].z,
        last = s.layers.at(-1)!.z;
      wall(
        bore.map(({ x, y }): Vec => [x, y, first]),
        bore.map(({ x, y }): Vec => [x, y, last]),
        true,
      );
      for (const [ring, top] of [
        [rings[0], false],
        [rings.at(-1)!, true],
      ] as const) {
        const outline = ring.map(([x, y]) => new Vector2(x, y));
        const hole = [...bore].reverse();
        const base = vertices.length;
        vertices.push(...ring, ...hole.map(({ x, y }): Vec => [x, y, ring[0][2]]));
        for (const face of ShapeUtils.triangulateShape(outline, [hole]))
          faces.push((top ? face : [face[0], face[2], face[1]]).map((i) => base + i));
      }
      return solid({ kind: 'boundary', points: vertices, faces });
    }
    case 'helical-worm':
      return solid({ kind: 'loft', rings: s.rings });
    case 'sphere':
      return modeling.transforms.translate(
        s.origin,
        modeling.primitives.sphere({ radius: s.radius, segments: s.segments ?? 32 }),
      );
    case 'torus':
      return modeling.transforms.translate(
        s.origin,
        modeling.primitives.torus({
          outerRadius: s.major,
          innerRadius: s.minor,
          innerSegments: s.innerSegments ?? 16,
          outerSegments: s.outerSegments ?? 64,
        }),
      );
    case 'intersect':
      return modeling.booleans.intersect(...s.children.map(solid));
    case 'transform':
      return modeling.transforms.translate(
        s.translation,
        modeling.transforms.rotate(
          s.rotation.map((a) => (a * Math.PI) / 180) as Vec,
          solid(s.child),
        ),
      );
    case 'boundary':
      return modeling.primitives.polyhedron({
        points: s.points,
        faces: s.faces,
        orientation: 'outward',
      });
    case 'loft': {
      const points = s.rings.flat(),
        stride = s.rings[0].length;
      const faces: number[][] = [];
      for (let j = 0; j < s.rings.length - 1; j++)
        for (let i = 0; i < stride; i++) {
          const a = j * stride + i,
            b = j * stride + ((i + 1) % stride);
          faces.push([a, b, b + stride], [a, b + stride, a + stride]);
        }
      faces.push(Array.from({ length: stride }, (_, i) => stride - 1 - i));
      faces.push(Array.from({ length: stride }, (_, i) => points.length - stride + i));
      let volume = 0;
      for (const f of faces)
        for (let i = 1; i < f.length - 1; i++) {
          const [a, b, c] = [f[0], f[i], f[i + 1]].map((k) => new Vector3(...points[k]));
          volume += a.dot(b.cross(c));
        }
      return modeling.primitives.polyhedron({
        points,
        faces: volume < 0 ? faces.map((f) => f.reverse()) : faces,
        orientation: 'outward',
      });
    }
    case 'plate': {
      let section = modeling.primitives.polygon({ points: s.outline });
      if (s.holes.length)
        section = modeling.booleans.subtract(
          section,
          ...s.holes.map((points) => modeling.primitives.polygon({ points })),
        );
      return modeling.transforms.translate(
        [0, 0, s.z],
        modeling.extrusions.extrudeLinear({ height: s.height }, section),
      );
    }
    case 'revolve':
      return modeling.extrusions.extrudeRotate(
        { segments: s.segments ?? 48, angle: ((s.sweep ?? 360) * Math.PI) / 180 },
        modeling.primitives.polygon({ points: s.profile }),
      );
    case 'box':
      return modeling.primitives.cuboid({
        size: s.size,
        center: s.origin.map((v, i) => v + s.size[i] / 2) as Vec,
      });
    case 'cylinder': {
      let value = modeling.primitives.cylinder({
        radius: cylinderRadius(s),
        height: s.height,
        segments: s.segments ?? 48,
      });
      if (s.axis === 'x') value = modeling.transforms.rotateY(Math.PI / 2, value);
      if (s.axis === 'y') value = modeling.transforms.rotateX(-Math.PI / 2, value);
      const center = [...s.origin] as Vec;
      center[s.axis === 'x' ? 0 : s.axis === 'y' ? 1 : 2] += s.height / 2;
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
                  radius: cylinderRadius(base),
                  segments: base.segments ?? 48,
                  center: [base.origin[0], base.origin[1]],
                });
          const section = modeling.booleans.subtract(
            outer,
            ...holes.map((h) => {
              if (h.kind !== 'cylinder') throw new Error('Expected a profile hole');
              return modeling.primitives.circle({
                radius: cylinderRadius(h),
                segments: h.segments ?? 48,
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
  options: { edgeTolerance?: number; minimumTriangleArea?: number; nominal?: boolean } = {},
): Group {
  const key =
    currentGeometryMode() +
    JSON.stringify([shape, options.edgeTolerance ?? 0.01, options.minimumTriangleArea ?? 5e-8]);
  let template = cache.get(key);
  if (!template) {
    const value = solid(shape),
      bounds = modeling.measurements.measureBoundingBox(value);
    template = solidUnionMesh(value, {
      edgeTolerance: options.edgeTolerance ?? 0.01,
      minimumTriangleArea: options.minimumTriangleArea ?? 5e-8,
    });
    // CSG edge refinements can collapse when converted to Float32. Weld to a
    // 0.00001 mm grid and discard only the collapsed faces before export.
    template.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      // Fine source meshes retain their Float32 vertices; rounding past the selected
      // joining tolerance can merge distinct junctions in a small machined detail.
      if ((options.edgeTolerance ?? 0.01) < 1e-5) return;
      const attr = mesh.geometry.getAttribute('position');
      const positions: number[] = [];
      for (let i = 0; i < attr.count; i += 3) {
        const vertices = [0, 1, 2].map(
          (j) =>
            new Vector3(
              ...([attr.getX(i + j), attr.getY(i + j), attr.getZ(i + j)].map(
                (v) => Math.round(v * 1e5) / 1e5,
              ) as Vec),
            ),
        );
        if (
          vertices[1]
            .clone()
            .sub(vertices[0])
            .cross(vertices[2].clone().sub(vertices[0]))
            .lengthSq() <= 1e-18
        )
          continue;
        positions.push(...vertices.flatMap((v) => v.toArray()));
      }
      mesh.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      mesh.geometry.deleteAttribute('normal');
      mesh.geometry.computeVertexNormals();
    });
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
      if (!options.nominal) {
        const threads: VisualThread[] = [];
        const collect = (feature: Shape, frame: Matrix4) => {
          if (feature.kind === 'cylinder' && feature.thread) {
            const axis = new Vector3(
              ...((feature.axis === 'x'
                ? [1, 0, 0]
                : feature.axis === 'y'
                  ? [0, 1, 0]
                  : [0, 0, 1]) as Vec),
            ).transformDirection(frame);
            const origin = new Vector3(...feature.origin)
              .applyMatrix4(frame)
              .sub(template!.position);
            threads.push({
              origin: origin.toArray() as Vec,
              axis: axis.toArray() as Vec,
              diameter: cylinderRadius(feature) * 2,
              length: feature.height,
              ...feature.thread,
            });
          } else if (feature.kind === 'transform') {
            const local = new Matrix4()
              .makeRotationFromEuler(
                new Euler(
                  ...(feature.rotation.map((value) => (value * Math.PI) / 180) as Vec),
                  'ZYX',
                ),
              )
              .setPosition(...feature.translation);
            collect(feature.child, frame.clone().multiply(local));
          } else if ('children' in feature)
            feature.children.forEach((child) => collect(child, frame));
        };
        collect(shape, new Matrix4());
        if (threads.length) showThreads(o, threads);
      }
    }
  });
  const group = new Group().add(item);
  group.name = label;
  group.position.set(...position);
  group.rotation.z = (angle * Math.PI) / 180;
  return group;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
function profileWire(points: [number, number][], z: number): string {
  if (points.length >= 24) {
    const x = points.reduce((value, p) => value + p[0], 0) / points.length,
      y = points.reduce((value, p) => value + p[1], 0) / points.length,
      radius = Math.hypot(points[0][0] - x, points[0][1] - y);
    if (points.every((p) => Math.abs(Math.hypot(p[0] - x, p[1] - y) - radius) < 1e-7))
      return `Part.Wire([Part.makeCircle(${num(radius)},App.Vector(${num(x)},${num(y)},${num(z)}))])`;
  }
  return `Part.makePolygon([${[...points, points[0]].map(([x, y]) => vector([x, y, z])).join(',')}])`;
}
const cylinderRadius = (s: Extract<Shape, { kind: 'cylinder' }>) =>
  s.radius + (s.thread?.radialClearance ?? 0);
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'shaft-bore': {
      const v = s.profile,
        r = v.radius,
        c = r - v.flatDepth;
      if (['hex', 'square', 'polygon'].includes(v.shape))
        return pythonShape({
          kind: 'prism',
          points: shaftBoreOutline(v).map(({ x, y }) => [Number(num(x)), Number(num(y))]),
          depth: s.length,
          origin: s.z,
          axis: 'z',
        });
      let value = `Part.makeCylinder(${num(r)},${num(s.length)},App.Vector(0,0,${num(s.z)}))`;
      if (v.shape === 'd' || v.shape === 'double-d') {
        const left = v.shape === 'd' ? -r - 1 : -c;
        value += `.common(Part.makeBox(${num(c - left)},${num(2 * r + 2)},${num(s.length + 2)},App.Vector(${num(left)},${num(-r - 1)},${num(s.z - 1)})))`;
      } else if (v.shape === 'keyway')
        value += `.fuse(Part.makeBox(${num(r + v.keyDepth)},${num(v.keyWidth)},${num(s.length)},App.Vector(0,${num(-v.keyWidth / 2)},${num(s.z)}))).removeSplitter()`;
      return v.angle
        ? `_pl_transform(${value},[0,0,0],[0,0,${num((v.angle * 180) / Math.PI)}])`
        : value;
    }
    case 'curve-loft': {
      const segments = JSON.stringify(
        s.segments.map((segment) => [
          segment.kind,
          segment.points.map((point) => point.map((value) => Number(num(value)))),
        ]),
      );
      const layers = JSON.stringify(s.layers.map((layer) => [layer.scale, layer.angle, layer.z]));
      const wires = `[Part.Wire([(Part.makeLine(pts[0],pts[-1]) if kind == "line" else Part.Arc(pts[0],pts[len(pts)//2],pts[-1]).toShape() if kind == "arc" else (lambda curve: (curve.interpolate(pts),curve.toShape())[1])(Part.BSplineCurve())) for kind,coordinates in ${segments} for pts in [[App.Vector(scale*(x*math.cos(angle)-y*math.sin(angle)),scale*(x*math.sin(angle)+y*math.cos(angle)),z) for x,y in coordinates]]]) for scale,angle,z in ${layers}]`;
      const loft = `Part.makeLoft(${wires},True,True)`;
      return s.shaftBore
        ? `${loft}.cut(${pythonShape({ kind: 'shaft-bore', profile: s.shaftBore, length: s.layers.at(-1)!.z - s.layers[0].z + 2, z: s.layers[0].z - 1 })})`
        : loft;
    }
    case 'helical-worm': {
      const points: Vec[] = [
        [s.root, 0, -s.grooveRoot],
        [s.tip + s.radialExtra, 0, -s.grooveTip],
        [s.tip + s.radialExtra, 0, s.grooveTip],
        [s.root, 0, s.grooveRoot],
      ];
      const groove = `Part.Wire(Part.makeLongHelix(${num(s.lead)},${num(s.length + 2 * s.lead)},${num(s.root)},0,${s.hand < 0 ? 'True' : 'False'}).Edges).makePipeShell([Part.makePolygon([${[...points, points[0]].map(vector).join(',')}])],True,True)`;
      let value = `Part.makeCylinder(${num(s.tip)},${num(s.length)},App.Vector(0,0,${num(-s.length / 2)}))`;
      for (let start = 0; start < s.starts; start++) {
        const angle =
          ((s.phase + Math.PI / s.starts + (s.hand * 2 * Math.PI * s.startZ) / s.lead) * 180) /
            Math.PI +
          (start * 360) / s.starts;
        value += `.cut(_pl_transform(${groove},[0,0,${num(s.startZ)}],[0,0,${num(angle)}]))`;
      }
      return value;
    }
    case 'sphere':
      return `Part.makeSphere(${num(s.radius)},${vector(s.origin)})`;
    case 'torus':
      return `Part.makeTorus(${num(s.major)},${num(s.minor)},${vector(s.origin)},App.Vector(0,0,1))`;
    case 'transform':
      return `_pl_transform(${pythonShape(s.child)},${JSON.stringify(s.translation)},${JSON.stringify(s.rotation)})`;
    case 'boundary': {
      let value = `Part.makeSolid(Part.makeShell([Part.Face(Part.makePolygon([App.Vector(*pts[i]) for i in face + [face[0]]])) for pts in [${JSON.stringify(s.points)}] for face in ${JSON.stringify(s.faces)}]))`;
      for (const cut of s.nativeCuts ?? []) value += `.cut(${pythonShape(cut)})`;
      return value;
    }
    case 'loft': {
      const points = s.rings.flat(),
        n = s.rings[0].length,
        faces: number[][] = [];
      for (let j = 0; j < s.rings.length - 1; j++)
        for (let i = 0; i < n; i++) {
          const a = j * n + i,
            b = j * n + ((i + 1) % n);
          faces.push([a, b, b + n], [a, b + n, a + n]);
        }
      for (let i = 1; i < n - 1; i++) {
        faces.push([0, i + 1, i]);
        const a = points.length - n;
        faces.push([a, a + i, a + i + 1]);
      }
      const volume = faces.reduce(
        (v, f) =>
          v +
          new Vector3(...points[f[0]]).dot(
            new Vector3(...points[f[1]]).cross(new Vector3(...points[f[2]])),
          ),
        0,
      );
      const oriented = volume < 0 ? faces.map((f) => [...f].reverse()) : faces;
      return `Part.makeSolid(Part.makeShell([Part.Face(Part.makePolygon([App.Vector(*pts[i]) for i in face + [face[0]]])) for pts in [${JSON.stringify(points)}] for face in ${JSON.stringify(oriented)}]))`;
    }
    case 'plate':
      return `${s.holes.reduce((value, hole) => `${value}.cut(Part.Face(${profileWire(hole, s.z)}))`, `Part.Face(${profileWire(s.outline, s.z)})`)}.extrude(App.Vector(0,0,${num(s.height)}))`;
    case 'revolve':
      return `Part.Face(Part.makePolygon([${[...s.profile, s.profile[0]].map(([r, z]) => vector([r, 0, z])).join(',')}])).revolve(App.Vector(0,0,0),App.Vector(0,0,1),${num(s.sweep ?? 360)})`;
    case 'box':
      return `Part.makeBox(${s.size.map(num).join(',')},${vector(s.origin)})`;
    case 'cylinder': {
      if (s.thread && currentGeometryMode() === 'full') {
        const rotation: Vec =
          s.axis === 'x' ? [0, 90, 0] : s.axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
        return `_pl_transform(${nativeThreadExpression({ diameter: 2 * s.radius, pitch: s.thread.pitch, length: s.height, internal: s.thread.internal, left: s.thread.left, rounded: s.thread.rounded, clearance: s.thread.radialClearance })},${JSON.stringify(s.origin)},${JSON.stringify(rotation)})`;
      }
      if (s.segments === 6) {
        const points = Array.from({ length: 6 }, (_, i): Vec => {
          const a = (i * Math.PI) / 3,
            x = cylinderRadius(s) * Math.cos(a),
            y = cylinderRadius(s) * Math.sin(a);
          return s.axis === 'x'
            ? [s.origin[0], s.origin[1] + y, s.origin[2] - x]
            : s.axis === 'y'
              ? [s.origin[0] + x, s.origin[1], s.origin[2] + y]
              : [s.origin[0] + x, s.origin[1] + y, s.origin[2]];
        });
        const axis: Vec =
          s.axis === 'x' ? [s.height, 0, 0] : s.axis === 'y' ? [0, s.height, 0] : [0, 0, s.height];
        return `Part.Face(Part.makePolygon([${[...points, points[0]].map(vector).join(',')}])).extrude(${vector(axis)})`;
      }
      return `Part.makeCylinder(${num(cylinderRadius(s))},${num(s.height)},${vector(s.origin)},${s.axis === 'x' ? 'App.Vector(1,0,0)' : s.axis === 'y' ? 'App.Vector(0,1,0)' : 'App.Vector(0,0,1)'})`;
    }
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
          (expr, child) =>
            `${expr}.${s.kind === 'union' ? 'fuse' : s.kind === 'intersect' ? 'common' : 'cut'}(${pythonShape(child)})`,
          pythonShape(s.children[0]),
        );
  }
}

export function roundedRect(w: number, h: number, r: number, z: number, depth: number): Shape {
  const points: [number, number][] = [];
  for (let corner = 0; corner < 4; corner++) {
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - r);
    const cy = (corner < 2 ? 1 : -1) * (h / 2 - r);
    for (let i = 0; i <= 8; i++) {
      const a = ((corner * 90 + (i * 90) / 8) * Math.PI) / 180;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return prism(points, depth, z);
}
export const ring = (r: number, inner: number, z: number, h: number, x = 0, y = 0): Shape =>
  subtract(cylinder(r, h, [x, y, z]), cylinder(inner, h + 2, [x, y, z - 1]));

/** Drawing callouts retain the declared local machining axes in either detail mode. */
export function boundaryThreadCallouts(shape: Shape): ThreadCallout[] {
  const result: ThreadCallout[] = [];
  const walk = (feature: Shape, frame = new Matrix4()) => {
    if (feature.kind === 'cylinder' && feature.thread && feature.thread.callout !== false) {
      const axis: Vec =
        feature.axis === 'x' ? [1, 0, 0] : feature.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      result.push({
        ...metricThreadCallout(
          2 * feature.radius,
          feature.thread.pitch,
          feature.height,
          !!feature.thread.internal,
          feature.thread.left ? 'left' : 'right',
        ),
        ...(feature.thread.designation ? { designation: feature.thread.designation } : {}),
        origin: new Vector3(...feature.origin).applyMatrix4(frame).toArray(),
        axis: new Vector3(...axis).transformDirection(frame).toArray(),
      });
    } else if (feature.kind === 'transform') {
      const local = new Matrix4()
        .makeRotationFromEuler(
          new Euler(...(feature.rotation.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX'),
        )
        .setPosition(...feature.translation);
      walk(feature.child, frame.clone().multiply(local));
    } else if ('children' in feature) feature.children.forEach((child) => walk(child, frame));
  };
  walk(shape);
  return result;
}
