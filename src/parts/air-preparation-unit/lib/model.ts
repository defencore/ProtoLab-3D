import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import { box, cylinder } from '../../../core/assembly/boundary/shapes';
import { markSupplierUnit } from '../../../core/supplier-components';
import models from './models.json';
/** Preserves the two inherited regulator layouts without inventing source mounting details. */
export function pieces(p: Parameters): Piece[] {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Select a supported fixed air-preparation execution.');
  const out: Piece[] =
    model.id === 'ar2000-g1-4'
      ? [
          {
            label: 'AR2000 body · installation envelope',
            color: 0x3179bc,
            shape: box([45, 45, 55], [0, 0, 0]),
          },
          {
            label: 'AR2000 pressure gauge · installation envelope',
            color: 0x303c46,
            shape: cylinder(20, 14, [23, 45, 55], 'y'),
          },
        ]
      : [
          {
            label: 'AFR2000 filter bowl · installation envelope',
            color: 0xb4bec8,
            shape: cylinder(22, 100, [0, 0, 0]),
          },
          {
            label: 'AFR2000 regulator body · installation envelope',
            color: 0x3179bc,
            shape: box([60, 50, 50], [-30, -15, 100]),
          },
          {
            label: 'AFR2000 gauge · inclusion and geometry unverified',
            color: 0x303c46,
            shape: cylinder(20, 14, [0, 35, 115], 'y'),
          },
        ];
  markSupplierUnit(
    out.map((piece) => piece.shape),
    {
      name: model.name,
      libraryId: 'air-preparation-unit',
      presetId: model.id,
      parameters: { model: model.id },
      state: 'assembled',
      procurement: {
        designation: model.designation,
        manufacturer: 'Unspecified',
        source: model.source,
      },
    },
  );
  return out;
}
