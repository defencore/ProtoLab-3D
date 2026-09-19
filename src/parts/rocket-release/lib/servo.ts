import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { cylinder, union, subtract, transform, plate, type Shape } from './shapes';
import { profile } from './gears';
import { layout } from './motion';

import native from './st3215-native.json';
import splinePoints from './st3215-spline.json';
const steel = 0x929eac;
/** Source front-face hole coordinates: longitudinal pitch 20.7, row pitch 20.5 mm. */
export const servoMounts: [number, number][] = [
  [8.3, -10.25],
  [8.3, 10.25],
  [29, -10.25],
  [29, 10.25],
];
export function servoPieces(p: Parameters): Piece[] {
  const m = layout(p),
    angle = m.servoAngle,
    z = m.stackOffset;
  // Raised face at local Z44; front pillars locate in the stock pilot holes without modifying the case.
  // The OEM horn is replaced by the pinion itself.
  const out: Piece[] = [0, 1, 2, 3, 4, 5].map((index) => ({
    label: `ST3215 · ${native.components[index].label} · supplier CAD`,
    color: Number.parseInt(native.components[index].color.slice(1), 16),
    shape: transform({ kind: 'native', index }, index === 5 ? angle : 0, [0, 0, m.servoZ]),
  }));
  servoMounts.forEach(([x, y], i) =>
    out.push({
      label: `ST3215 front support pillar ${i + 1} · Al6061 Ø3.4×3.1 · locating pins Ø1.5×1`,
      shape: union(cylinder(1.7, 3.1, [x, y, 40.9 + z]), cylinder(0.75, 5.1, [x, y, 39.9 + z])),
      color: 0xc6cdd5,
    }),
  );
  const spline = splinePoints as [number, number][];
  const gear = subtract(
    union(
      transform(plate(profile(m.module, 20), [], 48 + z, 3), 9),
      cylinder(4, 8.3, [0, 0, 39.7 + z]),
    ),
    plate(spline, [], 39.6 + z, 3.15),
    cylinder(1.6, 9, [0, 0, 42.6 + z]),
    cylinder(2.6, 8, [0, 0, 43.2 + z]),
  );
  out.push({
    label: `Servo input pinion · 20 teeth · m${m.module.toFixed(4)} · 20° · Al7075 · t3 · integral Ø8 hub · ST3215 25T spline Ø6 +0.04 radial`,
    shape: transform(gear, angle),
    color: 0xc36d4c,
  });
  out.push({
    label: 'BUY ST3215 output retaining screw · CAD-fit reference · assumed head Ø5×1',
    shape: transform({ kind: 'native', index: 8 }, angle, [0, 0, m.servoZ]),
    color: steel,
  });
  return out;
}
