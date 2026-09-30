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
      label: 'BUY ZX908 · ' + name,
      shape,
      color,
      z: state === 'exploded' ? layer * 7 : 0,
    });
  add('Rounded PCB 35x20', roundedRect(35, 20, 2, 0.5, 0.8), 0x242e36, 0);
  add('Back component / solder layer', roundedRect(30, 16, 1, 0, 0.5), 0x51565e, -1);
  add('Antenna ground surround', box([15.6, 16, 0.25], [-16.4, -8, 1.3]), 0xb58d53);
  add(
    'Ceramic patch antenna',
    subtract(box([14.6, 14.4, 2.95], [-15.9, -7.2, 1.55]), cylinder(0.65, 0.1, [-8.6, 0, 4.44])),
    0xeee9d8,
  );
  add('Antenna feed', cylinder(0.65, 0.06, [-8.6, 0, 4.44]), 0xb4bac1);
  add(
    'SIM holder frame',
    subtract(box([11.5, 9, 1.4], [4, -8, 1.3]), box([9.5, 9, 0.7], [5, -8.1, 1.3])),
    0xafb7bd,
  );
  add('SIM inspection slot', box([5, 3, 0.04], [7.3, -5.2, 2.7]), 0x363c43);
  add('RF shield', box([4.8, 8, 1.7], [11.7, 1.8, 1.3]), 0xaab2b8);
  add(
    'RF shield rim',
    subtract(box([5.2, 8.4, 0.18], [11.5, 1.6, 1.3]), box([4.8, 8, 0.3], [11.7, 1.8, 1.25])),
    0xc1c5c7,
  );
  add('Processor', box([3.5, 3.5, 0.8], [4, 4.5, 1.3]), 0x252932);
  add('Service button base', box([2.2, 2.2, 0.4], [0.5, 5.5, 1.3]), 0xc0c4c4);
  add('Service button', cylinder(0.65, 0.45, [1.6, 6.6, 1.7]), 0x333a44);
  add('Status LED', box([1.2, 0.8, 0.4], [0.6, -7.5, 1.3]), 0xcac16e);
  const pads = Array.from({ length: 8 }, (_, i) => box([1, 0.6, 0.06], [-9 + i * 1.5, -9.8, 1.3]));
  add('Edge service pads', union(...pads), 0xc7a968);
  const passives = Array.from({ length: 5 }, (_, i) =>
    box([0.8, 1.2, 0.4], [0.2, -4 + i * 1.7, 1.3]),
  );
  add('Signal components', union(...passives), 0x938873);
  return out;
}
