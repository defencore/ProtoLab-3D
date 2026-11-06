import type { Parameters } from '../../../core/types';
import { cylinder, box, subtract, union, ring } from '../../../core/assembly/mechanical/shapes';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import { selectedModel } from './catalog';

/** Installation geometry. Unspecified wall thicknesses and hidden internals are illustrative. */
export function pieces(p: Parameters, state: string): Piece[] {
  const model = selectedModel(p.model),
    length = model.length;
  const gap = state === 'exploded' ? 9 : 0;
  const front = subtract(
    cylinder(8, 3, [0, 0, -3]),
    cylinder(1.56, 4, [0, 0, -3.5]),
    ...[-5.25, 5.25].map((x) => cylinder(1, 2.5, [x, 0, -2.45])),
  );
  const pilot = ring(3, 1.56, 0, 2.3);
  const shaft = subtract(cylinder(1.5, 14.6, [0, 0, -3]), box([4, 2, 7.1], [-2, 1.3, 4.6]));
  const result: Piece[] = [
    {
      label: 'Front cover · two M2 mounting pilots · 10.5 mm pitch',
      shape: union(front, pilot),
      color: 0x292d32,
      z: gap,
    },
    {
      label: 'Output shaft · Ø3 · 11.6D7',
      shape: shaft,
      color: 0xc1c8ce,
      angle: Number(p.outputAngle),
      z: gap * 2,
    },
    {
      label: `Planetary gearbox housing · ${model.stages} stages · ${model.ratio}:1`,
      shape: ring(8, 6.8, -length + 0.4, length - 3.4),
      color: 0x252a30,
    },
    { label: 'Gearbox rear closure', shape: ring(7.9, 1.8, -length, 0.4), color: 0x8f969e },
    {
      label: 'Motor front cover and silver joint',
      shape: ring(8, 1.8, -length - 1.3, 1.3),
      color: 0xb0b8c0,
      z: -gap,
    },
    {
      label: 'TEC1636 · Ø16 × 36 motor shell',
      shape: ring(8, 7, -length - 34.8, 33.5),
      color: 0x22272d,
      z: -gap,
    },
    {
      label: 'Motor rear cap',
      shape: subtract(
        cylinder(8, 1.2, [0, 0, -length - 36]),
        cylinder(1.3, 2, [0, 0, -length - 36.4]),
      ),
      color: 0xa6afb7,
      z: -gap * 2,
    },
    {
      label: 'Rear cable grommet',
      shape: ring(1.25, 0.8, -length - 36, 1.2),
      color: 0x30343a,
      z: -gap * 2,
    },
  ];
  if (p.showLeads)
    for (let i = 0; i < 3; i++)
      result.push({
        label: `Illustrative phase lead ${i + 1}`,
        shape: cylinder(0.3, 12, [(i - 1) * 0.7, 0, -length - 48]),
        color: [0x35649e, 0xd6b848, 0x373a3f][i],
        z: -gap * 2,
      });
  return result;
}

export function dimensions(p: Parameters, state: string): [number, number, number] {
  const model = selectedModel(p.model);
  return [
    16,
    16,
    model.length + 36 + 11.6 + (p.showLeads ? 12 : 0) + (state === 'exploded' ? 36 : 0),
  ];
}
