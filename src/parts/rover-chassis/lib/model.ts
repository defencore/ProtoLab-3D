import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import type { Parameters } from '../../../core/types';
import catalog from './catalog.json';
import romi from './native/romi.json';
import pirate from './native/pirate-4wd.json';
import ugv from './native/ugv-rover.json';
export interface NativeComponent {
  id: string;
  label: string;
  group: 'structure' | 'drive' | 'electronics' | 'hardware' | 'power';
  solids?: number;
  color: number;
  bounds: number[];
  volume: number;
  brep: string;
  brepSha256: string;
  vertices: string;
  triangles: string;
  previewNotes?: string[];
}
export interface NativeChassis {
  id: string;
  name: string;
  sourceUrl: string;
  sourceSha256: string;
  sourceFile: string;
  linearDeflection: number;
  brepCompression: 'xz';
  sourceSolids?: number;
  retainedSourceSolids?: number;
  omissions?: { label?: string; reason?: string; volume?: number; sourceObject?: string }[];
  sourceNotes?: string[];
  normalization?: {
    rotationAxis: number[];
    rotationDegrees: number;
    translation: number[];
  };
  mountingSurfaces?: {
    componentId: string;
    label: string;
    faceIndex: number;
    z: number;
    area: number;
    bounds: number[];
    circles: { x: number; y: number; radius: number }[];
  }[];
  components: NativeComponent[];
  bounds: number[];
  dimensions: number[];
}
const nativeModels = [romi, pirate, ugv] as NativeChassis[];
export const models = catalog.map((m) => ({ ...nativeModels.find((n) => n.id === m.id)!, ...m }));
export function selected(p: Parameters) {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Choose an identified manufacturer chassis.');
  return model;
}
export function selectedComponents(p: Parameters, state: string): NativeComponent[] {
  const model = selected(p);
  if (!['assembled', 'frame', 'drive', 'exploded'].includes(state))
    throw new Error('Choose a chassis inspection view.');
  const mountingSupports = new Set(model.mountingSupportIds ?? []);
  const frameExcluded = new Set(model.frameExcludedIds ?? []);
  return model.components.filter((c) =>
    state === 'frame'
      ? !frameExcluded.has(c.id) && (c.group === 'structure' || mountingSupports.has(c.id))
      : state === 'drive'
        ? c.group === 'drive'
        : true,
  );
}
export function offset(
  p: Parameters,
  state: string,
  item: NativeComponent,
): [number, number, number] {
  if (state !== 'exploded') return [0, 0, 0];
  const gap = Number(p.explodedGap);
  if (item.group === 'drive') return [0, (item.bounds[1] + item.bounds[4] < 0 ? -1 : 1) * gap, 0];
  const levels = { structure: 0, power: 1, electronics: 2, hardware: 3 };
  return [0, 0, levels[item.group] * gap];
}
function unpack(value: string): Uint8Array {
  return unzlibSync(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
}
const cache = new Map<string, BufferGeometry>();
export function geometry(p: Parameters, state: string): Group {
  const model = selected(p),
    result = new Group();
  for (const item of selectedComponents(p, state)) {
    const key = model.id + '/' + item.id;
    let shape = cache.get(key);
    if (!shape) {
      const vertices = unpack(item.vertices),
        triangles = unpack(item.triangles),
        indexed = new BufferGeometry();
      indexed.setAttribute(
        'position',
        new Float32BufferAttribute(
          new Float32Array(vertices.buffer, vertices.byteOffset, vertices.byteLength / 4),
          3,
        ),
      );
      indexed.setIndex(
        new Uint32BufferAttribute(
          new Uint32Array(triangles.buffer, triangles.byteOffset, triangles.byteLength / 4),
          1,
        ),
      );
      indexed.computeVertexNormals();
      // Native topology is preserved for mesh audits; creased presentation uses its own copy.
      shape = indexed;
      shape.userData.nativeTopology = true;
      cache.set(key, shape);
    }
    const object = new Mesh(
      shape.clone(),
      new MeshStandardMaterial({
        color: item.color,
        metalness: item.group === 'hardware' ? 0.6 : 0.1,
        roughness: 0.65,
        flatShading: true,
      }),
    );
    object.name = item.label;
    object.position.set(...offset(p, state, item));
    object.userData.sourceComponent = item.id;
    result.add(object);
  }
  return result;
}
export function dimensions(p: Parameters, state: string): [number, number, number] {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const item of selectedComponents(p, state)) {
    const shift = offset(p, state, item);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], item.bounds[a] + shift[a]);
      max[a] = Math.max(max[a], item.bounds[a + 3] + shift[a]);
    }
  }
  return min.map((v, a) => max[a] - v) as [number, number, number];
}
export function python(p: Parameters, state: string): string {
  const model = selected(p),
    components = selectedComponents(p, state);
  const lines = ['import base64,lzma', 'components=[]'];
  for (const item of components) {
    lines.push(
      's=Part.Shape()',
      `s.importBrepFromString(lzma.decompress(base64.b64decode(${JSON.stringify(item.brep)})).decode('utf-8'))`,
      `s.translate(App.Vector(*${JSON.stringify(offset(p, state, item))}))`,
      'components.append(s)',
    );
  }
  lines.push(
    'shape=Part.makeCompound(components)',
    `component_labels=${JSON.stringify(components.map((c) => c.label))}`,
    `component_colors=${JSON.stringify(components.map((c) => [((c.color >> 16) & 255) / 255, ((c.color >> 8) & 255) / 255, (c.color & 255) / 255]))}`,
    `component_metadata=${JSON.stringify(
      components.map((c) => ({
        SupplierInternal: model.manufacturer,
        SourceComponent: c.id,
        SourceBRepSHA256: c.brepSha256,
        CADSource: model.sourceUrl,
        CADSourceSHA256: model.sourceSha256,
        ComponentRole: c.group,
      })),
    )}`,
  );
  return lines.join('\n');
}
