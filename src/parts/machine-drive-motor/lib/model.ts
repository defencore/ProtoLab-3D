import { pieces as stepperPieces } from '../../stepper-motor/lib/model';
import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { box, cylinder, subtract, union } from './shapes';
export function motorPieces(p: Parameters): Piece[] {
  if (p.model === '23hs30-2804-me1k')
    return stepperPieces({ model: p.model, outputAngle: 0, showLeads: false }, 'assembled');
  const holes = [-70, 70].flatMap((x) => [56, 181].map((z) => cylinder(5, 14, [x, -91, -z], 'y')));
  return [
    ...Array.from({ length: 21 }, (_, i) => ({
      label: `BEVI cooling rib ${i + 1} · representative casting`,
      color: 0x28669a,
      shape: {
        kind: 'transform' as const,
        child: box([13, 3, 235], [72, -1.5, -265]),
        translation: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, (i < 17 ? i : i + 3) * 15] as [number, number, number],
      },
    })),
    {
      label: 'BEVI ventilated rear fan cover',
      color: 0x245b88,
      shape: subtract(
        cylinder(87.5, 50, [0, 0, -325]),
        cylinder(84, 47, [0, 0, -322]),
        ...Array.from({ length: 16 }, (_, i) =>
          cylinder(4, 5, [
            65 * Math.cos((i * Math.PI) / 8),
            65 * Math.sin((i * Math.PI) / 8),
            -326,
          ]),
        ),
      ),
    },
    { label: 'BEVI rear bearing shield', color: 0x28669a, shape: cylinder(76, 8, [0, 0, -275]) },
    {
      label: 'BUY BEVI 121116 · 4A3 90L-2 · housing D175 · total L375',
      color: 0x28669a,
      shape: union(
        cylinder(72, 247, [0, 0, -267]),
        subtract(box([180, 12, 160], [-90, -90, -199]), ...holes),
      ),
    },
    {
      label: 'BEVI shaft D24x50 · key8 · axial M8x19 nominal bore',
      color: 0xc2c7cc,
      shape: subtract(
        cylinder(12, 50, [0, 0, 0]),
        cylinder(3.4, 19, [0, 0, 31]),
        box([8, 8, 40], [-4, 8, 5]),
      ),
    },
    {
      label: 'BEVI front end shield · decorative contour',
      color: 0x28669a,
      shape: subtract(cylinder(75, 20, [0, 0, -20]), cylinder(12.1, 22, [0, 0, -21])),
    },
    {
      label: 'BEVI terminal box · overall height HD255',
      color: 0x245b88,
      shape: box([90, 79, 100], [-45, 86, -200]),
    },
    { label: 'BEVI DIN6885 key8 · nominal', color: 0x777f88, shape: box([8, 7, 40], [-4, 8, 5]) },
  ];
}
