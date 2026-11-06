import {
  roundedRectShape,
  roundedRectPoints,
  nativeProfilePython,
  type NativeProfile,
} from '../../analytic-geometry';
import { analyticRevolvePython } from '../../hardware/analytic-profile';
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
export interface SmoothLoftSection {
  segments: { kind: 'line' | 'arc' | 'spline'; points: Vec[] }[];
}
export type Shape =
  | { kind: 'shaft-bore'; profile: ShaftBore; length: number; z: number }
  | { kind: 'transform'; child: Shape; translation: Vec; rotation: Vec }
  | { kind: 'loft'; rings: Vec[][] }
  | {
      kind: 'smooth-loft';
      sections: SmoothLoftSection[];
      /** Preview samples authored traces; native edges interpolate all source points. */
      previewSamples?: number;
    }
  | {
      kind: 'curve-loft';
      segments: { kind: 'line' | 'arc' | 'spline'; points: [number, number][] }[];
      layers: { scale: number; angle: number; z: number }[];
      shaftBore?: ShaftBore;
      /** Preview-only point budget; native analytic curves retain every source sample. */
      previewSamples?: number;
      previewBoreSegments?: number;
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
  | {
      kind: 'revolve';
      native?: NativeProfile;
      profile: [number, number][];
      segments?: number;
      sweep?: number;
    }
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
      /** Preview tessellation of a true native cylinder, independent of polygon stock. */
      previewSegments?: number;
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
      native?: NativeProfile;
      points: [number, number][];
      depth: number;
      origin: number;
      axis: 'y' | 'z';
    }
  // Native topology checkpoint; preserves the set geometry before later operations.
  | { kind: 'union'; children: Shape[]; nativeRefine?: boolean; nativeBatch?: boolean }
  | { kind: 'subtract'; children: Shape[]; nativeRefine?: boolean }
  | { kind: 'intersect'; children: Shape[]; nativeRefine?: boolean };
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
function loftSolid(rings: Vec[][], triangulateCaps = false, spatialCaps = false): Geom3 {
  const points = rings.flat(),
    stride = rings[0].length;
  const faces: number[][] = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < stride; i++) {
      const a = j * stride + i,
        b = j * stride + ((i + 1) % stride);
      faces.push([a, b, b + stride], [a, b + stride, a + stride]);
    }
  for (const [ring, offset, reverse] of [
    [rings[0], 0, true],
    [rings.at(-1)!, points.length - stride, false],
  ] as const) {
    if (triangulateCaps) {
      let outline = ring.map(([x, y]) => new Vector2(x, y));
      if (spatialCaps) {
        const origin = new Vector3(...ring[0]);
        const u = new Vector3(...ring[1]).sub(origin).normalize();
        const normal = ring
          .reduce((sum, point, i) => {
            const a = new Vector3(...point).sub(origin);
            const b = new Vector3(...ring[(i + 1) % ring.length]).sub(origin);
            return sum.add(a.cross(b));
          }, new Vector3())
          .normalize();
        const v = new Vector3().crossVectors(normal, u);
        outline = ring.map((point) => {
          const delta = new Vector3(...point).sub(origin);
          return new Vector2(delta.dot(u), delta.dot(v));
        });
      }
      const area = outline.reduce((sum, p, i) => {
        const next = outline[(i + 1) % outline.length];
        return sum + p.x * next.y - next.x * p.y;
      }, 0);
      // JSCAD Boolean polygons must be convex. A multi-start worm's end
      // profile is concave; passing it as one polygon creates cap vertices
      // outside the stock cylinder when a journal is united at that plane.
      for (const indices of ShapeUtils.triangulateShape(outline, [])) {
        const [a, b, c] = indices.map((index) => outline[index]);
        const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const face = indices.map((index) => index + offset);
        if (cross * area < 0 !== reverse) face.reverse();
        faces.push(face);
      }
    } else {
      const face = Array.from({ length: stride }, (_, i) => offset + i);
      faces.push(reverse ? face.reverse() : face);
    }
  }
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

