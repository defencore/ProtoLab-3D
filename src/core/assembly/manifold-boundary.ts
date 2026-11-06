import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import type { Manifold as Solid, ManifoldToplevel } from 'manifold-3d';
import { curveLoftRings, smoothLoftRings, type Shape, type Vec } from './boundary/shapes';
import { shaftBoreOutline } from '../hardware/shaft-bore';
import { material } from '../geometry';
import { currentGeometryMode } from '../geometry-mode';

let runtime: ManifoldToplevel | undefined;
let initialization: Promise<void> | undefined;
const geometryTemplates = new Map<string, BufferGeometry>();
const manufacturingSurfaceToleranceMm = 1e-5;

/** Initialize explicitly outside synchronous model builders and geometry-mode scopes. */
export function initializeManifoldGeometry(): Promise<void> {
  initialization ??= (async () => {
    const { default: createModule } = await import('manifold-3d');
    const isNode = Boolean(
      (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node,
    );
    let module: ManifoldToplevel;
    if (isNode) module = await createModule();
    else {
      const { default: wasmURL } = await import('manifold-3d/manifold.wasm?url');
      module = await createModule({ locateFile: () => wasmURL });
    }
    module.setup();
    runtime = module;
  })().catch((error: unknown) => {
    // A transient WASM download or compilation failure must permit an explicit retry.
    if (!runtime) initialization = undefined;
    throw error;
  });
  return initialization;
}

function initializedRuntime(): ManifoldToplevel {
  if (!runtime)
    throw new Error('Initialize Manifold geometry before calling a synchronous model builder.');
  return runtime;
}

/** Triangulate authored polygon faces without welding or changing their coordinates. */
function faceTriangles(points: Vec[], face: number[]): number[][] {
  if (face.length === 3) return [face];
  if (face.length < 3) throw new Error('A boundary face needs at least three vertices.');
  const normal = new Vector3();
  for (let i = 0; i < face.length; i++) {
    const a = points[face[i]],
      b = points[face[(i + 1) % face.length]];
    normal.x += (a[1] - b[1]) * (a[2] + b[2]);
    normal.y += (a[2] - b[2]) * (a[0] + b[0]);
    normal.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const components = normal.toArray(),
    drop = components.map(Math.abs).indexOf(Math.max(...components.map(Math.abs)));
  if (!components[drop]) throw new Error('A boundary face has zero area.');
  const project = (p: Vec) =>
    drop === 0
      ? new Vector2(p[1], p[2])
      : drop === 1
        ? new Vector2(p[2], p[0])
        : new Vector2(p[0], p[1]);
  return ShapeUtils.triangulateShape(
    face.map((id) => project(points[id])),
    [],
  ).map((indices) => {
    const triangle = indices.map((id) => face[id]),
      [a, b, c] = triangle.map((id) => project(points[id])),
      area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return area * components[drop] < 0 ? [triangle[0], triangle[2], triangle[1]] : triangle;
  });
}

/** Check the actual Float32 surface, using exact coordinate identity and oriented edges. */
function validateTriangles(positions: Float32Array, triangles: readonly number[]): void {
  const keys = Array.from({ length: positions.length / 3 }, (_, i) =>
      Array.from(positions.subarray(i * 3, i * 3 + 3)).join(','),
    ),
    edges = new Map<string, { uses: number; balance: number }>();
  if (!triangles.length || !positions.every(Number.isFinite))
    throw new Error('Manifold produced an empty or non-finite surface.');
  let volume = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const ids = triangles.slice(i, i + 3),
      [a, b, c] = ids.map((id) => new Vector3().fromArray(positions, id * 3));
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() === 0)
      throw new Error('An authored boundary triangle collapses in Float32.');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = keys[ids[j]],
        b = keys[ids[(j + 1) % 3]],
        key = a < b ? `${a}/${b}` : `${b}/${a}`,
        edge = edges.get(key) ?? { uses: 0, balance: 0 };
      edge.uses++;
      edge.balance += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  if ([...edges.values()].some(({ uses, balance }) => uses !== 2 || balance !== 0))
    throw new Error('Manifold Float32 surface is not closed and consistently oriented.');
  if (!(volume > 0)) throw new Error('Manifold surface must enclose positive volume.');
}

/** Extract the oriented boundary after Float32 conversion, without geometric repair. */
function float32BoundaryTriangles(positions: Float32Array, source: Uint32Array): number[] {
  const keys = Array.from({ length: positions.length / 3 }, (_, i) =>
      Array.from(positions.subarray(i * 3, i * 3 + 3)).join(','),
    ),
    faces = new Map<string, { triangle: number[]; orientation: number; balance: number }>();
  for (let i = 0; i < source.length; i += 3) {
    const triangle = Array.from(source.subarray(i, i + 3)),
      [a, b, c] = triangle.map((id) => new Vector3().fromArray(positions, id * 3));
    // Double-precision intersections can collapse to exact zero area in Float32.
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() === 0) continue;
    const ordered = triangle.map((id) => keys[id]),
      sorted = [...ordered].sort(),
      start = ordered.indexOf(sorted[0]),
      orientation = ordered[(start + 1) % 3] < ordered[(start + 2) % 3] ? 1 : -1,
      key = sorted.join('/'),
      face = faces.get(key) ?? { triangle, orientation, balance: 0 };
    face.balance += orientation;
    faces.set(key, face);
  }
  const result: number[] = [];
  for (const { triangle, orientation, balance } of faces.values()) {
    // Opposite copies of precisely the same Float32 triangle enclose zero volume.
    if (!balance) continue;
    if (Math.abs(balance) !== 1)
      throw new Error('Manifold Float32 boundary contains duplicate outward faces.');
    result.push(
      ...(Math.sign(balance) === orientation ? triangle : [triangle[0], triangle[2], triangle[1]]),
    );
  }
  return result;
}

