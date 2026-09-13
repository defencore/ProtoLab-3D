import type { Parameters } from '../core/types';
import type { BallScrewReference } from './ball-screw-reference';

type ReferenceRow = (
  family: string,
  code: string,
  values: number[],
  source: string,
  sourceName: string,
  extra?: Parameters,
  note?: string,
) => BallScrewReference;

export const sfhBallScrewSource =
  'https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_GeneralProduct_23.07%28CH%29.pdf#page=198';
export const sfyBallScrewSource =
  'https://www.wangong.net/product/ball-screw/big-lead-sfy-series-ball-screw.html';
export const sfyBallScrewDrawingSource =
  'https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_GeneralProduct_23.07%28CH%29.pdf#page=208';

/**
 * TBI 23.07, printed C44 / PDF page 198, all 30 SFH rows.
 * The SFH table ends at nominal size 50; larger SFU/SFV rows are separate families.
 * The 22.05 English catalog URL returned 404 during source verification.
 * Values follow the shared row order; E and circuit turns are separate columns.
 */
const sfhRows: [string, number[], number, number][] = [
  ['01205-2.8', [12, 5, 2.5, 24, 40, 10, 30, 32, 30, 4.5, 0, 1, 661, 1316, 19], 5, 2.8],
  ['01210-2.8', [12, 10, 2.5, 24, 40, 10, 45, 32, 30, 4.5, 0, 1, 642, 1287, 19], 5, 2.8],
  ['01605-3.8', [15, 5, 2.778, 28, 48, 10, 37, 38, 40, 5.5, 6, 1, 1112, 2507, 30], 5, 3.8],
  ['01610-2.8', [15, 10, 2.778, 28, 48, 10, 45, 38, 40, 5.5, 6, 1, 839, 1821, 23], 5, 2.8],
  ['01616-1.8', [15, 16, 2.778, 28, 48, 10, 45, 38, 40, 5.5, 6, 1, 552, 1137, 14], 5, 1.8],
  ['01616-2.8', [15, 16, 2.778, 28, 48, 10, 61, 38, 40, 5.5, 6, 1, 808, 1769, 22], 5, 2.8],
  ['01620-1.8', [15, 20, 2.778, 28, 48, 10, 58, 38, 40, 5.5, 6, 1, 554, 1170, 14], 7, 1.8],
  ['02005-3.8', [20, 5, 3.175, 36, 58, 10, 37, 47, 44, 6.6, 6, 1, 1484, 3681, 37], 7, 3.8],
  ['02010-3.8', [20, 10, 3.175, 36, 58, 10, 55, 47, 44, 6.6, 6, 1, 1516, 3833, 40], 7, 3.8],
  ['02020-1.8', [20, 20, 3.175, 36, 58, 10, 54, 47, 44, 6.6, 6, 1, 764, 1758, 19], 7, 1.8],
  ['02020-2.8', [20, 20, 3.175, 36, 58, 10, 74, 47, 44, 6.6, 6, 1, 1118, 2734, 29], 7, 2.8],
  ['02505-3.8', [25, 5, 3.175, 40, 62, 10, 37, 51, 48, 6.6, 6, 1, 1650, 4658, 43], 7, 3.8],
  ['02510-3.8', [25, 10, 3.175, 40, 62, 12, 55, 51, 48, 6.6, 6, 1, 1638, 4633, 45], 7, 3.8],
  ['02525-1.8', [25, 25, 3.175, 40, 62, 12, 64, 51, 48, 6.6, 6, 1, 843, 2199, 22], 7, 1.8],
  ['02525-2.8', [25, 25, 3.175, 40, 62, 12, 89, 51, 48, 6.6, 6, 1, 1232, 3421, 34], 7, 2.8],
  ['03205-3.8', [32, 5, 3.175, 50, 80, 12, 37, 65, 62, 9, 6, 1, 1839, 6026, 51], 9, 3.8],
  ['03210-3.8', [31, 10, 3.969, 50, 80, 12, 57, 65, 62, 9, 6, 1, 2460, 7255, 55], 9, 3.8],
  ['03220-2.8', [31, 20, 3.969, 50, 80, 12, 76, 65, 62, 9, 6, 1, 1907, 5482, 43], 9, 2.8],
  ['03232-1.8', [31, 32, 3.969, 50, 80, 12, 80, 65, 62, 9, 6, 1, 1257, 3426, 27], 9, 1.8],
  ['03232-2.8', [31, 32, 3.969, 50, 80, 12, 112, 65, 62, 9, 6, 1, 1838, 5329, 42], 9, 2.8],
  ['04005-3.8', [40, 5, 3.175, 63, 93, 15, 42, 78, 70, 9, 8, 1, 2018, 7589, 60], 9, 3.8],
  ['04010-3.8', [38, 10, 6.35, 63, 93, 14, 60, 78, 70, 9, 8, 1, 5035, 13943, 67], 9, 3.8],
  ['04020-2.8', [38, 20, 6.35, 63, 93, 14, 80, 78, 70, 9, 8, 1, 3959, 10715, 54], 9, 2.8],
  ['04040-1.8', [38, 40, 6.35, 63, 93, 14, 98, 78, 70, 9, 8, 1, 2585, 6648, 34], 9, 1.8],
  ['04040-2.8', [38, 40, 6.35, 63, 93, 14, 138, 78, 70, 9, 8, 1, 3780, 10341, 52], 9, 2.8],
  ['05005-3.8', [50, 5, 3.175, 75, 110, 15, 42, 93, 85, 11, 8, 1, 2207, 9542, 68], 10.5, 3.8],
  ['05010-3.8', [48, 10, 6.35, 75, 110, 18, 60, 93, 85, 11, 8, 1, 5638, 17852, 79], 10.5, 3.8],
  ['05020-3.8', [48, 20, 6.35, 75, 110, 18, 100, 93, 85, 11, 8, 1, 5749, 18485, 87], 10.5, 3.8],
  ['05050-1.8', [48, 50, 6.35, 75, 110, 18, 120, 93, 85, 11, 8, 1, 2946, 8749, 42], 10.5, 1.8],
  ['05050-2.8', [48, 50, 6.35, 75, 110, 18, 170, 93, 85, 11, 8, 1, 4308, 13610, 65], 10.5, 2.8],
];

