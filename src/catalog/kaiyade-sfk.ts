import type { ballScrewReferenceRow } from './ball-screw-reference';

/** Transcription of the user's KAIYADE SFK dimension table, printed page 17. */
export function getKaiyadeSfkReferences(row: typeof ballScrewReferenceRow) {
  // code, d, lead, Da, D, A, B, L, W, H, X, Q, n, Ca, Coa, K.
  const rows: [string, number[]][] = [
    ['0401', [4, 1, 0.8, 10, 20, 3, 12, 15, 14, 2.9, 0, 2, 40, 51, 2.8]],
    ['0601', [6, 1, 0.8, 12, 24, 3.5, 15, 18, 16, 3.4, 0, 3, 73, 121, 6.8]],
    ['0801', [8, 1, 0.8, 14, 27, 4, 16, 21, 18, 3.4, 0, 4, 93, 173, 10.7]],
    ['0802', [8, 2, 1.2, 14, 27, 4, 16, 21, 18, 3.4, 0, 3, 135, 225, 8.2]],
    ['0825', [8, 2.5, 1.2, 16, 29, 4, 26, 23, 20, 3.4, 0, 3, 177, 278, 8.2]],
    ['1002', [10, 2, 1.2, 18, 35, 5, 28, 27, 22, 4.5, 0, 3, 185, 305, 10.1]],
    ['1004', [10, 4, 2, 26, 46, 10, 34, 36, 28, 4.5, 0, 3, 395, 590, 10.4]],
    ['1202', [12, 2, 1.2, 20, 37, 5, 28, 29, 24, 4.5, 0, 4, 173, 317, 16.1]],
    ['1204', [12, 4, 2.5, 24, 40, 6, 28, 32, 25, 3.5, 0, 3, 454, 722, 12.5]],
    ['1205', [12, 5, 2.5, 22, 37, 8, 39, 29, 24, 4.5, 0, 3, 619, 883, 12.5]],
    ['1402', [14, 2, 1.2, 21, 40, 6, 23, 31, 26, 5.5, 0, 4, 287, 633, 18.6]],
    ['1602', [16, 2, 1.2, 25, 43, 10, 40, 35, 29, 5.5, 0, 4, 253, 670, 21.2]],
    ['2002', [20, 2, 1.2, 50, 80, 15, 55, 65, 68, 6.5, 6, 6, 397, 1269, 39.6]],
    ['2502', [25, 2, 1.2, 50, 80, 13, 43, 65, 68, 6.5, 6, 5, 375, 1331, 41.1]],
    ['2503', [25, 3, 2.381, 40, 63, 11, 51, 51, 48, 5.5, 6, 6, 1100, 3076, 50.1]],
  ];
  return rows.map(([code, dimensions]) => {
    const counterbore = ['2002', '2502', '2503'].includes(code)
      ? {
          mountCounterboreDiameter: code === '2503' ? 9.5 : 10.5,
          mountCounterboreDepth: code === '2503' ? 5.5 : 6,
        }
      : { mountCounterboreDiameter: 0, mountCounterboreDepth: 0 };
    const reference = row(
      'SFK',
      code,
      dimensions,
      'references/kaiyade-sfk/dimension-table.png',
      'KAIYADE · supplied SFK table, p17',
      counterbore,
      'KAIYADE nut reference from the supplied table. Shaft lengths are supplied listing options; the listing product and this manufacturer reference have not been checked for interchangeability.',
    );
    reference.id = `kaiyade-sfk${code}`;
    reference.catalog!.sourceKind = 'attachment';
    reference.catalog!.manufacturer = 'KAIYADE';
    reference.catalog!.specifications!.push(
      {
        label: 'Seals',
        value:
          Number(dimensions[0]) <= 6
            ? 'No seals, per table note 1'
            : 'Standard nut has no seals, per table note 2',
      },
      { label: 'Flange mounting', value: 'Four holes, 30° from vertical' },
    );
    return reference;
  });
}
