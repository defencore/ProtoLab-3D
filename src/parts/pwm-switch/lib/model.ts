import type { Piece } from '../../flight-controller/lib/assembly';
import {
  box,
  roundedRect,
  subtract,
  union,
  prism,
  type Shape,
} from '../../flight-controller/lib/shapes';
export function pieces(state = 'assembled'): Piece[] {
  const out: Piece[] = [];
  const add = (name: string, shape: Shape, color: number, layer = 0) =>
    out.push({
      label: 'BUY PWM Switch · ' + name,
      shape,
      color,
      z: state === 'exploded' ? layer * 7 : 0,
    });
  // The photograph shows a wrapped module, not a bare PCB. Reconstruct visible
  // sleeve and exit features; do not invent its hidden circuit or MOSFET ratings.
  const marking = prism(
    [
      [-4, -2],
      [3, -2],
      [5, 0],
      [3, 2],
      [-4, 2],
    ],
    0.05,
    9.95,
  );
  const sleeve = subtract(
    roundedRect(17, 13, 2.3, 0, 10),
    box([18, 8.4, 5], [-9, -4.2, 2.5]),
    marking,
  );
  add('Rounded protective sleeve 17x13x10 · wiring exits', sleeve, 0xdedfdc);
  add('Internal board edge reference', box([15, 7.8, 1], [-7.5, -3.9, 4.5]), 0x355544);
  add(
    'Power terminal ends',
    union(
      ...[-1, 1].flatMap((x) =>
        [-1, 1].map((y) => box([1, 1.4, 1.4], [x < 0 ? -8.5 : 7.5, y * 2.2 - 0.7, 5.5])),
      ),
    ),
    0xb8835a,
  );
  add('PWM signal terminal', box([1, 1.2, 1.2], [-8.5, -0.6, 2.8]), 0xbcad85);
  add(
    'Power red sleeve marks',
    union(...[-1, 1].map((x) => box([1, 0.9, 0.3], [x < 0 ? -8.5 : 7.5, 1.6, 7]))),
    0xbf514a,
  );
  add('PWM identification inlay', marking, 0xcd7964, 1);
  return out;
}