function sampledTrace(points: Vec[], count: number): Vec[] {
  if (points.length === count) return points;
  const distances = [0];
  for (let i = 1; i < points.length; i++)
    distances.push(
      distances[i - 1] + new Vector3(...points[i]).distanceTo(new Vector3(...points[i - 1])),
    );
  const total = distances.at(-1)!;
  let segment = 1;
  return Array.from({ length: count }, (_, i): Vec => {
    const target = (total * i) / (count - 1);
    while (segment < distances.length - 1 && distances[segment] < target) segment++;
    const t = (target - distances[segment - 1]) / (distances[segment] - distances[segment - 1]);
    return new Vector3(...points[segment - 1])
      .lerp(new Vector3(...points[segment]), t)
      .toArray() as Vec;
  });
}

function sampledArc(points: Vec[], count: number): Vec[] {
  const a = new Vector3(...points[0]),
    b = new Vector3(...points[1]),
    c = new Vector3(...points[2]);
  const u = b.clone().sub(a),
    v = c.clone().sub(a),
    normal = u.clone().cross(v);
  const center = a.clone().add(
    v
      .clone()
      .cross(normal)
      .multiplyScalar(u.lengthSq())
      .add(normal.clone().cross(u).multiplyScalar(v.lengthSq()))
      .multiplyScalar(1 / (2 * normal.lengthSq())),
  );
  const radial = a.clone().sub(center),
    tangent = normal.clone().normalize().cross(radial);
  const angle = (point: Vector3) => {
    const delta = point.clone().sub(center);
    const value = Math.atan2(delta.dot(tangent), delta.dot(radial));
    return value < 0 ? value + 2 * Math.PI : value;
  };
  const sweep = angle(c);
  return Array.from({ length: count }, (_, i): Vec => {
    const t = (sweep * i) / (count - 1);
    return center
      .clone()
      .addScaledVector(radial, Math.cos(t))
      .addScaledVector(tangent, Math.sin(t))
      .toArray() as Vec;
  });
}

/** Tessellated approximation; OCC smooth interpolation between stations is native-only. */
export function smoothLoftRings(s: Extract<Shape, { kind: 'smooth-loft' }>): Vec[][] {
  const counts = s.sections[0].segments.map((segment, i) =>
    segment.kind === 'line'
      ? 2
      : (s.previewSamples ??
        Math.max(
          segment.kind === 'arc' ? 33 : 3,
          ...s.sections.map((section) => section.segments[i].points.length),
        )),
  );
  return s.sections.map((section) =>
    section.segments.flatMap((segment, i) => {
      const points =
        segment.kind === 'line'
          ? segment.points
          : segment.kind === 'arc'
            ? sampledArc(segment.points, counts[i])
            : sampledTrace(segment.points, counts[i]);
      return points.slice(0, -1);
    }),
  );
}

/** Sample the same line/arc definitions used by the native ruled loft. */
export function curveLoftRings(s: Extract<Shape, { kind: 'curve-loft' }>): Vec[][] {
  return smoothLoftRings({
    kind: 'smooth-loft',
    previewSamples: s.previewSamples,
    sections: s.layers.map((layer) => ({
      segments: s.segments.map((segment) => {
        const points =
          segment.kind === 'arc'
            ? [
                segment.points[0],
                segment.points[Math.floor(segment.points.length / 2)],
                segment.points.at(-1)!,
              ]
            : segment.kind === 'line'
              ? [segment.points[0], segment.points.at(-1)!]
              : segment.points;
        return {
          kind: segment.kind,
          points: points.map(([x, y]): Vec => [
            layer.scale * (x * Math.cos(layer.angle) - y * Math.sin(layer.angle)),
            layer.scale * (x * Math.sin(layer.angle) + y * Math.cos(layer.angle)),
            layer.z,
          ]),
        };
      }),
    })),
  });
}

