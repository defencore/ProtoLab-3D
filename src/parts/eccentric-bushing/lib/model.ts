import type { Parameters } from '../../../core/types';
import { union, subtract } from './shapes';
import { C, hex } from './helpers';
import type { Piece } from './assembly';
export function pieces(p: Parameters): Piece[] {
  return [
    {
      label: 'Eccentric hex-head bushing',
      color: 0xb5bbc2,
      angle: +p.angle,
      shape: subtract(
        union(hex(+p.acrossFlats, +p.head), C(+p.seat, +p.length, +p.head)),
        C(+p.bore, +p.head + +p.length + 2, -1, +p.eccentricity),
      ),
    },
  ];
}
