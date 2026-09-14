import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { material, num } from '../../../core/geometry';
import { annularSector } from '../../../core/mechanical';
import { solidUnionMesh } from '../../../core/solid-union';

export type Vec = [number, number, number];
export type Bounds = [Vec, Vec];
export type Solid =
  | { kind: 'cylinder'; radius: number; length: number; center: Vec; axis: 'x' | 'z' }
  | {
      kind: 'sector';
      outer: number;
      inner: number;
      gap: number;
      height: number;
      center: Vec;
      axis: 'x' | 'z';
    }
  | { kind: 'torus'; major: number; minor: number; center: Vec }
  | { kind: 'union'; items: Solid[] }
  | { kind: 'cut'; items: Solid[] }
  | { kind: 'intersection'; items: Solid[] };
export const cylinder = (
  radius: number,
  length: number,
  center: Vec = [0, 0, 0],
  axis: 'x' | 'z' = 'z',
): Solid => ({ kind: 'cylinder', radius, length, center, axis });
export const cut = (...items: Solid[]): Solid => ({ kind: 'cut', items });
export const union = (...items: Solid[]): Solid => ({ kind: 'union', items });
export const intersection = (...items: Solid[]): Solid => ({ kind: 'intersection', items });
export function sectorPoints(s: Extract<Solid, { kind: 'sector' }>) {
  return annularSector(s.outer, s.inner, s.gap, 96).map((v) => [v.x, v.y] as [number, number]);
}
export function buildSolid(s: Solid): Geom3 {
  const { primitives, transforms, booleans, extrusions } = modeling;
  if (s.kind === 'union') return booleans.union(...s.items.map(buildSolid));
  if (s.kind === 'cut') return booleans.subtract(...s.items.map(buildSolid));
  if (s.kind === 'intersection') return booleans.intersect(...s.items.map(buildSolid));
  if (s.kind === 'torus')
    return transforms.translate(
      s.center,
      primitives.torus({
        innerRadius: s.minor,
        outerRadius: s.major,
        innerSegments: 16,
        outerSegments: 64,
      }),
    );
  let solid: Geom3;
  if (s.kind === 'cylinder')
    solid = primitives.cylinder({ radius: s.radius, height: s.length, segments: 64 });
  else
    solid = transforms.translate(
      [0, 0, -s.height / 2],
      extrusions.extrudeLinear(
        { height: s.height },
        primitives.polygon({ points: sectorPoints(s) }),
      ),
    );
  if (s.axis === 'x') solid = transforms.rotateY(Math.PI / 2, solid);
  return transforms.translate(s.center, solid);
}
export function solidBounds(s: Solid): Bounds {
  if (s.kind === 'cut') return solidBounds(s.items[0]);
  if (s.kind === 'union' || s.kind === 'intersection') {
    const list = s.items.map(solidBounds),
      join = s.kind === 'union';
    return [
      [0, 1, 2].map((i) => (join ? Math.min : Math.max)(...list.map((b) => b[0][i]))) as Vec,
      [0, 1, 2].map((i) => (join ? Math.max : Math.min)(...list.map((b) => b[1][i]))) as Vec,
    ];
  }
  let offsets: Bounds;
  if (s.kind === 'torus')
    offsets = [
      [-s.major - s.minor, -s.major - s.minor, -s.minor],
      [s.major + s.minor, s.major + s.minor, s.minor],
    ];
  else if (s.kind === 'cylinder') {
    const ext: Vec =
      s.axis === 'x' ? [s.length / 2, s.radius, s.radius] : [s.radius, s.radius, s.length / 2];
    offsets = [ext.map((v) => -v) as Vec, ext];
  } else {
    const points = sectorPoints(s),
      u = points.map((p) => p[0]),
      v = points.map((p) => p[1]);
    offsets =
      s.axis === 'x'
        ? [
            [-s.height / 2, Math.min(...v), -Math.max(...u)],
            [s.height / 2, Math.max(...v), -Math.min(...u)],
          ]
        : [
            [Math.min(...u), Math.min(...v), -s.height / 2],
            [Math.max(...u), Math.max(...v), s.height / 2],
          ];
  }
  return offsets.map((bound) => bound.map((v, i) => v + s.center[i]) as Vec) as Bounds;
}
const vector = (v: Vec) => `App.Vector(${v.map(num).join(',')})`;
export function solidPython(s: Solid): string {
  if (s.kind === 'union') return s.items.map(solidPython).reduce((a, b) => `${a}.fuse(${b})`);
  if (s.kind === 'cut') return s.items.map(solidPython).reduce((a, b) => `${a}.cut(${b})`);
  if (s.kind === 'intersection')
    return s.items.map(solidPython).reduce((a, b) => `${a}.common(${b})`);
  if (s.kind === 'torus')
    return `Part.makeTorus(${num(s.major)},${num(s.minor)},${vector(s.center)},App.Vector(0,0,1))`;
  const axis: Vec = s.axis === 'x' ? [1, 0, 0] : [0, 0, 1];
  if (s.kind === 'cylinder') {
    const start = s.center.map((v, i) => v - (axis[i] * s.length) / 2) as Vec;
    return `Part.makeCylinder(${num(s.radius)},${num(s.length)},${vector(start)},${vector(axis)})`;
  }
  const points = sectorPoints(s).map(([u, v]) =>
    s.axis === 'x'
      ? ([s.center[0] - s.height / 2, s.center[1] + v, s.center[2] - u] as Vec)
      : ([s.center[0] + u, s.center[1] + v, s.center[2] - s.height / 2] as Vec),
  );
  return `Part.Face(Part.makePolygon([${[...points, points[0]].map(vector).join(',')}])).extrude(${vector(axis.map((v) => v * s.height) as Vec)})`;
}
export interface Component {
  name: string;
  color: number;
  solid: Solid;
  offset: Vec;
}
export function componentBounds(c: Component): Bounds {
  return solidBounds(c.solid).map((bound) => bound.map((v, i) => v + c.offset[i]) as Vec) as Bounds;
}
export function assemblyBounds(components: Component[]): Bounds {
  const all = components.map(componentBounds);
  return [
    [0, 1, 2].map((i) => Math.min(...all.map((b) => b[0][i]))) as Vec,
    [0, 1, 2].map((i) => Math.max(...all.map((b) => b[1][i]))) as Vec,
  ];
}
const geometryCache = new Map<string, { geometry: BufferGeometry; center: Vec }>();
function componentGeometry(solid: Solid) {
  const key = JSON.stringify(solid),
    cached = geometryCache.get(key);
  if (cached) return cached;
  const value = buildSolid(solid),
    bounds = modeling.measurements.measureBoundingBox(value),
    group = solidUnionMesh(value),
    mesh = group.children[0] as Mesh;
  const entry = {
    geometry: mesh.geometry,
    center: bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as Vec,
  };
  (mesh.material as MeshStandardMaterial).dispose();
  geometryCache.set(key, entry);
  if (geometryCache.size > 32) {
    const oldest = geometryCache.keys().next().value!;
    geometryCache.get(oldest)!.geometry.dispose();
    geometryCache.delete(oldest);
  }
  return entry;
}
export function assemblyGeometry(components: Component[]) {
  const bounds = assemblyBounds(components),
    center = bounds[0].map((v, i) => (v + bounds[1][i]) / 2),
    group = new Group();
  for (const c of components) {
    const cached = componentGeometry(c.solid),
      appearance = material(c.color),
      part = new Group().add(new Mesh(cached.geometry.clone(), appearance));
    part.position.set(...(cached.center.map((v, i) => v + c.offset[i] - center[i]) as Vec));
    part.name = c.name;
    if (c.name.startsWith('Seal')) {
      appearance.metalness = 0;
      appearance.roughness = 0.8;
    }
    group.add(part);
  }
  return group;
}
export function assemblyPython(components: Component[]) {
  const bounds = assemblyBounds(components),
    center = bounds[0].map((v, i) => (v + bounds[1][i]) / 2);
  const lines = [
    '# Prototype geometry; ring and seal profiles do not specify a production fit.',
    'components = []',
  ];
  for (const c of components)
    lines.push(
      `item = ${solidPython(c.solid)}.removeSplitter()`,
      `if item.isNull() or not item.isValid() or len(item.Solids) != 1: raise ValueError(${JSON.stringify(`${c.name} must be one valid movable solid.`)})`,
      `item.translate(${vector(c.offset.map((v, i) => v - center[i]) as Vec)})`,
      'components.append(item)',
    );
  lines.push(
    `component_labels = ${JSON.stringify(components.map((c) => c.name))}`,
    `component_colors = [${components.map((c) => `(${[(c.color >> 16) / 255, ((c.color >> 8) & 255) / 255, (c.color & 255) / 255].map(num).join(',')})`).join(',')}]`,
    'shape = Part.makeCompound(components) if len(components) > 1 else components[0]',
  );
  return lines.join('\n');
}
