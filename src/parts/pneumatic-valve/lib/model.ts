import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import {
  box,
  cylinder,
  subtract,
  union,
  prism,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { markSupplierUnit } from '../../../core/supplier-components';
import models from './models.json';
/** Preserves the inherited installation study; dimensions are not supplier-certified. */
export function pieces(p: Parameters): Piece[] {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Select the supported fixed valve execution.');
  if (model.id === '2vd0102-g1-4') {
    // Photo-based illustration only. All unverified dimensions are disclosed per preset.
    const hex = Array.from({ length: 6 }, (_, i): [number, number] => [
      (18 / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3),
      (18 / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3),
    ]);
    return [
      {
        label: '2VD0102 external reference · dimensions unverified',
        color: 0xb4bec8,
        shape: subtract(
          union(
            cylinder(6.5, 4, [0, 0, 0]),
            cylinder(7.5, 2, [0, 0, 4]),
            cylinder(6, 14, [0, 0, 6]),
            cylinder(8, 2, [0, 0, 20]),
            prism(hex, 5, 22, 'z'),
            cylinder(8, 2, [0, 0, 27]),
            cylinder(5.5, 1, [0, 0, 29]),
          ),
          cylinder(2.2, 14, [-7, 0, 12], 'x'),
          cylinder(2.2, 14, [0, -7, 12], 'y'),
          box([1.1, 12, 1.5], [-0.55, -6, 29]),
        ),
      },
    ];
  }
  const out: Piece[] = [
    {
      label: 'Valve spool body · unresolved installation envelope',
      color: 0xb4bec8,
      shape: subtract(
        box([22, 85, 32], [0, 35, 0]),
        ...[51, 75, 99].map(
          (y) =>
            ({
              kind: 'cylinder',
              radius: 6.4,
              height: 10,
              origin: [11, y, 23],
              axis: 'z',
              thread: {
                pitch: 1.337,
                internal: true,
                designation: 'Rc1/4 nominal envelope; taper unverified',
              },
            }) as Shape,
        ),
      ),
    },
    {
      label: 'DC24V coil · installation envelope',
      color: 0x303c46,
      shape: box([22, 35, 36], [0, 0, 0]),
    },
    {
      label: 'Coil connector · installation envelope',
      color: 0x3179bc,
      shape: box([20, 25, 22], [1, 5, 36]),
    },
    {
      label: 'Manual override · installation reference',
      color: 0xdc7a42,
      shape: cylinder(3, 3, [22, 45, 14], 'x'),
    },
  ];
  markSupplierUnit(
    out.map((piece) => piece.shape),
    {
      name: model.name,
      libraryId: 'pneumatic-valve',
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
