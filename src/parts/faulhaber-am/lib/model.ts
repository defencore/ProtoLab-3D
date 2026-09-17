import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Parameters } from '../../../core/types';
import models from './models.json';
import { nativeModels } from './native';

export function modelData(p: Parameters) {
  const model = models.find((m) => m.model === p.model);
  if (!model) throw new Error('Choose a listed FAULHABER motor.');
  return nativeModels[model.series as keyof typeof nativeModels];
}
function bytes(encoded: string): ArrayBuffer {
  const binary = atob(encoded),
    result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result.buffer;
}
const templates = new Map<string, BufferGeometry>();
export function geometry(p: Parameters): Group {
  const data = modelData(p);
  let template = templates.get(data.sourceSha256);
  if (!template) {
    template = new BufferGeometry();
    template.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(bytes(data.positions)), 3),
    );
    template.setIndex(new BufferAttribute(new Uint32Array(bytes(data.indices)), 1));
    for (const [start, count, material] of data.groups) template.addGroup(start, count, material);
    template.computeVertexNormals();
    template.userData.nativeTopology = true;
    templates.set(data.sourceSha256, template);
  }
  const mesh = new Mesh(template.clone(), [
    new MeshStandardMaterial({ color: '#b7bec7', metalness: 0.65, roughness: 0.32 }),
    new MeshStandardMaterial({ color: '#30343a', metalness: 0.25, roughness: 0.42 }),
  ]);
  mesh.name = String(p.model);
  return new Group().add(mesh);
}
export function dimensions(p: Parameters): [number, number, number] {
  const model = geometry(p),
    size = new Box3().setFromObject(model, true).getSize(new Vector3());
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((m) => m.dispose());
    }
  });
  return [size.x, size.y, size.z];
}
export function python(p: Parameters): string {
  const data = modelData(p);
  return [
    'import base64, zlib',
    `# FAULHABER original STEP SHA-256: ${data.sourceSha256}`,
    '# Single supplier installation solid; no fabricated internal mechanism.',
    'shape = Part.Shape()',
    `shape.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(data.brep)})).decode('utf-8'))`,
    `component_labels = [${JSON.stringify(p.model)}]`,
    'component_colors = [[0.72,0.75,0.78]]',
  ].join('\n');
}