function buildGeometry(shape: Shape): BufferGeometry {
  const module = initializedRuntime(),
    allocated = new Set<{ delete(): void }>(),
    own = <T extends { delete(): void }>(object: T): T => {
      allocated.add(object);
      return object;
    };
  const boundary = (points: Vec[], faces: number[][]): Solid => {
    const vertices: number[] = [],
      ids = new Map<string, number>(),
      remap = points.map((point) => {
        const coordinates = point.map(Math.fround),
          key = coordinates.join(',');
        if (!ids.has(key)) {
          ids.set(key, vertices.length / 3);
          vertices.push(...coordinates);
        }
        return ids.get(key)!;
      }),
      triangles = faces.flatMap((face) =>
        faceTriangles(points, face).flatMap((triangle) => triangle.map((id) => remap[id])),
      ),
      positions = new Float32Array(vertices);
    validateTriangles(positions, triangles);
    return own(
      new module.Manifold(
        new module.Mesh({
          numProp: 3,
          vertProperties: positions,
          triVerts: new Uint32Array(triangles),
        }),
      ),
    );
  };
  const evaluate = (value: Shape): Solid => {
    switch (value.kind) {
      case 'smooth-loft':
        return evaluate({ kind: 'loft', rings: smoothLoftRings(value) });
      case 'curve-loft': {
        const outside = evaluate({ kind: 'loft', rings: curveLoftRings(value) });
        if (!value.shaftBore) return outside;
        const source = shaftBoreOutline(value.shaftBore),
          bore =
            value.shaftBore.shape === 'round' &&
            value.previewBoreSegments &&
            value.previewBoreSegments < source.length
              ? Array.from(
                  { length: value.previewBoreSegments },
                  (_, i) =>
                    source[
                      Math.round((i * source.length) / value.previewBoreSegments!) % source.length
                    ],
                )
              : source;
        const first = value.layers[0].z,
          last = value.layers.at(-1)!.z;
        const cut = evaluate({
          kind: 'prism',
          points: bore.map(({ x, y }) => [x, y]),
          depth: last - first + 2,
          origin: first - 1,
          axis: 'z',
        });
        return own(module.Manifold.difference(outside, cut));
      }
      case 'boundary':
        return boundary(value.points, value.faces);
      case 'loft': {
        const points = value.rings.flat(),
          stride = value.rings[0].length,
          faces: number[][] = [];
        for (let layer = 0; layer + 1 < value.rings.length; layer++)
          for (let i = 0; i < stride; i++) {
            const a = layer * stride + i,
              b = layer * stride + ((i + 1) % stride);
            faces.push([a, b, b + stride], [a, b + stride, a + stride]);
          }
        faces.push(Array.from({ length: stride }, (_, i) => stride - 1 - i));
        faces.push(Array.from({ length: stride }, (_, i) => points.length - stride + i));
        let volume = 0;
        for (const face of faces)
          for (let i = 1; i + 1 < face.length; i++) {
            const [a, b, c] = [face[0], face[i], face[i + 1]].map(
              (id) => new Vector3(...points[id]),
            );
            volume += a.dot(b.cross(c));
          }
        return boundary(points, volume < 0 ? faces.map((face) => [...face].reverse()) : faces);
      }
      case 'box':
        return own(own(module.Manifold.cube(value.size)).translate(value.origin));
      case 'cylinder': {
        let solid = own(
          module.Manifold.cylinder(
            value.height,
            value.radius + (value.thread?.radialClearance ?? 0),
            undefined,
            value.segments ?? 48,
          ),
        );
        if (value.axis === 'x') solid = own(solid.rotate([0, 90, 0]));
        if (value.axis === 'y') solid = own(solid.rotate([-90, 0, 0]));
        return own(solid.translate(value.origin));
      }
      case 'prism': {
        const section = own(new module.CrossSection([value.points])),
          solid = own(section.extrude(value.depth));
        return value.axis === 'y'
          ? own(own(solid.rotate([90, 0, 0])).translate([0, value.origin + value.depth, 0]))
          : own(solid.translate([0, 0, value.origin]));
      }
      case 'revolve': {
        const sweep = value.sweep ?? 360,
          // Manifold needs at least three strips, including for a very short arc.
          segments = Math.max(3, Math.ceil(((value.segments ?? 48) * sweep) / 360)),
          section = own(new module.CrossSection([value.profile], 'EvenOdd'));
        return own(section.revolve(segments, sweep));
      }
      case 'transform':
        return own(own(evaluate(value.child).rotate(value.rotation)).translate(value.translation));
      case 'union':
        return own(module.Manifold.union(value.children.map(evaluate)));
      case 'subtract': {
        const children = value.children.map(evaluate);
        if (!children.length) throw new Error('A subtraction needs a base shape.');
        return children
          .slice(1)
          .reduce((base, cut) => own(module.Manifold.difference(base, cut)), children[0]);
      }
      case 'intersect':
        return own(module.Manifold.intersection(value.children.map(evaluate)));
      default:
        throw new Error(`Manifold boundary geometry does not support ${value.kind}.`);
    }
  };
  try {
    const authored = evaluate(shape),
      // A manufactured component is one material. Reset Boolean-operand IDs so
      // coplanar primitive seams do not constrain its final tessellation.
      wholeComponent = own(authored.asOriginal()),
      // Bound surface changes below 10 nm without changing kernel tolerances.
      // This removes infinitesimal Boolean facets before binary STL transforms.
      solid = own(wholeComponent.simplify(manufacturingSurfaceToleranceMm));
    if (solid.status() !== 'NoError')
      throw new Error(`Manifold geometry failed: ${solid.status()}.`);
    const mesh = solid.getMesh();
    if (mesh.numProp !== 3)
      throw new Error('Boundary geometry must contain position properties only.');
    const positions = new Float32Array(mesh.vertProperties),
      triangles = float32BoundaryTriangles(positions, mesh.triVerts);
    validateTriangles(positions, triangles);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        triangles.flatMap((id) => Array.from(positions.subarray(id * 3, id * 3 + 3))),
        3,
      ),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  } finally {
    for (const solid of [...allocated].reverse()) solid.delete();
  }
}

/** Build the authored component with bounded tessellation; unsupported shapes fail visibly. */
export function manifoldBoundaryComponent(shape: Shape, label: string, color: number): Group {
  initializedRuntime();
  const key = `${currentGeometryMode()}:${JSON.stringify(shape)}`;
  let template = geometryTemplates.get(key);
  if (template) geometryTemplates.delete(key);
  else template = buildGeometry(shape);
  geometryTemplates.set(key, template);
  if (geometryTemplates.size > 16) {
    const oldest = geometryTemplates.keys().next().value!;
    geometryTemplates.get(oldest)!.dispose();
    geometryTemplates.delete(oldest);
  }
  // Callers own only their clone; pose, materials and disposal remain independent.
  const mesh = new Mesh(template.clone(), material(color));
  mesh.name = label;
  const group = new Group().add(mesh);
  group.name = label;
  return group;
}
