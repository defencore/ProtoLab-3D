import type { Parameters, Preset } from '../core/types';

export const jawCouplingReference = '';

/** The repeated 9 × 9 entry in the supplied listing is represented once. */
export const jawCouplingBorePairs: [number, number][] = [
  [5, 5],
  [5, 6],
  [5, 6.35],
  [5, 8],
  [5, 10],
  [5, 11],
  [5, 12],
  [5, 12.7],
  [6, 6],
  [6, 6.35],
  [6, 7],
  [6, 8],
  [6, 9.5],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 12.7],
  [7, 7],
  [7, 8],
  [6.35, 6.35],
  [6.35, 8],
  [6.35, 10],
  [6.35, 12],
  [6.35, 14],
  [8, 8],
  [8, 10],
  [8, 12],
  [8, 14],
  [9, 9],
  [10, 10],
  [10, 12],
  [10, 14],
  [12, 12],
  [12, 12.7],
  [12, 14],
  [14, 14],
  [11, 11],
  [12.7, 12.7],
];

export function jawCouplingPresets(defaults: Parameters): Preset[] {
  return jawCouplingBorePairs.map(([boreA, boreB]) => ({
    id: `hltnc-d25-l30-${boreA}-${boreB}`,
    name: `D25 L30 · ${boreA} × ${boreB} mm`,
    description:
      'HLTNC listing: 25 mm outside diameter, 30 mm length and the selected shaft bores. Jaw, spider and clamp details are editable prototype dimensions.',
    parameters: { ...defaults, outerDiameter: 25, length: 30, boreA, boreB },
    catalog: {
      designation: `D25L30 ${boreA}×${boreB}`,
      manufacturer: 'HLTNC',
      sourceName: 'User-supplied reference',
      sourceKind: 'attachment',
      sourceUrl: jawCouplingReference,
      verifiedParameters: ['outerDiameter', 'length', 'boreA', 'boreB'],
    },
  }));
}