function solid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'smooth-loft':
      return loftSolid(smoothLoftRings(s), true, true);
    case 'shaft-bore':
      return solid({
        kind: 'prism',
        points: shaftBoreOutline(s.profile).map(({ x, y }) => [x, y]),
        depth: s.length,
        origin: s.z,
        axis: 'z',
      });
    case 'curve-loft': {
      const rings = curveLoftRings(s);
      if (!s.shaftBore) return solid({ kind: 'loft', rings });
      // Build the complete annular loft directly. Extending a Boolean bore across
      // dense tooth flanks creates sliver edges that are absent in the design.
      const sourceBore = shaftBoreOutline(s.shaftBore);
      const bore =
        s.shaftBore.shape === 'round' &&
        s.previewBoreSegments &&
        s.previewBoreSegments < sourceBore.length
          ? Array.from(
              { length: s.previewBoreSegments },
              (_, i) =>
                sourceBore[
                  Math.round((i * sourceBore.length) / s.previewBoreSegments!) % sourceBore.length
                ],
            )
          : sourceBore;
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
      return loftSolid(s.rings, true);
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
    case 'loft':
      return loftSolid(s.rings);
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
        segments: s.previewSegments ?? s.segments ?? 48,
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
                  segments: base.previewSegments ?? base.segments ?? 48,
                  center: [base.origin[0], base.origin[1]],
                });
          const section = modeling.booleans.subtract(
            outer,
            ...holes.map((h) => {
              if (h.kind !== 'cylinder') throw new Error('Expected a profile hole');
              return modeling.primitives.circle({
                radius: cylinderRadius(h),
                segments: h.previewSegments ?? h.segments ?? 48,
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
  if ('native' in s && s.native) return nativeProfilePython(s.native);
  switch (s.kind) {
    case 'smooth-loft': {
      const sections = JSON.stringify(
        s.sections.map((section) =>
          section.segments.map((segment) => [
            segment.kind,
            segment.points.map((point) => point.map((value) => Number(num(value)))),
          ]),
        ),
      );
      const wires = `[Part.Wire([(Part.makeLine(pts[0],pts[-1]) if kind == "line" else Part.Arc(pts[0],pts[1],pts[2]).toShape() if kind == "arc" else (lambda curve: (curve.interpolate(pts),curve.toShape())[1])(Part.BSplineCurve())) for kind,coordinates in section for pts in [[App.Vector(*point) for point in coordinates]]]) for section in ${sections}]`;
      return `Part.makeLoft(${wires},True,False,False,5)`;
    }
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
      return analyticRevolvePython(s.profile, 0, s.sweep ?? 360);
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
    default: {
      const flattenBatch = (children: Shape[]): Shape[] =>
        children.flatMap((child) =>
          child.kind === 'union' && child.nativeBatch && !child.nativeRefine
            ? flattenBatch(child.children)
            : [child],
        );
      const batch = s.kind === 'union' && s.nativeBatch ? flattenBatch(s.children) : undefined;
      const expression =
        batch && batch.length > 1
          ? `${pythonShape(batch[0])}.multiFuse([${batch.slice(1).map(pythonShape).join(',')}])`
          : s.children
              .slice(1)
              .reduce(
                (expr, child) =>
                  `${expr}.${s.kind === 'union' ? 'fuse' : s.kind === 'intersect' ? 'common' : 'cut'}(${pythonShape(child)})`,
                pythonShape(s.children[0]),
              );
      return s.nativeRefine ? `(${expression}).removeSplitter()` : expression;
    }
  }
}

export function roundedRect(w: number, h: number, r: number, z: number, depth: number): Shape {
  const native = roundedRectShape(w, h, r, z, depth);
  return { kind: 'prism', points: roundedRectPoints(native), depth, origin: z, axis: 'z', native };
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
