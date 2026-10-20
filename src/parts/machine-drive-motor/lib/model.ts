import { pieces as stepperPieces } from '../../stepper-motor/lib/model';
import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import { box, cylinder, subtract, union } from '../../../core/assembly/mechanical/shapes';
import { markSupplierUnit } from '../../../core/supplier-components';
import presets from '../presets.json';

function supplier(p: Parameters, pieces: Piece[]): Piece[] {
  const preset = presets.find((item) => item.parameters.model === p.model);
  if (!preset) throw new Error('Select an explicit library motor model.');
  markSupplierUnit(
    pieces.map((piece) => piece.shape),
    {
      name: preset.name,
      libraryId: 'machine-drive-motor',
      parameters: { ...p },
      state: 'default',
      presetId: preset.id,
      procurement: {
        designation: preset.catalog.designation ?? '',
        manufacturer: preset.catalog.manufacturer ?? '',
        source: preset.catalog.sourceUrl,
      },
    },
  );
  return pieces;
}
export function motorPieces(p: Parameters): Piece[] {
  if (p.model === 'jgb3865-520r45-12')
    return supplier(p, [
      {
        label: 'JGB3865 gearbox housing',
        color: 0xa2acb4,
        shape: subtract(
          box([64.4, 12.01, 38], [-12.93, -12.01, -19]),
          cylinder(3.1, 14, [0, -13, 0], 'y'),
        ),
      },
      {
        label: 'JGB3865 motor can',
        color: 0xa2acb4,
        shape: cylinder(17, 35.15, [19.27, -47.16, 0], 'y'),
      },
      {
        label: 'JGB3865 6 mm D output shaft',
        color: 0xa2acb4,
        shape: subtract(
          union(cylinder(3, 13.1, [0, 0, 0], 'y'), cylinder(5.9, 2.5, [0, 0, 0], 'y')),
          box([8, 12, 2], [-4, 3, 2.5]),
        ),
      },
    ]);
  if (p.model === '23hs30-2804-me1k')
    return supplier(
      p,
      stepperPieces({ model: p.model, outputAngle: 0, showLeads: false }, 'assembled'),
    );
  if (p.model !== 'bevi90l2') throw new Error('Select an explicit library motor model.');
  const holes = [-70, 70].flatMap((x) => [56, 181].map((z) => cylinder(5, 14, [x, -91, -z], 'y')));
  return supplier(p, [
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
  ]);
}
