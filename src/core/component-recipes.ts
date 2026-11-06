import { Matrix4, Euler, Vector3 } from 'three';
import type { Shape, Vec } from './assembly/boundary/shapes';
import type { AssemblyComponent, AssemblyDefinition } from './product-types';
import { nativeThreadDepth } from './thread-native';
import { roundedRectPoints, annularSectorPoints, type NativeProfile } from './analytic-geometry';

const triple = (v: unknown): v is Vec =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7);
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1e7;

/** Analytic metadata must describe the same sampled preview, never independent geometry. */
function checkNativeProfile(raw: unknown, shape: Record<string, unknown>): void {
  const fail = () => {
    throw new Error('Invalid analytic native profile in component feature.');
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail();
  const data = raw as Record<string, unknown>;
  const finite = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7;
  let keys: string[];
  switch (data.kind) {
    case 'rounded-rect':
      keys = ['kind', 'width', 'height', 'radius', 'z', 'depth', 'translation'];
      break;
    case 'annular-sector':
      keys = ['kind', 'inner', 'outer', 'start', 'end', 'z', 'depth', 'translation'];
      break;
    case 'torus':
      keys = ['kind', 'major', 'minor', 'z', 'translation'];
      break;
    default:
      return fail();
  }
  if (
    Object.keys(data).some((key) => !keys.includes(key)) ||
    keys
      .filter((key) => !['kind', 'translation'].includes(key))
      .some((key) => !finite(data[key])) ||
    (data.translation !== undefined && !triple(data.translation))
  )
    fail();
  const native = data as unknown as NativeProfile;
  const [x, y, z] = native.translation ?? [0, 0, 0];
  let points: [number, number][];
  if (native.kind === 'torus') {
    if (
      shape.kind !== 'revolve' ||
      !(native.major > native.minor && native.minor > 0) ||
      x !== 0 ||
      y !== 0 ||
      (shape.sweep !== undefined && shape.sweep !== 360)
    )
      fail();
    points = Array.from({ length: 24 }, (_, i) => [
      native.major + native.minor * Math.cos((i * Math.PI) / 12),
      native.z + native.minor * Math.sin((i * Math.PI) / 12) + z,
    ]);
  } else {
    if (
      shape.kind !== 'prism' ||
      shape.axis !== 'z' ||
      shape.depth !== native.depth ||
      native.depth <= 0 ||
      Math.abs(Number(shape.origin) - native.z - z) > 1e-7
    )
      fail();
    if (native.kind === 'rounded-rect') {
      if (
        native.width <= 0 ||
        native.height <= 0 ||
        native.radius < 0 ||
        native.radius > Math.min(native.width, native.height) / 2
      )
        fail();
      points = roundedRectPoints(native);
    } else {
      if (
        native.inner < 0 ||
        native.outer <= native.inner ||
        Math.abs(native.end - native.start) < 1e-9 ||
        Math.abs(native.end - native.start) > 360
      )
        fail();
      points = annularSectorPoints(native);
    }
    points = points.map(([a, b]) => [a + x, b + y]);
  }
  const actual = (shape.kind === 'prism' ? shape.points : shape.profile) as number[][];
  const tolerance = Math.max(1, ...points.flat().map(Math.abs)) * 1e-9;
  const matches = (expected: number[][]) =>
    expected.length === actual.length &&
    expected.every((point, i) =>
      point.every((value, axis) => Math.abs(value - actual[i][axis]) <= tolerance),
    );
  if (!matches(points) && !matches([...points].reverse())) fail();
}
/** Accept geometry data only. No code strings, source execution or arbitrary shape kinds. */
export function parseDetailRecipe(source: string): Shape {
  if (source.length > 4_000_000) throw new Error('Component recipe exceeds the size limit.');
  const root: unknown = JSON.parse(source);
  let nodes = 0;
  function check(raw: unknown, depth = 0): asserts raw is Shape {
    if (++nodes > 50000 || depth > 64) throw new Error('Component recipe is too complex.');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid component feature.');
    const s = raw as Record<string, unknown>;
    const fail = () => {
      throw new Error('Invalid ' + String(s.kind) + ' component feature.');
    };
    const points = (value: unknown, size: number, minimum: number) =>
      Array.isArray(value) &&
      value.length >= minimum &&
      value.length <= 50000 &&
      value.every(
        (v) =>
          Array.isArray(v) &&
          v.length === size &&
          v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7),
      );
    let keys: string[];
    const segments = (value: unknown) =>
      value === undefined ||
      (Number.isInteger(value) && Number(value) >= 3 && Number(value) <= 2048);
    switch (s.kind) {
      case 'shaft-bore': {
        keys = ['kind', 'profile', 'length', 'z'];
        const profile = s.profile as Record<string, unknown>;
        if (
          !profile ||
          typeof profile !== 'object' ||
          Array.isArray(profile) ||
          Object.keys(profile).some(
            (key) =>
              !['shape', 'radius', 'angle', 'flatDepth', 'sides', 'keyWidth', 'keyDepth'].includes(
                key,
              ),
          ) ||
          !['round', 'hex', 'd', 'double-d', 'square', 'polygon', 'keyway'].includes(
            String(profile.shape),
          ) ||
          !['radius', 'flatDepth', 'keyWidth', 'keyDepth'].every((key) => positive(profile[key])) ||
          typeof profile.angle !== 'number' ||
          !Number.isFinite(profile.angle) ||
          Math.abs(profile.angle) > 1e7 ||
          !Number.isInteger(profile.sides) ||
          Number(profile.sides) < 3 ||
          Number(profile.sides) > 12 ||
          !positive(s.length) ||
          typeof s.z !== 'number' ||
          !Number.isFinite(s.z) ||
          (['d', 'double-d'].includes(String(profile.shape)) &&
            Number(profile.flatDepth) >= Number(profile.radius)) ||
          (profile.shape === 'keyway' && Number(profile.keyWidth) >= 2 * Number(profile.radius))
        )
          fail();
        break;
      }
      case 'sphere':
        keys = ['kind', 'radius', 'origin', 'segments'];
        if (!positive(s.radius) || !triple(s.origin) || !segments(s.segments)) fail();
        break;
      case 'torus':
        keys = ['kind', 'major', 'minor', 'origin', 'innerSegments', 'outerSegments'];
        if (
          !positive(s.major) ||
          !positive(s.minor) ||
          Number(s.major) <= Number(s.minor) ||
          !triple(s.origin) ||
          !segments(s.innerSegments) ||
          !segments(s.outerSegments)
        )
          fail();
        break;
      case 'box':
        keys = ['kind', 'size', 'origin'];
        if (!triple(s.size) || !s.size.every(positive) || !triple(s.origin)) fail();
        break;
      case 'cylinder':
        keys = [
          'kind',
          'radius',
          'height',
          'origin',
          'axis',
          'segments',
          'previewSegments',
          'thread',
        ];
        if (
          !positive(s.radius) ||
          !positive(s.height) ||
          !triple(s.origin) ||
          !['x', 'y', 'z'].includes(String(s.axis))
        )
          fail();
        if (
          s.segments !== undefined &&
          (!Number.isInteger(s.segments) || Number(s.segments) < 3 || Number(s.segments) > 2048)
        )
          fail();
        if (
          !segments(s.previewSegments) ||
          (s.previewSegments !== undefined && s.segments !== undefined && Number(s.segments) <= 12)
        )
          fail();
        if (s.thread !== undefined) {
          const t = s.thread as Record<string, unknown>;
          if (
            !t ||
            !positive(t.pitch) ||
            Object.keys(t).some(
              (k) =>
                ![
                  'pitch',
                  'internal',
                  'rounded',
                  'left',
                  'designation',
                  'callout',
                  'radialClearance',
                ].includes(k),
            ) ||
            (t.radialClearance !== undefined &&
              (typeof t.radialClearance !== 'number' ||
                !Number.isFinite(t.radialClearance) ||
                t.radialClearance < 0 ||
                t.radialClearance > Number(s.radius) / 4)) ||
            (t.designation !== undefined &&
              (typeof t.designation !== 'string' ||
                !t.designation.trim() ||
                t.designation.length > 512)) ||
            ['internal', 'rounded', 'left', 'callout'].some(
              (k) => t[k] !== undefined && typeof t[k] !== 'boolean',
            )
          )
            fail();
          if (
            Number(s.radius) <=
            nativeThreadDepth(Number(t.pitch), t.internal === true, t.rounded === true)
          )
            fail();
        }
        break;
      case 'prism':
        keys = ['kind', 'points', 'depth', 'origin', 'axis', 'native'];
        if (
          !points(s.points, 2, 3) ||
          !positive(s.depth) ||
          typeof s.origin !== 'number' ||
          !Number.isFinite(s.origin) ||
          !['y', 'z'].includes(String(s.axis))
        )
          fail();
        if (s.native !== undefined) checkNativeProfile(s.native, s);
        break;
      case 'plate':
        keys = ['kind', 'outline', 'holes', 'z', 'height'];
        if (
          !points(s.outline, 2, 3) ||
          !Array.isArray(s.holes) ||
          !s.holes.every((hole) => points(hole, 2, 3)) ||
          typeof s.z !== 'number' ||
          !Number.isFinite(s.z) ||
          !positive(s.height)
        )
          fail();
        break;
      case 'revolve':
        keys = ['kind', 'profile', 'segments', 'sweep', 'native'];
        if (
          !points(s.profile, 2, 3) ||
          (s.profile as number[][]).some((p) => p[0] < 0) ||
          (s.sweep !== undefined && (!positive(s.sweep) || Number(s.sweep) > 360)) ||
          !segments(s.segments)
        )
          fail();
        if (s.native !== undefined) checkNativeProfile(s.native, s);
        break;
      case 'loft':
      case 'helical-worm':
        keys =
          s.kind === 'loft'
            ? ['kind', 'rings']
            : [
                'kind',
                'rings',
                'tip',
                'root',
                'length',
                'lead',
                'starts',
                'phase',
                'hand',
                'grooveRoot',
                'grooveTip',
                'radialExtra',
                'startZ',
              ];
        if (
          !Array.isArray(s.rings) ||
          s.rings.length < 2 ||
          !s.rings.every((r) => points(r, 3, 3) && r.length === (s.rings as number[][][])[0].length)
        )
          fail();
        if (
          s.kind === 'helical-worm' &&
          (!['tip', 'root', 'length', 'lead', 'grooveRoot', 'grooveTip', 'radialExtra'].every(
            (key) => positive(s[key]),
          ) ||
            Number(s.tip) <= Number(s.root) ||
            !Number.isInteger(s.starts) ||
            Number(s.starts) < 1 ||
            Number(s.starts) > 16 ||
            ![1, -1].includes(s.hand as number) ||
            ![s.phase, s.startZ].every(
              (value) =>
                typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7,
            ))
        )
          fail();
        break;
      case 'smooth-loft': {
        keys = ['kind', 'sections', 'previewSamples'];
        if (!segments(s.previewSamples) || !Array.isArray(s.sections) || s.sections.length < 2)
          fail();
        let firstNormal: Vector3 | undefined;
        let firstOrigin: Vector3 | undefined;
        let pattern: string[] | undefined;
        let spatial = false;
        for (const rawSection of s.sections as unknown[]) {
          if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) fail();
          const section = rawSection as Record<string, unknown>;
          if (
            Object.keys(section).some((key) => key !== 'segments') ||
            !Array.isArray(section.segments) ||
            section.segments.length < 2
          )
            fail();
          const edges = section.segments as Record<string, unknown>[];
          const contour: Vector3[] = [];
          const edgePoints: Vec[][] = [];
          for (const edge of edges) {
            if (
              !edge ||
              typeof edge !== 'object' ||
              Array.isArray(edge) ||
              Object.keys(edge).some((key) => !['kind', 'points'].includes(key)) ||
              !['line', 'arc', 'spline'].includes(String(edge.kind)) ||
              !points(edge.points, 3, edge.kind === 'line' ? 2 : 3) ||
              (edge.kind === 'line' && (edge.points as unknown[]).length !== 2) ||
              (edge.kind === 'arc' && (edge.points as unknown[]).length !== 3)
            )
              fail();
            const coordinates = edge.points as Vec[];
            for (let i = 1; i < coordinates.length; i++)
              if (
                new Vector3(...coordinates[i]).distanceTo(new Vector3(...coordinates[i - 1])) < 1e-7
              )
                fail();
            if (edge.kind === 'arc') {
              const a = new Vector3(...coordinates[0]);
              if (
                new Vector3(...coordinates[1])
                  .sub(a)
                  .cross(new Vector3(...coordinates[2]).sub(a))
                  .length() < 1e-10
              )
                fail();
            }
            edgePoints.push(coordinates);
            contour.push(...coordinates.slice(0, -1).map((point) => new Vector3(...point)));
          }
          if ((nodes += edges.length + 1) > 50000) fail();
          const currentPattern = edges.map((edge) => String(edge.kind));
          if (
            pattern &&
            (pattern.length !== currentPattern.length ||
              pattern.some((kind, i) => kind !== currentPattern[i]))
          )
            fail();
          pattern = currentPattern;
          for (let i = 0; i < edgePoints.length; i++)
            if (
              new Vector3(...edgePoints[i].at(-1)!).distanceTo(
                new Vector3(...edgePoints[(i + 1) % edgePoints.length][0]),
              ) > 1e-7
            )
              fail();
          const origin = contour[0];
          const normal = contour.reduce(
            (sum, point, i) =>
              sum.add(
                point
                  .clone()
                  .sub(origin)
                  .cross(contour[(i + 1) % contour.length].clone().sub(origin)),
              ),
            new Vector3(),
          );
          if (normal.length() < 1e-10) fail();
          normal.normalize();
          if (contour.some((point) => Math.abs(point.clone().sub(origin).dot(normal)) > 1e-7))
            fail();
          if (firstNormal && firstNormal.dot(normal) <= 0) fail();
          if (
            firstNormal &&
            contour.some(
              (point) => Math.abs(point.clone().sub(firstOrigin!).dot(firstNormal!)) > 1e-7,
            )
          )
            spatial = true;
          firstNormal ??= normal;
          firstOrigin ??= origin;
        }
        if (!spatial) fail();
        break;
      }
      case 'curve-loft':
        keys = ['kind', 'segments', 'layers', 'shaftBore', 'previewSamples', 'previewBoreSegments'];
        if (!segments(s.previewSamples) || !segments(s.previewBoreSegments)) fail();
        if (
          !Array.isArray(s.segments) ||
          !s.segments.length ||
          !s.segments.every(
            (segment) =>
              segment &&
              typeof segment === 'object' &&
              Object.keys(segment).every((key) => ['kind', 'points'].includes(key)) &&
              ['line', 'arc', 'spline'].includes(segment.kind) &&
              points(segment.points, 2, segment.kind === 'line' ? 2 : 3),
          ) ||
          !Array.isArray(s.layers) ||
          s.layers.length < 2 ||
          !s.layers.every(
            (layer) =>
              layer &&
              typeof layer === 'object' &&
              Object.keys(layer).every((key) => ['scale', 'angle', 'z'].includes(key)) &&
              positive(layer.scale) &&
              [layer.angle, layer.z].every(
                (value) =>
                  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7,
              ),
          )
        )
          fail();
        if (s.shaftBore !== undefined) {
          const layers = s.layers as { z: number }[];
          check(
            {
              kind: 'shaft-bore',
              profile: s.shaftBore,
              length: layers.at(-1)!.z - layers[0].z,
              z: layers[0].z,
            },
            depth + 1,
          );
        }
        break;
      case 'boundary':
        keys = ['kind', 'points', 'faces', 'nativeCuts'];
        if (
          !points(s.points, 3, 4) ||
          !Array.isArray(s.faces) ||
          s.faces.length < 4 ||
          !s.faces.every(
            (f) =>
              Array.isArray(f) &&
              f.length >= 3 &&
              f.every((i) => Number.isInteger(i) && i >= 0 && i < (s.points as unknown[]).length),
          )
        )
          fail();
        if (s.nativeCuts !== undefined) {
          if (!Array.isArray(s.nativeCuts) || !s.nativeCuts.length) fail();
          for (const cut of s.nativeCuts as unknown[]) check(cut, depth + 1);
        }
        break;
      case 'transform':
        keys = ['kind', 'child', 'translation', 'rotation'];
        if (!triple(s.translation) || !triple(s.rotation)) fail();
        check(s.child, depth + 1);
        break;
      case 'union':
      case 'subtract':
      case 'intersect':
        keys = ['kind', 'children', 'nativeRefine'];
        if (s.kind === 'union') {
          keys.push('nativeBatch');
          if (s.nativeBatch !== undefined && typeof s.nativeBatch !== 'boolean') fail();
        }
        if (!Array.isArray(s.children) || s.children.length < (s.kind === 'union' ? 1 : 2)) fail();
        if (s.nativeRefine !== undefined && typeof s.nativeRefine !== 'boolean') fail();
        for (const child of s.children as unknown[]) check(child, depth + 1);
        break;
      default:
        throw new Error('Unsupported component feature: ' + String(s.kind));
    }
    if (Object.keys(s).some((k) => !keys.includes(k))) fail();
  }
  check(root);
  return root;
}