/** Wangong's six large-lead rows; its separate twin-lead table is not substituted. */
const sfyRows: [string, number[], number][] = [
  ['1616-3.6', [16, 16, 2.778, 32, 53, 10, 45, 42, 34, 4.5, 6, 2, 1073, 2551, 31], 10.1],
  ['2020-3.6', [20, 20, 3.175, 39, 62, 10, 52, 50, 41, 5.5, 6, 2, 1387, 3515, 37], 13],
  ['2525-3.6', [25, 25, 3.969, 47, 74, 12, 64, 60, 49, 6.6, 6, 2, 2074, 5494, 45], 15],
  ['3232-3.6', [32, 32, 4.762, 58, 92, 12, 78, 74, 60, 9, 6, 2, 3021, 8690, 58], 17],
  ['4040-3.6', [40, 40, 6.35, 73, 114, 15, 99, 93, 75, 11, 6, 2, 4831, 14062, 70], 19.5],
  ['5050-3.6', [50, 50, 7.938, 90, 135, 20, 117, 112, 92, 14, 6, 2, 7220, 21974, 86], 21.5],
];

/** Inject the shared row factory to keep catalog initialization free of runtime cycles. */
export function getEndReturnReferences(row: ReferenceRow): BallScrewReference[] {
  const sfh = sfhRows.map(([code, values, flangeOffset, circuitTurns]) => {
    const nominalSize = Number(code.slice(0, 3));
    return row(
      'SFH',
      code,
      values,
      sfhBallScrewSource,
      'TBI MOTION',
      {
        flangeOffset,
        circuitTurns,
        mountHoleCount: nominalSize >= 40 ? '8' : '6',
      },
      'TBI 23.07, C44: the published shaft d is retained, including 15, 31, 38 and 48 mm variants. Flange offset E and circuit turns are distinct dimensions. The nut circuit suffix does not establish shaft starts.',
    );
  });
  const sfy = sfyRows.map(([code, values, flangeOffset]) => {
    const reference = row(
      'SFY',
      code,
      values,
      sfyBallScrewSource,
      'Wangong',
      {
        flangeOffset,
        circuitTurns: 1.8,
        mountHoleCount: '4',
      },
      'Wangong large-lead table: two 1.8-turn circuits and an inset flange. The four-hole 60° mounting pattern is cross-referenced to the corresponding TBI drawing; supplier interchangeability is unverified. Shaft starts remain an editable prototype setting.',
    );
    reference.catalog!.alternateSourceUrls = [sfyBallScrewDrawingSource];
    return reference;
  });
  return [...sfh, ...sfy];
}
