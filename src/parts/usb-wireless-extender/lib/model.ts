import type { Piece } from '../../../core/assembly/electronics/assembly';
import { box, cylinder, subtract } from '../../../core/assembly/electronics/shapes';

/** Source local frame: board center in XY, PCB underside Z=0; no scaling. */
export const usbExtenderInterface = {
  dimensions: [24.5, 21.5, 7],
  bounds: { min: [-12.25, -10.75, -1.5], max: [12.25, 10.75, 5.5] },
  mountingAxes: [
    [9.45, -8],
    [9.45, 8],
  ],
  mountingPitch: 16,
  referenceBoreDiameter: 2.7,
  pcbThickness: 1,
  sourceWorldFrame: { translation: [7, -18.493901834347574, 160], rotation: [0, 0, 90] },
  sourceWorldSha256: 'ecaf2755fd28f19a3e56c854ce7feee5f9c690b09ce88fa5138a5c5b7fa86b13',
} as const;

/** Preserve the seven analytic solids in the supplied current FreeCAD project. */
export function usbExtenderPieces(state = 'assembled'): Piece[] {
  const explode = state === 'exploded';
  return [
    {
      label: 'PCB · project reference · 24.5 × 21.5 × 1',
      color: 0x171a1c,
      z: 0,
      shape: subtract(
        box([24.5, 21.5, 1], [-12.25, -10.75, 0]),
        ...usbExtenderInterface.mountingAxes.map(([x, y]) => cylinder(1.35, 1.2, [x, y, -0.1])),
      ),
    },
    {
      label: 'USB connector · source envelope',
      color: 0xccd1d9,
      z: explode ? 8 : 0,
      shape: box([7.2, 8.5, 3.2], [-12.25, -8.45, 1]),
    },
    {
      label: 'Wireless module · source envelope',
      color: 0x292e33,
      z: explode ? 16 : 0,
      shape: box([12, 9, 4.5], [-5, -1, 1]),
    },
    {
      label: 'Controller package · source envelope',
      color: 0x121419,
      z: explode ? 24 : 0,
      shape: box([12, 8, 2], [-5, -10, 1]),
    },
    {
      label: 'Board connector · source envelope',
      color: 0xd6d9de,
      z: explode ? 32 : 0,
      shape: box([1.8, 10, 3], [10.45, -5, 1]),
    },
    {
      label: 'Service button · source envelope',
      color: 0x737373,
      z: explode ? 40 : 0,
      shape: cylinder(1.5, 1, [-7, 6, 1]),
    },
    {
      label: 'Underside SMD · source envelope',
      color: 0x121419,
      z: explode ? -8 : 0,
      shape: box([6, 4, 1.5], [-6, -3, -1.5]),
    },
  ];
}
