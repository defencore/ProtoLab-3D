import type { Parameters } from '../../../core/types';
import { cylinder, subtract } from './shapes';
import type { Piece } from './assembly';
export function rollerSpec(p: Parameters) {
  const length = Number(p.installationLength);
  return {
    length,
    referenceLength: length - 10,
    tubeLength: length - 36,
    diameter: 50,
    shaft: 12,
    wall: 1.5,
  };
}
export function rollerPieces(p: Parameters): Piece[] {
  const s = rollerSpec(p),
    h = s.tubeLength / 2,
    cap = (s.length - s.tubeLength) / 2 - 0.5;
  if (p.model === 'ec5000')
    return [
      {
        label: 'BUY ASSEMBLY Interroll EC5000 crowned · D50 · 24 V 35 W · envelope',
        color: 0xa8afb6,
        shape: cylinder(25, s.tubeLength, [0, 0, -h]),
      },
      {
        label: 'EC5000 stationary shaft · cable-side interface requires ordered drawing',
        color: 0x343e47,
        shape: subtract(
          cylinder(6, s.length, [0, 0, -s.length / 2]),
          cylinder(6.1, s.tubeLength + 2, [0, 0, -h - 1]),
        ),
      },
    ];
  return [
    {
      label: `BUY ASSEMBLY Interroll 1700 · steel D50x1.5 · EL${s.length} RL${s.referenceLength} · tube`,
      color: 0xa8afb6,
      shape: subtract(
        cylinder(25, s.tubeLength, [0, 0, -h]),
        cylinder(23.5, s.tubeLength + 2, [0, 0, -h - 1]),
      ),
    },
    {
      label: 'Interroll 1700 · D12 stationary shaft · end threads M8x15, nominal bores',
      color: 0x69737c,
      shape: subtract(
        cylinder(6, s.length, [0, 0, -s.length / 2]),
        cylinder(3.4, 15, [0, 0, -s.length / 2]),
        cylinder(3.4, 15, [0, 0, s.length / 2 - 15]),
      ),
    },
    ...[-1, 1].map((sign) => ({
      label: `Interroll 1700 · purchased bearing housing ${sign < 0 ? 'left' : 'right'}`,
      color: 0x303a42,
      shape: subtract(
        cylinder(25, cap, [0, 0, sign < 0 ? -s.length / 2 + 0.5 : h]),
        cylinder(6.1, cap + 2, [0, 0, (sign < 0 ? -s.length / 2 + 0.5 : h) - 1]),
      ),
    })),
  ];
}
