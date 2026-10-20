import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import { models, type SourceComponent } from './frames';
export {
  source,
  models,
  beam,
  frames,
  sourceFrame,
  sheetFabrication,
  assemblyPlacement,
} from './frames';
export type { SourceComponent } from './frames';
export function selected(id: unknown): SourceComponent {
  const item = models.find((p) => p.id === id);
  if (!item) throw new Error('Choose an upstream component.');
  return item;
}
const geometryCache = new Map<string, BufferGeometry>();
function bytes(value: string, compressed: boolean) {
  const data = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return compressed ? new Uint8Array(unzlibSync(data)) : data;
}
export function geometry(item: SourceComponent): Group {
  let mesh = geometryCache.get(item.id);
  if (!mesh) {
    const verts = bytes(item.vertices, item.meshCompression === 'zlib'),
      faces = bytes(item.triangles, item.meshCompression === 'zlib');
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(verts.buffer), 3));
    g.setIndex(new Uint32BufferAttribute(new Uint32Array(faces.buffer), 1));
    mesh = mergeVertices(g, 1e-5);
    g.dispose();
    const welded = mesh;
    mesh = toCreasedNormals(welded, Math.PI / 6);
    welded.dispose();
    geometryCache.set(item.id, mesh);
  }
  const color =
    item.route === 'sheet'
      ? 0x353c43
      : item.route === 'print'
        ? 0x448b87
        : item.route === 'soft'
          ? 0x25282b
          : 0x8c949b;
  const object = new Mesh(
    mesh.clone(),
    new MeshStandardMaterial({
      color,
      metalness: item.route === 'purchase' ? 0.6 : 0.05,
      roughness: 0.65,
    }),
  );
  object.name = item.label;
  return new Group().add(object);
}
export function python(item: SourceComponent): string {
  return (
    'import base64,zlib\nshape=Part.Shape()\nshape.importBrepFromString(zlib.decompress(base64.b64decode(' +
    JSON.stringify(item.brep) +
    ')).decode("utf-8"))'
  );
}
