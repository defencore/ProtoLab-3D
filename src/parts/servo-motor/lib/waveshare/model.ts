import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Parameters } from '../../../../core/types';
import { n, num } from '../../../../core/geometry';
import native from './native.json';
import {
  box,
  cylinder,
  union,
  subtract,
  component,
  pythonShape,
  type Shape,
  type Vec,
} from './shapes';

type Entry = {
  source?: number;
  shape?: Shape;
  label: string;
  color: string;
  rotation: number;
  shift: Vec;
};
const exploded: Vec[] = [
  [0, 0, 0],
  [0, 0, 25],
  [0, 0, -25],
  [55, 0, 0],
  [0, -40, 0],
  [0, 0, 45],
  [0, 0, 60],
  [0, 0, -45],
];

// Only the optional illustrative single arm is constructed. The servo itself
// and both supplied discs come directly from the manufacturer's native solids.
function prototypeArm(p: Parameters): Shape {
  const r = n(p, 'hornDiameter') / 2,
    t = n(p, 'hornThickness');
  // Leave clearance over the original cover's raised moulding while engaging
  // the top half-millimetre of the output shaft.
  const z = n(p, 'bodyHeight') + n(p, 'shaftHeight') - 0.5;
  const reach = n(p, 'hornArmLength'),
    width = n(p, 'hornArmWidth');
  return subtract(
    union(
      cylinder(r, t, [0, 0, z]),
      box([reach - width / 2, width, t], [0, -width / 2, z]),
      cylinder(width / 2, t, [reach - width / 2, 0, z]),
    ),
    cylinder((n(p, 'shaftDiameter') + n(p, 'fitClearance')) / 2, t + 2, [0, 0, z - 1]),
    cylinder(n(p, 'hornHoleDiameter') / 2, t + 2, [reach - width / 2, 0, z - 1]),
  );
}

export function assembly(p: Parameters, state: string): Entry[] {
  const count = state === 'body' ? 3 : p.showHorn === true && p.hornStyle === 'disc' ? 8 : 6;
  const entries: Entry[] = native.components.slice(0, count).map((record, source) => ({
    source,
    label: record.label,
    color: record.color,
    rotation: source === 5 || source === 6 ? n(p, 'outputAngle') : 0,
    shift: state === 'exploded' ? exploded[source] : [0, 0, 0],
  }));
  if (state !== 'body' && p.showHorn === true && p.hornStyle === 'single') {
    entries.push({
      shape: prototypeArm(p),
      label: 'Prototype output arm',
      color: '#b4b9c0',
      rotation: n(p, 'outputAngle'),
      shift: state === 'exploded' ? exploded[6] : [0, 0, 0],
    });
  }
  return entries;
}

function bytes(encoded: string): ArrayBuffer {
  const binary = atob(encoded);
  const buffer = new ArrayBuffer(binary.length);
  const values = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) values[i] = binary.charCodeAt(i);
  return buffer;
}
const templates = new Map<number, BufferGeometry>();
function nativeGeometry(source: number): BufferGeometry {
  let geometry = templates.get(source);
  if (!geometry) {
    const record = native.components[source];
    geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(bytes(record.positions)), 3),
    );
    geometry.setIndex(new BufferAttribute(new Uint32Array(bytes(record.indices)), 1));
    geometry.computeVertexNormals();
    geometry.userData.nativeTopology = true;
    templates.set(source, geometry);
  }
  return geometry.clone();
}

export function geometry(p: Parameters, state: string): Group {
  return new Group().add(
    ...assembly(p, state).map((entry) => {
      const placed = new Group();
      placed.name = entry.label;
      if (entry.source !== undefined) {
        const mesh = new Mesh(
          nativeGeometry(entry.source),
          new MeshStandardMaterial({
            color: entry.color,
            roughness: 0.42,
            metalness: entry.source === 3 || entry.source === 5 ? 0.55 : 0.05,
          }),
        );
        mesh.name = entry.label;
        placed.add(mesh);
      } else
        placed.add(
          component(
            entry.shape!,
            entry.label,
            Number.parseInt(entry.color.slice(1), 16),
            [0, 0, 0],
          ),
        );
      placed.rotation.z = (entry.rotation * Math.PI) / 180;
      placed.position.set(...entry.shift);
      return placed;
    }),
  );
}

export function python(p: Parameters, state: string): string {
  const entries = assembly(p, state);
  return [
    'import base64, zlib',
    `# ST3215 source SHA-256: ${native.sourceSha256}`,
    `# ${native.repair}`,
    ...entries.flatMap((entry, i) => [
      ...(entry.source !== undefined
        ? [
            `component_${i} = Part.Shape()`,
            `component_${i}.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(native.components[entry.source].brep)})).decode('utf-8'))`,
          ]
        : [`component_${i} = ${pythonShape(entry.shape!)}.removeSplitter()`]),
      `component_${i}.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(entry.rotation)})`,
      `component_${i}.translate(App.Vector(${entry.shift.map(num).join(',')}))`,
    ]),
    `shape = Part.makeCompound([${entries.map((_, i) => `component_${i}`).join(',')}])`,
    `component_labels = ${JSON.stringify(entries.map((entry) => entry.label))}`,
    `component_colors = ${JSON.stringify(entries.map((entry) => [1, 3, 5].map((offset) => Number.parseInt(entry.color.slice(offset, offset + 2), 16) / 255)))}`,
  ].join('\n');
}

export function dimensions(p: Parameters, state: string): Vec {
  const model = geometry(p, state);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    }
  });
  return size;
}
