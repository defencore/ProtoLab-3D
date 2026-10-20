import { BufferGeometry, BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import native from './hat-native.json';
export { native as hatData };
const templates: BufferGeometry[] = [];
const decode = (s: string) =>
  new Uint8Array(unzlibSync(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))).buffer;
export function hatGeometry(): Group {
  const group = new Group();
  group.name = 'BUY Waveshare Bus Servo Driver HAT (A) · SKU 27577 · ESP32 · 9–25 V';
  native.components.forEach((part, i) => {
    if (!templates[i]) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(decode(part.positions)), 3),
      );
      geometry.setIndex(new BufferAttribute(new Uint32Array(decode(part.indices)), 1));
      geometry.computeVertexNormals();
      geometry.userData.nativeTopology = true;
      templates[i] = geometry;
    }
    const mesh = new Mesh(
      templates[i].clone(),
      new MeshStandardMaterial({
        color: part.color,
        metalness: i === 0 ? 0 : 0.35,
        roughness: 0.5,
      }),
    );
    mesh.name = `${group.name} · ${i === 0 ? 'PCB' : `supplier CAD solid ${part.sourceSolid}`}`;
    group.add(mesh);
  });
  return group;
}
export const hatPython = [
  'import base64,zlib',
  `# Waveshare HAT(A) STEP SHA256: ${native.sourceSha256}`,
  ...native.repairs.map((note) => '# ' + note),
  'def _hat_native():',
  '    result=Part.Shape()',
  `    result.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(native.brep)})).decode())`,
  '    # Preserve geometry; raise only sub-nanometre topology tolerances for stable rotated FCStd.',
  '    result.limitTolerance(0.00001)',
  '    return result',
];
