import * as THREE from 'three';
import { num } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { enclosureModel, type EnclosureCatalogModel } from './catalog';
import { grandadoDimensions, grandadoGeometry, grandadoPython } from './grandado';

const isGrandado = (parameters: Parameters) => parameters.model === 'grandado-83-58-35-clear';
const physicalGrandadoState = (state: string) => ['body-only', 'body-with-screws'].includes(state) ? state : 'assembled';

export const hasCover = (model: EnclosureCatalogModel) => model.lid?.toLowerCase() !== 'open';
const clearCover = (model: EnclosureCatalogModel) =>
  /clear|transparent/i.test(model.lid ?? '') && !/opaque|open/i.test(model.lid ?? '');

/** Internal construction is illustrative; only the outside envelope comes from the catalog. */
function shell(model: EnclosureCatalogModel, state: string) {
  const thickness = Math.min(3, model.length / 12, model.width / 12, model.height / 6);
  return {
    thickness,
    bodyHeight: model.height - (hasCover(model) ? thickness : 0),
    lift: state === 'open' && hasCover(model) ? Math.min(40, Math.max(12, model.height * 0.35)) : 0,
  };
}

function bodyGeometry(length: number, width: number, height: number, thickness: number) {
  const corners = (x: number, y: number, z: number) => [
    [-x / 2, -y / 2, z],
    [x / 2, -y / 2, z],
    [x / 2, y / 2, z],
    [-x / 2, y / 2, z],
  ];
  const points = [
    ...corners(length, width, 0),
    ...corners(length, width, height),
    ...corners(length - 2 * thickness, width - 2 * thickness, height),
    ...corners(length - 2 * thickness, width - 2 * thickness, thickness),
  ];
  const positions: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    for (const vertex of [a, b, c, a, c, d]) positions.push(...points[vertex]);
  };
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    quad(i, next, next + 4, i + 4);
    quad(i + 4, next + 4, next + 8, i + 8);
    quad(i + 12, i + 8, next + 8, next + 12);
  }
  quad(12, 13, 14, 15);
  quad(3, 2, 1, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function geometry(parameters: Parameters, state: string): THREE.Group {
  if (isGrandado(parameters)) return grandadoGeometry(state);
  const model = enclosureModel(parameters.model);
  const { thickness, bodyHeight, lift } = shell(model, state);
  const metal = /alumin|steel|metal/i.test(model.material ?? '');
  const body = new THREE.Mesh(
    bodyGeometry(model.length, model.width, bodyHeight, thickness),
    new THREE.MeshStandardMaterial({
      color: metal ? 0x9da3aa : 0xd9dce0,
      metalness: metal ? 0.65 : 0.04,
      roughness: metal ? 0.35 : 0.55,
    }),
  );
  body.position.z = -model.height / 2;
  body.name = 'Body envelope — illustrative interior';
  if (!hasCover(model)) return new THREE.Group().add(body);
  const clear = clearCover(model);
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(model.length, model.width, thickness),
    new THREE.MeshStandardMaterial({
      color: clear ? 0xaed8ec : metal ? 0xb5bac0 : 0xe9ebee,
      metalness: clear ? 0 : metal ? 0.65 : 0.04,
      roughness: clear ? 0.15 : 0.45,
      transparent: clear,
      opacity: clear ? 0.4 : 1,
      depthWrite: !clear,
    }),
  );
  cover.position.z = model.height / 2 - thickness / 2 + lift;
  cover.name = clear ? 'Clear cover envelope — approximate' : 'Cover envelope — approximate';
  return new THREE.Group().add(body, cover);
}

export function python(parameters: Parameters, state: string): string {
  if (isGrandado(parameters)) return grandadoPython(physicalGrandadoState(state));
  const model = enclosureModel(parameters.model);
  const { thickness, bodyHeight, lift } = shell(model, state);
  const x = -model.length / 2;
  const y = -model.width / 2;
  const z = -model.height / 2;
  const clear = clearCover(model);
  return [
    `outer = Part.makeBox(${num(model.length)}, ${num(model.width)}, ${num(bodyHeight)}, App.Vector(${num(x)}, ${num(y)}, ${num(z)}))`,
    `pocket = Part.makeBox(${num(model.length - 2 * thickness)}, ${num(model.width - 2 * thickness)}, ${num(bodyHeight)}, App.Vector(${num(x + thickness)}, ${num(y + thickness)}, ${num(z + thickness)}))`,
    'body = outer.cut(pocket).removeSplitter()',
    ...(hasCover(model)
      ? [
          `cover = Part.makeBox(${num(model.length)}, ${num(model.width)}, ${num(thickness)}, App.Vector(${num(x)}, ${num(y)}, ${num(model.height / 2 - thickness + lift)}))`,
          'shape = Part.makeCompound([body, cover])',
          `component_labels = ${JSON.stringify(['Body envelope — illustrative interior', clear ? 'Clear cover envelope — approximate' : 'Cover envelope — approximate'])}`,
          `component_colors = [(0.85,0.86,0.88),${clear ? '(0.68,0.85,0.93)' : '(0.91,0.92,0.93)'}]`,
        ]
      : [
          'shape = Part.makeCompound([body])',
          'component_labels = ["Body envelope — illustrative interior"]',
          'component_colors = [(0.85,0.86,0.88)]',
        ]),
  ].join('\n');
}

export function dimensions(parameters: Parameters, state: string): [number, number, number] {
  if (isGrandado(parameters)) return grandadoDimensions(state);
  const model = enclosureModel(parameters.model);
  return [model.length, model.width, model.height + shell(model, state).lift];
}

export function exportGeometry(parameters: Parameters, state: string): THREE.Group {
  return geometry(parameters, isGrandado(parameters) ? physicalGrandadoState(state) : state);
}

export function exportDimensions(parameters: Parameters, state: string): [number, number, number] {
  return dimensions(parameters, isGrandado(parameters) ? physicalGrandadoState(state) : state);
}
