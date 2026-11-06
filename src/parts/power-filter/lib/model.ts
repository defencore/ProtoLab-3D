import { box, roundedRect, union } from '../../../core/assembly/electronics/shapes';
import type { Piece } from '../../../core/assembly/electronics/assembly';
export function pieces(): Piece[] {
  return [
    {
      shape: union(roundedRect(16, 6, 0.35, 0, 1), box([10, 4, 2], [-5, -2, 1])),
      label: 'iFlight LC Filter \u00b7 16 \u00d7 6 seller version \u00b7 reference',
      color: 0x2d4685,
    },
  ];
}
