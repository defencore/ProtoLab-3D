import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { at, layout } from './motion';
import { cylinder, ring, subtract, transform } from './shapes';
import { flatScrew, flatSeat } from './hardware';

export const gearCapZ = 51.15;
export const gearSeatZ = 47.85;
export const idlerAxes = (p: Parameters) =>
  [0, 90, 180, 270].map((a) => at(layout(p).driveRadius, a));
export const capPosts = (p: Parameters) =>
  [45, 135, 225, 315].map((a) => at(layout(p).pitchRadius * 0.82, a));
export const capRadius = (p: Parameters) => layout(p).pitchRadius - layout(p).module - 0.4;
export const capScrews = (p: Parameters) =>
  capPosts(p).map(([x, y]) => transform(flatScrew(6), 0, [x, y, gearCapZ - 4]));
/** Fixed steel pins are captured in blind seats in the two plates; POM gears turn on them. */
export function gearCarrier(p: Parameters): Piece[] {
  const m = layout(p),
    out: Piece[] = [];
  const cap = subtract(
    ring(capRadius(p), 11 * m.module + 0.6, gearCapZ, 2),
    ...idlerAxes(p).map(([x, y]) => cylinder(1.52, 1.01, [x, y, gearCapZ - 0.01])),
    ...capScrews(p).map(flatSeat),
  );
  out.push({
    label: `Idler axle retaining disk · Al6061 · t2 · centre Ø${(2 * (11 * m.module + 0.6)).toFixed(2)} · 4 blind Ø3.04×1 seats`,
    shape: cap,
    color: 0xc6cdd5,
  });
  idlerAxes(p).forEach(([x, y], i) =>
    out.push({
      label: `Fixed idler axle ${i + 1} · steel · Ø3×${(gearCapZ + 1 - 45).toFixed(2)} · captive between blind seats`,
      shape: cylinder(1.5, gearCapZ + 1 - 45, [x, y, 45]),
      color: 0x929eac,
    }),
  );
  capScrews(p).forEach((shape, i) =>
    out.push({
      label: `Idler retaining disk screw ${i + 1} · countersunk 90°`,
      shape,
      color: 0x929eac,
    }),
  );
  return out;
}
