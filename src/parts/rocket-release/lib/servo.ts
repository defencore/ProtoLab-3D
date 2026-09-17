import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  box,
  cylinder,
  ring,
  union,
  subtract,
  transform,
  plate,
  circle,
  type Shape,
} from './shapes';
import { profile } from './gears';
import { at, layout } from './motion';

/** MG90S nominal body 22.8 × 12.2 × 28.5 mm; ears and adaptor reconstructed. */
const earOffsets = [-18.7, 8.1];
// Put the mounting ears between the cardinal idler axes at every tube size.
export const servoMounts = earOffsets.map((x) => at(x, 45));
const steel = 0x929eac,
  brass = 0xb99450;
export function dBore(z: number, height: number): Shape {
  return subtract(cylinder(1.55, height, [0, 0, z]), box([3, 4, height + 2], [1.15, -2, z - 1]));
}
export function spindle(shoulder: boolean): Shape {
  const shaft = subtract(cylinder(1.5, 51.15 - 42.5, [0, 0, 42.5]), box([3, 4, 10], [1.1, -2, 42]));
  return subtract(
    shoulder ? union(shaft, cylinder(2.2, 0.7, [0, 0, 43.1])) : shaft,
    cylinder(0.55, 4, [0, 0, 48.15]),
  );
}
export function spindleScrew(): Shape {
  return union(
    cylinder(0.5, 3, [0, 0, 48.15]),
    subtract(cylinder(2.2, 0.8, [0, 0, 51.15]), plate(circle(0.7, 0, 0, 6), [], 51.55, 1)),
  );
}
export function servoPieces(p: Parameters): Piece[] {
  const m = layout(p),
    angle = 9 + m.servoAngle;
  const caseShape = subtract(
    union(
      box([22.8, 12.2, 28.5], [-16.7, -6.1, 14]),
      box([30.8, 12.2, 2], [-20.7, -6.1, 39.5]),
      ring(3, 1.55, 42.5, 1.3),
    ),
    ...earOffsets.map((x) => cylinder(1.05, 4, [x, 0, 38.5])),
  );
  const parts: Piece[] = [
    {
      label: 'Central micro servo · MG90S body envelope',
      shape: transform(caseShape, 45),
      color: 0x303a47,
    },
    { label: 'Servo D-shaft adaptor', shape: transform(spindle(false), angle), color: steel },
    {
      label: 'Central shaft bushing',
      shape: union(ring(3, 1.55, 44, 2), ring(3.6, 1.55, 46, 1.8)),
      color: brass,
    },
    {
      label: 'Servo input pinion · 20 teeth',
      shape: transform(subtract(plate(profile(m.module, 20), [], 48, 3), dBore(47, 5)), angle),
      color: 0xc36d4c,
    },
    {
      label: 'Servo input pinion retaining screw',
      shape: transform(spindleScrew(), angle),
      color: steel,
    },
  ];
  for (const [i, [x, y]] of servoMounts.entries()) {
    parts.push(
      {
        label: `Servo mounting spacer ${i + 1}`,
        shape: ring(2, 1.05, 41.5, 2.5, x, y),
        color: brass,
      },
      {
        label: `Servo mounting screw ${i + 1}`,
        shape: union(cylinder(1, 6.5, [x, y, 39]), cylinder(1.8, 1.2, [x, y, 37.8])),
        color: steel,
      },
      {
        label: `Servo mounting washer ${i + 1}`,
        shape: ring(1.8, 1.05, 39, 0.5, x, y),
        color: steel,
      },
    );
  }
  return parts;
}
