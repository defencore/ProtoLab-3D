import { roundedRect } from '../../../core/assembly/electronics/shapes';
import type { Piece } from '../../../core/assembly/electronics/assembly';
export function pieces(): Piece[] {
  return [
    {
      shape: roundedRect(88, 24, 1.5, 0, 74),
      label: 'SYLA Lishen LR2170LA \u00b7 4S1P \u00b7 XT60',
      color: 0x2e527a,
    },
  ];
}
