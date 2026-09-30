import type { Piece } from '../../flight-controller/lib/assembly';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../flight-controller/lib/shapes';
export function pieces(state = 'assembled'): Piece[] {
  const out: Piece[] = [];
  const add = (name: string, shape: Shape, color: number, layer = 1) =>
    out.push({
      label: 'BUY JHE20B · ' + name,
      shape,
      color,
      z: state === 'exploded' ? layer * 7 : 0,
    });
  add('Backup pouch cell', roundedRect(18.6, 9.2, 0.8, 0, 2), 0xaeb5bc, -1);
  add('PCB 20x10', roundedRect(20, 10, 0.6, 2, 0.7), 0x2d5447, 0);
  add(
    'Buzzer can with sound outlet',
    subtract(cylinder(4, 5.3, [-4.5, 0, 2.7]), cylinder(1.05, 1.2, [-4.5, 0, 7])),
    0x292e34,
  );
  add(
    '3-pin connection housing',
    subtract(box([5.2, 4, 3], [4.2, -2, 2.7]), box([4.5, 2.8, 1.8], [5, -1.4, 3.3])),
    0xe1d9c4,
  );
  add(
    'Connector contacts',
    union(...[-1, 0, 1].map((y) => box([4, 0.25, 0.25], [5.1, y, 4]))),
    0xc7ad72,
  );
  add('Reset switch frame', box([2, 2, 0.5], [0.3, 2.8, 2.7]), 0xaeb6bd);
  add('Reset button', cylinder(0.65, 0.55, [1.3, 3.8, 3.2]), 0x252e37);
  add('Status LED', cylinder(0.7, 0.6, [1.1, -3.5, 2.7]), 0xdcd672);
  add('Power components', box([1.5, 2, 0.6], [2, -1, 2.7]), 0x2f353e);
  return out;
}
