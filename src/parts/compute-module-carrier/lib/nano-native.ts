import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import nanoA from './nano-a/native.json';
import nanoB from './nano-b/native.json';

const nativeModels = {
  'waveshare-cm5-nano-a': nanoA,
  'waveshare-cm5-nano-b': nanoB,
};
type NativeModelId = keyof typeof nativeModels;
export function hasNativeModel(modelId: string): modelId is NativeModelId {
  return Object.hasOwn(nativeModels, modelId);
}
function selected(modelId: string) {
  if (!hasNativeModel(modelId)) throw new Error('Select a supported native CM5 Nano board.');
  return nativeModels[modelId];
}

function bytes(encoded: string) {
  return Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)).buffer;
}
const cached = new Map<string, BufferGeometry>();
function meshGeometry(modelId: string, index: number) {
  const native = selected(modelId);
  const key = modelId + ':' + index;
  let result = cached.get(key);
  if (!result) {
    const c = native.templates[index];
    result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(bytes(c.positions)), 3));
    result.setIndex(new BufferAttribute(new Uint32Array(bytes(c.indices)), 1));
    result.computeVertexNormals();
    result.userData.nativeTopology = true;
    cached.set(key, result);
  }
  // Repeated source components share vertex buffers; instance transforms stay independent.
  return result;
}
export function geometry(modelId: string, state: string) {
  const native = selected(modelId);
  const group = new Group();
  const materials = new Map<string, MeshStandardMaterial>();
  native.components.forEach((c) => {
    if (!materials.has(c.color))
      materials.set(
        c.color,
        new MeshStandardMaterial({ color: c.color, roughness: 0.55, metalness: 0.15 }),
      );
    const mesh = new Mesh(meshGeometry(modelId, c.template), materials.get(c.color)!);
    mesh.name = c.label;
    mesh.applyMatrix4(new Matrix4().fromArray(c.matrix).transpose());
    mesh.position.z += state === 'exploded' ? c.layer * 10 : 0;
    group.add(mesh);
  });
  return group;
}
export function dimensions(modelId: string, state: string): [number, number, number] {
  const native = selected(modelId);
  const bounds = new Box3();
  for (const c of native.components) {
    const dz = state === 'exploded' ? c.layer * 10 : 0;
    bounds.expandByPoint(new Vector3(c.bounds[0], c.bounds[1], c.bounds[2] + dz));
    bounds.expandByPoint(new Vector3(c.bounds[3], c.bounds[4], c.bounds[5] + dz));
  }
  return bounds.getSize(new Vector3()).toArray();
}
export function python(modelId: string, state: string) {
  const native = selected(modelId);
  return [
    'import base64, zlib',
    `# Manufacturer STEP SHA-256: ${native.sourceSha256}`,
    ...native.templates.flatMap((t, i) => [
      `template_${i} = Part.Shape()`,
      `template_${i}.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(t.brep)})).decode('utf-8'))`,
    ]),
    'components = []',
    ...native.components.flatMap((c) => [
      `component = template_${c.template}.copy()`,
      `component.Placement = App.Placement(App.Matrix(*${JSON.stringify(c.matrix)})).multiply(component.Placement)`,
      `component.translate(App.Vector(0,0,${state === 'exploded' ? c.layer * 10 : 0}))`,
      'components.append(component)',
    ]),
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(native.components.map((c) => c.label))}`,
    `component_colors = ${JSON.stringify(native.components.map((c) => [1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16) / 255)))}`,
  ].join('\n');
}
