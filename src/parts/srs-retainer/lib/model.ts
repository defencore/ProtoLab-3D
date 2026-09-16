import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Parameters } from '../../../core/types';
import native from './native.json';
import { box, cylinder, subtract, union } from './shapes';
import * as assembly from './assembly';

// The Aptiv brochure dimensions the envelope, not the key/latch clearances.
// This is one representative AK-1 sample, not invented B/C coding variants.
function aptivPieces() {
  const body = subtract(
    union(
      cylinder(5.5, 7.9, [0, 0, 0]),
      box([1.2, 1.2, 0.8], [-5.6, -0.6, 5]),
      box([1.2, 1.2, 0.8], [4.4, -0.6, 5]),
    ),
    cylinder(4.5, 8, [0, 0, 0.8]),
    box([6.4, 14, 7], [-3.2, -7, 1.4]),
    box([0.8, 3, 2.1], [-5.6, -1.5, 5.8]),
    box([0.8, 3, 2.1], [4.8, -1.5, 5.8]),
    cylinder(3.4, 1.2, [0, 0, -0.1]),
  );
  return [{ shape: body, label: 'AK-1 retainer · reconstructed sample', color: 0x3285bc }];
}
function record(p: Parameters) {
  const value = native[p.model as keyof typeof native];
  if (!value) throw new Error('Unsupported retainer model');
  return value;
}
const colors: Record<string, number> = {
  'te-akii-1': 0x454a51,
  'te-akii-2': 0x83b7a1,
  'te-akii-3': 0xe8c740,
};
export function geometry(p: Parameters) {
  if (p.model === 'aptiv-ak1') return assembly.geometry(aptivPieces());
  const r = record(p);
  const decode = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0)).buffer;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(decode(r.positions)), 3));
  g.setIndex(new BufferAttribute(new Uint32Array(decode(r.indices)), 1));
  g.computeVertexNormals();
  g.userData.nativeTopology = true;
  const mesh = new Mesh(
    g,
    new MeshStandardMaterial({ color: colors[String(p.model)], roughness: 0.6 }),
  );
  mesh.name = 'TE AK II retainer · source solid';
  return new Group().add(mesh);
}
export function python(p: Parameters) {
  if (p.model === 'aptiv-ak1') return assembly.python(aptivPieces());
  const r = record(p),
    color = colors[String(p.model)];
  return [
    'import base64, zlib',
    `# Original customer-view STEP SHA-256: ${r.sourceSha256}`,
    'component = Part.Shape()',
    `component.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(r.brep)})).decode('utf-8'))`,
    'components = [component]',
    'shape = Part.makeCompound(components)',
    'component_labels = ["TE AK II retainer · source solid"]',
    `component_colors = [(${((color >> 16) & 255) / 255},${((color >> 8) & 255) / 255},${(color & 255) / 255})]`,
  ].join('\n');
}
export function dimensions(p: Parameters): [number, number, number] {
  if (p.model === 'aptiv-ak1') return [11.2, 11, 7.9];
  const b = record(p).bounds;
  return [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
}
