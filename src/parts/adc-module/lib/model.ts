import { box, roundedRect, union } from '../../../core/assembly/electronics/shapes';
import type { Piece } from '../../../core/assembly/electronics/assembly';
export function pieces(): Piece[] {
  return [
    {
      shape: union(roundedRect(22, 21, 0.6, 0, 1.6), box([5, 5, 1.2], [-2.5, -2.5, 1.6])),
      label: 'CJMCU-1220 ADS1220 \u00b7 installation reference',
      color: 0x713d91,
    },
  ];
}
