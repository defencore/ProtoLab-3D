import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  supplierGeometry,
  supplierPython,
  type SupplierAsset,
  type SupplierPlacement,
  type SupplierSolid,
} from '../../../core/manufacturer-cad';
import { disposeModel } from '../../../core/mechanical';
import type { Parameters } from '../../../core/types';
import modelData from './models.json';
import { assets } from './native';

export interface HolderModel {
  id: string;
  name: string;
  manufacturer: string;
  designation: string;
  cells: 2 | 3 | 4;
  length: number;
  width: number;
  height: number;
  pitch: number;
  wired: boolean;
  circuit: '2S1P' | '3S1P' | '4S1P' | 'Independent';
  source: string;
  sourceCadUrl: string;
  sourceSha256: string;
  mountHoles: [number, number][];
  geometryKind: 'source-dimensions' | 'manufacturer-cad';
}

export const models = modelData.map((model) => ({
  ...model,
  mountHoles: model.mountHoles.map(([x, y]): [number, number] => [x, y]),
})) as HolderModel[];
const bodyColor = '#171a1e';
const contactColor = '#bcc1c7';

export function selected(p: Parameters): HolderModel {
  const model = models.find((item) => item.id === p.model);
  if (!model) throw new Error('Choose an available 18650 holder.');
  return model;
}

function plastic(solid: SupplierSolid): boolean {
  const counts = solid.groups.reduce(
    (sum, [, count, material]) => {
      sum[material === 1 ? 1 : 0] += count;
      return sum;
    },
    [0, 0],
  );
  return counts[1] > counts[0];
}

function holderComponents(p: Parameters, state: string) {
  const model = selected(p),
    source = assets[model.id];
  if (!source) throw new Error(`Missing native holder model: ${model.id}`);
  const sources: Record<string, SupplierAsset> = {},
    placements: SupplierPlacement[] = [],
    colors: string[] = [];
  source.components.forEach((solid, index) => {
    const key = `${model.id}:${index}`,
      isPlastic = plastic(solid),
      centerY = (solid.bounds[1] + solid.bounds[4]) / 2,
      cell = Math.round(centerY / model.pitch + (model.cells - 1) / 2) + 1,
      front = solid.bounds[0] + solid.bounds[3] < 0,
      label = isPlastic
        ? ((solid as SupplierSolid & { label?: string }).label ?? 'Holder body')
        : `Cell ${cell} · ${front ? 'front' : 'rear'} spring contact${model.geometryKind === 'source-dimensions' ? ' · reconstruction' : ''}`;
    sources[key] = { ...source, components: [solid] };
    placements.push({
      key,
      label,
      translation: [0, 0, state === 'exploded' && !isPlastic ? 15 : 0],
    });
    colors.push(isPlastic ? bodyColor : contactColor);
  });
  return { sources, placements, colors };
}

export function geometry(p: Parameters, state = 'assembled'): Group {
  const { sources, placements } = holderComponents(p, state),
    group = supplierGeometry(sources, placements);
  group.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = child.material as MeshStandardMaterial[];
    materials[0].color.set(contactColor);
    materials[0].metalness = 0.75;
    materials[0].roughness = 0.24;
    materials[1].color.set(bodyColor);
    materials[1].metalness = 0;
    materials[1].roughness = 0.65;
  });
  return group;
}

export function dimensions(p: Parameters, state = 'assembled'): [number, number, number] {
  const model = geometry(p, state);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
  } finally {
    disposeModel(model);
  }
}

export function python(p: Parameters, state = 'assembled'): string {
  const { sources, placements, colors } = holderComponents(p, state),
    rgb = (color: string) => {
      const value = Number.parseInt(color.slice(1), 16);
      return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
    },
    lines = [
      supplierPython(sources, placements),
      `component_colors = ${JSON.stringify(colors.map(rgb))}`,
    ];
  lines.push('shape = Part.makeCompound(components) if len(components) > 1 else components[0]');
  return lines.join('\n');
}
