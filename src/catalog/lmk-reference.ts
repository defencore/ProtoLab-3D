import type { Parameters } from '../core/types';

export const lmkReferenceUrl =
  'https://www.hepcomotion.com/wp-content/uploads/2015/10/UK-Ball-Bushings-Catalogue-2.2-2023.pdf';
/** Pages 12–15: mounting envelopes for LMK and LMKL; supplier d/D/L must still be checked. */
export const lmkReference: Record<number, Parameters> = Object.fromEntries(
  [
    [6, 12, 28, 5, 20, 22, 3.4, 6.5, 3.3, 4],
    [8, 15, 32, 5, 24, 25, 3.4, 6.5, 3.3, 4],
    [10, 19, 40, 6, 29, 30, 4.5, 8, 4.4, 4],
    [12, 21, 42, 6, 32, 32, 4.5, 8, 4.4, 4],
    [13, 23, 43, 6, 33, 34, 4.5, 8, 4.4, 4],
    [16, 28, 48, 6, 38, 37, 4.5, 8, 4.4, 5],
    [20, 32, 54, 8, 43, 42, 5.5, 9.5, 5.4, 5],
    [25, 40, 62, 8, 51, 50, 5.5, 9.5, 5.4, 6],
    [30, 45, 74, 10, 60, 58, 6.6, 11, 6.5, 6],
    [35, 52, 82, 10, 67, 64, 6.6, 11, 6.5, 6],
    [40, 60, 96, 13, 78, 75, 9, 14, 8.6, 6],
    [50, 80, 116, 13, 98, 92, 9, 14, 8.6, 6],
    [60, 90, 134, 18, 112, 106, 11, 17.5, 10.8, 6],
  ].map(
    ([
      bore,
      outer,
      flangeDiameter,
      flangeThickness,
      boltCircle,
      flangeWidth,
      holeDiameter,
      counterbore,
      counterDepth,
      circuits,
    ]) => [
      bore,
      {
        bore,
        outer,
        flangeDiameter,
        flangeThickness,
        boltCircle,
        flangeWidth,
        holeDiameter,
        counterbore,
        counterDepth,
        circuits,
      },
    ],
  ),
);
