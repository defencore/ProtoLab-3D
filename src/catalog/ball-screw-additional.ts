import type { ballScrewReferenceRow } from './ball-screw-reference';

type RowFactory = typeof ballScrewReferenceRow;

/** Manufacturer-specific SFE variants retain their published suffixes and lengths. */
export function getSfeReferences(row: RowFactory) {
  // Code, d, lead, Da, D, A, E, B, L, X, W, H, turns, circuits, Ca, Coa, K.
  const values: [string, ...number[]][] = [
    ['1616-4', 16, 16, 2.778, 32, 53, 10.1, 10, 38, 4.5, 42, 34, 1.7, 2, 650, 1280, 19],
    ['1616-6', 16, 16, 2.778, 32, 53, 10.1, 10, 38, 4.5, 42, 34, 1.7, 4, 1180, 2550, 36],
    ['1632-3', 16, 32, 3.175, 34, 55, 10.5, 10, 34, 5.5, 45, 36, 0.7, 2, 410, 680, 21],
    ['1632-6', 16, 32, 3.175, 34, 55, 10.5, 10, 34, 5.5, 45, 36, 0.7, 4, 820, 1360, 41],
    ['2020-4', 20, 20, 3.175, 39, 62, 11.5, 10, 55, 5.5, 50, 41, 1.7, 2, 980, 2140, 25],
    ['2020-6', 20, 20, 3.175, 39, 62, 11.5, 10, 47, 5.5, 50, 41, 1.7, 4, 1780, 4280, 49],
    ['2040-3', 20, 40, 3.175, 38, 58, 11, 10, 41, 5.5, 48, 40, 0.7, 2, 455, 880, 25],
    ['2040-6', 20, 40, 3.175, 38, 58, 11, 10, 41, 5.5, 48, 40, 0.7, 4, 910, 1760, 49],
    ['2525-3', 25, 25, 3.969, 47, 74, 13, 10, 57, 6.6, 60, 49, 1.7, 2, 1470, 3350, 31],
    ['2525-6', 25, 25, 3.969, 47, 74, 13, 12, 57, 6.6, 60, 49, 1.7, 4, 2660, 6690, 60],
    ['2550-3', 25, 50, 3.969, 46, 70, 13, 12, 50, 6.6, 58, 48, 0.7, 2, 685, 1380, 31],
    ['2550-6', 25, 50, 3.969, 46, 70, 13, 12, 50, 6.6, 58, 48, 0.7, 4, 1370, 2760, 60],
    ['3232-4', 32, 32, 4.762, 58, 92, 16, 12, 82, 9, 74, 60, 1.7, 2, 2140, 5260, 40],
    ['3232-6', 32, 32, 4.762, 58, 92, 16, 12, 71, 9, 74, 60, 1.7, 4, 3890, 10500, 76],
    ['3264-3', 32, 64, 4.762, 58, 92, 16, 12, 62, 9, 74, 60, 0.7, 2, 1000, 2130, 40],
    ['3264-6', 32, 64, 4.762, 58, 92, 15.5, 12, 62, 9, 74, 60, 0.7, 4, 2000, 4260, 77],
    ['4040-4', 40, 40, 6.35, 73, 114, 19, 15, 100, 11, 93, 75, 1.7, 2, 3410, 8820, 49],
    ['4040-6', 40, 40, 6.35, 73, 114, 19, 15, 89, 11, 93, 75, 1.7, 4, 6200, 17600, 95],
    ['5050-4', 50, 50, 7.938, 90, 135, 21.5, 20, 117, 14, 112, 92, 1.7, 2, 5100, 13800, 60],
    ['5050-6', 50, 50, 7.938, 90, 135, 21.5, 20, 107, 14, 112, 92, 1.7, 4, 7260, 27600, 117],
  ];
  return values.map(([code, d, lead, da, D, A, E, B, L, X, W, H, turns, circuits, Ca, Coa, K]) => {
    const reference = row(
      'SFE',
      code,
      [d, lead, da, D, A, B, L, W, H, X, 6, circuits, Ca, Coa, K],
      'https://www.deliyalinearmotion.com/ball-nut/sfe-nuts.html',
      'DLY',
      { flangeOffset: E, circuitTurns: turns, mountHoleCount: '4', starts: 2 },
      'DLY nut-table variant, including its published suffix and L dimension. Other suppliers may use different lengths for the same base code. Helix start count is an editable prototype setting.',
    );
    reference.catalog!.verifiedParameters = reference.catalog!.verifiedParameters.filter(
      (key) => key !== 'starts',
    );
    reference.catalog!.alternateSourceUrls = ['references/ball-nut-options.png'];
    return reference;
  });
}

