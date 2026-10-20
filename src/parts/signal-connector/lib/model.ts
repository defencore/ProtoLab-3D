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
import native from './native';
import sourceColorData from './color-evidence.json';
export interface SourceColor {
  kind: 'source-step' | 'illustrative';
  rgb?: number[];
  reason?: string;
  stepSolidEntity?: number;
  faceCount?: number;
}
export const colorEvidence = sourceColorData as unknown as {
  method: string;
  models: Record<
    string,
    { sourceSha256: string; geometryFingerprint: string; components: SourceColor[] }
  >;
};
export interface NativeComponent {
  id: string;
  label: string;
  sourceSolid: number;
  sourceSolids: number;
  color: number;
  bounds: number[];
  volume: number;
  brep: string;
  brepSha256: string;
  vertices: string;
  triangles: string;
  vertexCount: number;
  triangleCount: number;
}
export interface NativeAsset {
  id: string;
  sourceFile: string;
  sourceUrl: string;
  sourceSha256: string;
  origin: string;
  brepCompression: 'zlib';
  linearDeflection: number;
  sourceSolids: number;
  bounds: number[];
  dimensions: number[];
  components: NativeComponent[];
}
export const models = catalog.map((m) => ({
  ...m,
  native: (native as NativeAsset[]).find((n) => n.id === m.id)!,
  colors: colorEvidence.models[m.id].components,
}));
export function selected(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Choose a supported connector model.');
  return m;
}
function unpack(value: string): Uint8Array {
  return unzlibSync(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
}
const cache = new WeakMap<NativeComponent, BufferGeometry>();
export function geometry(p: Parameters, state: string): Group {
  if (state !== 'assembled') throw new Error('Choose the assembly view.');
  const result = new Group();
  for (const item of selected(p).native.components) {
    let template = cache.get(item);
    if (!template) {
      template = new BufferGeometry();
      const vertices = unpack(item.vertices),
        triangles = unpack(item.triangles);
      template.setAttribute(
        'position',
        new Float32BufferAttribute(
          new Float32Array(vertices.buffer, vertices.byteOffset, vertices.byteLength / 4),
          3,
        ),
      );
      template.setIndex(
        new Uint32BufferAttribute(
          new Uint32Array(triangles.buffer, triangles.byteOffset, triangles.byteLength / 4),
          1,
        ),
      );
      template.computeVertexNormals();
      template.userData.nativeTopology = true;
      cache.set(item, template);
    }
    const mesh = new Mesh(
      template.clone(),
      new MeshStandardMaterial({
        color: item.color,
        roughness: 0.5,
        metalness: 0.25,
        flatShading: true,
      }),
    );
    mesh.name = item.label;
    mesh.userData.sourceSolids = item.sourceSolids;
    mesh.userData.sourceVolume = item.volume;
    mesh.userData.sourceComponent = item.id;
    result.add(mesh);
  }
  return result;
}
export function dimensions(p: Parameters): [number, number, number] {
  return [...selected(p).native.dimensions] as [number, number, number];
}
export function python(p: Parameters, state: string): string {
  if (state !== 'assembled') throw new Error('Choose the assembly view.');
  const m = selected(p),
    components = m.native.components;
  return [
    'import base64,zlib',
    'components=[]',
    ...components.flatMap((c) => [
      'item=Part.Shape()',
      `item.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(c.brep)})).decode('utf-8'))`,
      'components.append(item)',
    ]),
    'shape=Part.makeCompound(components)',
    `component_labels=${JSON.stringify(components.map((c) => c.label))}`,
    `component_colors=${JSON.stringify(components.map((c) => [((c.color >> 16) & 255) / 255, ((c.color >> 8) & 255) / 255, (c.color & 255) / 255]))}`,
    `component_metadata=${JSON.stringify(components.map((c) => ({ SourceComponent: c.id, SourceBRepSHA256: c.brepSha256, CADSource: m.sourceUrl, CADSourceSHA256: m.sourceSha256, SourceKind: 'KiCad community reference' })))}`,
  ].join('\n');
}
