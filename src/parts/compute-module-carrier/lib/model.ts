import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/electronics/assembly';
import * as assembly from '../../../core/assembly/electronics/assembly';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/electronics/shapes';
import data from './models.json';

export interface CarrierComponent {
  label: string;
  origin: Vec;
  size: Vec;
  color: number;
  style?: 'box' | 'socket' | 'b2b' | 'header';
  mouth?: 'x-' | 'x+' | 'y-' | 'y+' | 'z+';
  openings?: number;
  sourceBounds?: number[];
  evidence?: string;
}
export interface CarrierModel {
  id: string;
  name: string;
  manufacturer: string;
  revision: string;
  width: number;
  length: number;
  board: number;
  radius: number;
  holes: [number, number, number][];
  moduleHoles: [number, number, number][];
  components: CarrierComponent[];
  source: string;
  references: string[];
  sourceSha256: string;
  attributes: Record<string, string | number | boolean>;
  limitations: string;
}
export const models = data as unknown as CarrierModel[];
export function selected(p: Parameters): CarrierModel {
  const model = models.find((candidate) => candidate.id === p.model);
  if (!model) throw new Error('Select a supported CM5 carrier board.');
  return model;
}
export function pieces(p: Parameters, state: string): Piece[] {
  const model = selected(p);
  const bores = [...model.holes, ...model.moduleHoles].map(([x, y, diameter]) =>
    cylinder(diameter / 2, model.board + 2, [x, y, -1]),
  );
  const pcb = roundedRect(model.width, model.length, model.radius, 0, model.board);
  const out: Piece[] = [
    {
      label: 'PCB — ' + model.name,
      color: model.manufacturer === 'Raspberry Pi' ? 0x237540 : 0x23456b,
      shape: bores.length ? subtract(pcb, ...bores) : pcb,
    },
  ];
  for (const component of model.components) {
    const [w, l, h] = component.size,
      [x, y, z] = component.origin;
    let shape: Shape = box(component.size, component.origin);
    if ((component.style === 'socket' || component.style === 'b2b') && component.mouth) {
      const wall = Math.min(0.4, w / 6, l / 6, h / 5);
      const axis = component.mouth[0] === 'x' ? 0 : component.mouth[0] === 'y' ? 1 : 2;
      const count = axis === 2 ? 1 : (component.openings ?? 1);
      const openingHeight = (h - (count + 1) * wall) / count;
      const cavities = Array.from({ length: count }, (_, i) => {
        const size: Vec = [w - 2 * wall, l - 2 * wall, openingHeight];
        const origin: Vec = [x + wall, y + wall, z + wall + i * (openingHeight + wall)];
        size[axis] += 2 * wall;
        origin[axis] += component.mouth!.endsWith('-') ? -2 * wall : 0;
        return box(size, origin);
      });
      shape = subtract(shape, ...cavities);
    }
    out.push({
      shape,
      label: component.label,
      color: component.color,
      z: state === 'exploded' ? (z < 0 ? -10 : 10) : 0,
    });
    if (component.style === 'header' && h > 3) {
      out[out.length - 1].shape = box([w, l, 2.5], [x, y, z]);
      const alongX = w > l;
      const columns = 20,
        pitch = 2.54;
      for (let i = 0; i < columns; i++)
        for (let row = 0; row < 2; row++) {
          const u = (i - (columns - 1) / 2) * pitch;
          const v = (row - 0.5) * pitch;
          const cx = x + w / 2 + (alongX ? u : v);
          const cy = y + l / 2 + (alongX ? v : u);
          out.push({
            shape: box([0.64, 0.64, h - 2.5], [cx - 0.32, cy - 0.32, z + 2.5]),
            label: component.label + ' contact ' + (2 * i + row + 1),
            color: 0xc6ab68,
            z: state === 'exploded' ? 10 : 0,
          });
        }
    }
  }
  return out;
}
export const geometry = (p: Parameters, state: string) => assembly.geometry(pieces(p, state));
export const dimensions = (p: Parameters, state: string) => assembly.dimensions(pieces(p, state));
export const python = (p: Parameters, state: string) => assembly.python(pieces(p, state));
