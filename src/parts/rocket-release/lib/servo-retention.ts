import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { layout } from './motion';
import { box, cylinder, union, subtract, transform, rotate, type Shape } from './shapes';
import { screw, matingHole } from './hardware';
export const servoTiePosts: [number, number][] = [
  [-13.5, -10],
  [-13.5, 10],
  [37, -15.5],
  [37, 15.5],
];
/** A single pocketed plate preloads the case through four metal tie posts. */
export function servoRetention(p: Parameters): Piece[] {
  const m = layout(p),
    out: Piece[] = [],
    z = m.servoZ - 3.5;
  const beam = (a: [number, number], b: [number, number], width = 3.4): Shape => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    return union(
      cylinder(width / 2, 2, [...a, z]),
      cylinder(width / 2, 2, [...b, z]),
      transform(
        box([Math.hypot(dx, dy), width, 2], [0, -width / 2, z]),
        (Math.atan2(dy, dx) * 180) / Math.PI,
        [...a, 0],
      ),
    );
  };
  const pads: [number, number][] = [
    [-6, -8],
    [-6, 8],
    [31.5, -9.5],
    [31.5, 9.5],
  ];
  const frame: Shape[] = [
    ...[-1, 1].flatMap((sign) => [
      beam([-6, sign * 8], [13, sign * 11.8], 2.6),
      beam([13, sign * 11.8], [31.5, sign * 11.8], 2.6),
      beam([31.5, sign * 11.8], [31.5, sign * 9.5], 2.6),
    ]),
    beam([-8.5, -8], [-8.5, 8]),
    beam(pads[2], pads[3]),
    beam([-8.5, -8], pads[0]),
    beam([-8.5, 8], pads[1]),
    ...pads.slice(0, 2).map(([x, y]) => cylinder(1.7, 3.5, [x, y, z])),
  ];
  servoTiePosts.forEach(([x, y], i) => {
    const contact = m.servoZ - 1.5;
    const lower = transform(rotate(screw(2, 6, { headHeight: 1.2 }), 180, 'x'), 0, [
      x,
      y,
      contact + 4,
    ]);
    const upper = transform(screw(2, 6, { headHeight: 1.2 }), 0, [x, y, 40 + m.stackOffset]);
    frame.push(beam([x, y], pads[i], i < 2 ? 2.8 : 3.4), cylinder(i < 2 ? 2.3 : 2.5, 2, [x, y, z]));
    const post = subtract(
      cylinder(2, 44 + m.stackOffset - contact, [x, y, contact]),
      matingHole(lower),
      matingHole(upper),
    );
    out.push(
      {
        label: `ST3215 metal clamp standoff ${i + 1} · Al6061 Ø4×${(44 + m.stackOffset - contact).toFixed(1)} · M2 ends`,
        shape: post,
        color: 0xc6cdd5,
      },
      { label: `ST3215 standoff lower screw ${i + 1}`, shape: lower, color: 0x929eac },
      { label: `ST3215 standoff disk screw ${i + 1}`, shape: upper, color: 0x929eac },
    );
  });
  out.push({
    label:
      'ST3215 machined rear mounting plate · Al6061 · stock t3.5 · web t2 · stepped contact pads · 4×Ø2.2',
    shape: subtract(
      union(...frame),
      ...servoTiePosts.map(([x, y]) => cylinder(1.1, 5, [x, y, z - 0.5])),
    ),
    color: 0xc6cdd5,
  });
  return out;
}