export function getInternalReturnReferences(row: RowFactory, source: string) {
  // Code, d, lead, Da, D, A, B, L, W, flat-flange H, X, counterbore Y/Z, Q, Ca, Coa.
  const singles: [string, ...number[]][] = [
    ['1605-4', 16, 5, 3.175, 30, 49, 10, 50, 39, 34, 4.5, 8, 4.5, 6, 1127, 2288],
    ['1610-3', 16, 10, 3.175, 34, 58, 10, 57, 45, 34, 5.5, 9.5, 5.5, 6, 909, 1848],
    ['2005-4', 20, 5, 3.175, 34, 57, 11, 51, 45, 40, 5.5, 9.5, 5.5, 6, 1268, 2991],
    ['2505-4', 25, 5, 3.175, 40, 63, 11, 51, 51, 46, 5.5, 9.5, 5.5, 8, 1420, 3872],
    ['2510-4', 25, 10, 4.762, 46, 72, 12, 85, 58, 52, 6.5, 11, 6.5, 8, 2415, 5543],
    ['3205-4', 32, 5, 3.175, 46, 72, 12, 52, 58, 52, 6.5, 11, 6.5, 8, 1604, 5103],
    ['3210-4', 32, 10, 6.35, 54, 88, 15, 90, 70, 62, 9, 14, 8.5, 8, 3924, 9152],
    ['4005-4', 40, 5, 3.175, 56, 90, 15, 55, 72, 64, 9, 14, 8.5, 8, 1786, 6512],
    ['4010-4', 40, 10, 6.35, 62, 104, 18, 93, 82, 70, 11, 17.5, 11, 8, 4417, 11669],
    ['5010-4', 50, 10, 6.35, 72, 114, 18, 93, 92, 82, 11, 17.5, 11, 8, 4947, 15488],
    ['6310-4', 63, 10, 6.35, 85, 131, 22, 98, 107, 95, 14, 20, 13, 8, 5586, 20417],
    ['8010-4', 80, 10, 6.35, 105, 150, 22, 98, 127, 115, 14, 20, 13, 8, 6219, 26049],
  ];
  const doubleLengths: Record<string, number> = {
    '2005-4': 101,
    '2505-4': 101,
    '2510-4': 145,
    '3205-4': 102,
    '3210-4': 162,
    '4005-4': 105,
    '4010-4': 165,
    '5010-4': 171,
    '6310-4': 182,
    '8010-4': 182,
  };
  return singles.flatMap(([code, d, lead, da, D, A, B, L, W, H, X, Y, Z, Q, Ca, Coa]) => {
    const build = (family: string, length: number, port: number) => {
      const reference = row(
        family,
        code,
        [d, lead, da, D, A, B, length, W, A, X, port, code.endsWith('-3') ? 3 : 4, Ca, Coa, 0],
        source + '#page=13',
        'LIMON',
        {
          mountHoleCount: '6',
          circuitTurns: 1,
          mountCounterboreDiameter: Y,
          mountCounterboreDepth: Z,
        },
        'Circular six-hole flange from the manufacturer drawing. Internal return routing is representative; the optional four-hole flange with flats is not selected.',
      );
      reference.catalog!.specifications!.push({
        label: 'Alternative flange width H · not selected',
        value: `${H} mm`,
      });
      return reference;
    };
    const result = [build('SFI', L, Q)];
    if (doubleLengths[code]) result.push(build('DFI', doubleLengths[code], d === 25 ? 6 : Q));
    return result;
  });
}
