import { Mesh, MeshStandardMaterial } from 'three';
import type { Parameters } from '../../../core/types';
import {
  supplierDimensions,
  supplierGeometry,
  supplierPython,
} from '../../../core/manufacturer-cad';
import data from './models.json';
import assets from './native';

export const models = data;
export const copperThickness = 0.035;
export function selected(p: Parameters) {
  const model = models.find((model) => model.id === p.model);
  if (!model) throw new Error('Choose a supported PY prototyping board.');
  return model;
}
export function holeCenters(p: Parameters): [number, number][] {
  const model = selected(p);
  return Array.from({ length: model.rows }, (_, row) =>
    Array.from({ length: model.columns }, (_, column): [number, number] => [
      (column - (model.columns - 1) / 2) * model.pitch,
      (row - (model.rows - 1) / 2) * model.pitch,
    ]),
  ).flat();
}
export function mountingCenters(p: Parameters): [number, number][] {
  const model = selected(p);
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((y): [number, number] => [
      (x * model.mountPitchX) / 2,
      (y * model.mountPitchY) / 2,
    ]),
  );
}
const placement = (p: Parameters) => [
  { key: selected(p).id, label: selected(p).designation, translation: [0, 0, 0] },
];
export function geometry(p: Parameters) {
  const model = selected(p),
    group = supplierGeometry(assets, placement(p)),
    labels = ['Perforated FR4 substrate', 'Bottom copper pads', 'Top copper pads'];
  group.children.forEach((child, index) => {
    if (!(child instanceof Mesh)) return;
    child.name = labels[index];
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.color.setHex(index === 0 ? 0x168c68 : model.copperColor);
      material.metalness = index === 0 ? 0.05 : 0.65;
      material.roughness = index === 0 ? 0.7 : 0.4;
    }
  });
  return group;
}
export function dimensions(p: Parameters): [number, number, number] {
  return supplierDimensions(assets, placement(p));
}
export function python(p: Parameters): string {
  const model = selected(p),
    labels = ['Perforated FR4 substrate', 'Bottom copper pads', 'Top copper pads'].slice(
      0,
      model.sides + 1,
    ),
    colors = [0x168c68, ...Array(model.sides).fill(model.copperColor)].map((color: number) => [
      ((color >> 16) & 255) / 255,
      ((color >> 8) & 255) / 255,
      (color & 255) / 255,
    ]);
  return [
    '# Declared source-dimension reconstruction; not original manufacturer CAD.',
    supplierPython(assets, placement(p)),
    `component_labels = ${JSON.stringify(labels)}`,
    `component_colors = ${JSON.stringify(colors)}`,
  ].join('\n');
}