function anchor(s: Shape): Vec {
  switch (s.kind) {
    case 'shaft-bore':
      return [0, 0, s.z];
    case 'box':
    case 'cylinder':
    case 'sphere':
    case 'torus':
      return [...s.origin];
    case 'plate':
      return [s.outline[0][0], s.outline[0][1], s.z];
    case 'prism':
      return s.axis === 'z'
        ? [s.points[0][0], s.points[0][1], s.origin]
        : [s.points[0][0], s.origin, s.points[0][1]];
    case 'boundary':
      return [...s.points[0]];
    case 'loft':
    case 'helical-worm':
      return [...s.rings[0][0]];
    case 'smooth-loft':
      return [...s.sections[0].segments[0].points[0]];
    case 'curve-loft': {
      const [x, y] = s.segments[0].points[0],
        layer = s.layers[0];
      return [
        layer.scale * (x * Math.cos(layer.angle) - y * Math.sin(layer.angle)),
        layer.scale * (x * Math.sin(layer.angle) + y * Math.cos(layer.angle)),
        layer.z,
      ];
    }
    case 'revolve':
      return [0, 0, s.profile[0][1]];
    case 'union':
    case 'subtract':
    case 'intersect':
      return anchor(s.children[0]);
    case 'transform':
      return new Vector3(...anchor(s.child))
        .applyMatrix4(
          new Matrix4()
            .makeRotationFromEuler(
              new Euler(...(s.rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'),
            )
            .setPosition(...s.translation),
        )
        .toArray() as Vec;
  }
}
/** Move every world-coordinate feature into one reusable local definition. */
function offset(s: Shape, a: Vec): Shape {
  const shift = (p: Vec) => p.map((n, i) => n - a[i]) as Vec;
  switch (s.kind) {
    case 'box':
    case 'cylinder':
    case 'sphere':
    case 'torus':
      return { ...s, origin: shift(s.origin) };
    case 'plate':
      return {
        ...s,
        z: s.z - a[2],
        outline: s.outline.map(([x, y]) => [x - a[0], y - a[1]]),
        holes: s.holes.map((hole) => hole.map(([x, y]) => [x - a[0], y - a[1]])),
      };
    case 'prism':
      return {
        ...s,
        ...(s.native
          ? { native: { ...s.native, translation: shift(s.native.translation ?? [0, 0, 0]) } }
          : {}),
        origin: s.origin - a[s.axis === 'z' ? 2 : 1],
        points: s.points.map(([x, y]) => [x - a[0], y - a[s.axis === 'z' ? 1 : 2]]),
      };
    case 'boundary':
      return {
        ...s,
        points: s.points.map(shift),
        ...(s.nativeCuts ? { nativeCuts: s.nativeCuts.map((c) => offset(c, a)) } : {}),
      };
    case 'loft':
      return { ...s, rings: s.rings.map((r) => r.map(shift)) };
    case 'smooth-loft':
      return {
        ...s,
        sections: s.sections.map((section) => ({
          segments: section.segments.map((segment) => ({
            ...segment,
            points: segment.points.map(shift),
          })),
        })),
      };
    case 'revolve':
      return a[0] === 0 && a[1] === 0
        ? {
            ...s,
            profile: s.profile.map(([r, z]) => [r, z - a[2]]),
            ...(s.native
              ? { native: { ...s.native, translation: shift(s.native.translation ?? [0, 0, 0]) } }
              : {}),
          }
        : {
            kind: 'transform',
            child: s,
            translation: a.map((n) => -n) as Vec,
            rotation: [0, 0, 0],
          };
    case 'helical-worm':
    case 'curve-loft':
    case 'shaft-bore':
      return {
        kind: 'transform',
        child: s,
        translation: a.map((n) => -n) as Vec,
        rotation: [0, 0, 0],
      };
    case 'union':
    case 'subtract':
    case 'intersect':
      return { ...s, children: s.children.map((c) => offset(c, a)) };
    case 'transform':
      return { ...s, translation: shift(s.translation) };
  }
}
export function detailComponent(
  id: string,
  name: string,
  shape: Shape,
  options: {
    meshBackend?: 'jscad' | 'manifold';
    edgeTolerance?: number;
    minimumTriangleArea?: number;
    nativeRefine?: boolean;
    meshConform?: boolean;
    preserveAuthoredFrame?: boolean;
  } = {},
): AssemblyComponent {
  let source = shape;
  const frame = new Matrix4();
  // An enclosing rigid transform is occurrence placement. Feature transforms
  // inside boolean operations remain part of the local fabrication definition.
  while (source.kind === 'transform') {
    frame.multiply(
      new Matrix4()
        .makeRotationFromEuler(
          new Euler(...(source.rotation.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX'),
        )
        .setPosition(...source.translation),
    );
    source = source.child;
  }
  // Reanchoring can change which preview vertices or native Boolean planes
  // are exactly coincident; retain the authored frame when explicitly needed.
  const a: Vec =
      options.preserveAuthoredFrame || options.meshBackend === 'manifold'
        ? [0, 0, 0]
        : anchor(source),
    local = offset(source, a);
  const translation = new Vector3(...a).applyMatrix4(frame).toArray() as Vec;
  const rotation = new Euler()
    .setFromRotationMatrix(frame, 'ZYX')
    .toArray()
    .slice(0, 3)
    .map((value) => (typeof value === 'number' ? (value * 180) / Math.PI : 0)) as Vec;
  // Parse at the boundary: no private library references can masquerade as fabricated details.
  const recipe = JSON.stringify(local);
  parseDetailRecipe(recipe);
  return {
    id,
    name,
    libraryId: 'manufactured-detail',
    parameters: {
      recipe,
      meshBackend: options.meshBackend ?? 'jscad',
      meshEdgeTolerance: options.edgeTolerance ?? 0.01,
      meshMinimumTriangleArea: options.minimumTriangleArea ?? 5e-8,
      nativeRefine: options.nativeRefine ?? true,
      meshConform: options.meshConform ?? false,
    },
    state: 'default',
    quantity: 1,
    supply: 'manufactured',
    placement: { translation, rotation },
  };
}

/** Physical authored pieces, never meshes. Call with the complete canonical assembled definition. */
export function shapeComposition(
  pieces: readonly { shape: Shape; label: string }[],
): AssemblyDefinition {
  return {
    components: pieces.map((p, i) => detailComponent('component-' + (i + 1), p.label, p.shape)),
    issues: [
      'Assign materials, blanks, operations and drawing requirements to the configured custom details. Validate physical single-piece construction, fits and load-bearing geometry before manufacture.',
    ],
  };
}
