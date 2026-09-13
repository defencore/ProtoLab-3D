import type { Parameters } from '../core/types';

interface DrawingTable {
  url: string;
  rows: Record<number, Parameters>;
}
function table(file: string, keys: string[], rows: number[][]): DrawingTable {
  return {
    url: `https://gvyntok.com/wp-content/uploads/2024/06/${file}.pdf`,
    rows: Object.fromEntries(
      rows.map(([diameter, ...values]) => [
        diameter,
        Object.fromEntries(keys.map((key, index) => [key, values[index]])),
      ]),
    ),
  };
}

/** Values transcribed from linked supplier drawings. Head envelopes use nominal or maximum dimensions. */
export const fastenerDrawings: Record<string, DrawingTable> = {
  'DIN 933': table(
    '030-010-001',
    ['pitch', 'headHeight', 'headSize'],
    [
      [3, 0.5, 2, 5.5],
      [4, 0.7, 2.8, 7],
      [5, 0.8, 3.5, 8],
      [6, 1, 4, 10],
      [7, 1, 4.8, 11],
      [8, 1.25, 5.3, 13],
      [10, 1.5, 6.4, 17],
      [12, 1.75, 7.5, 19],
      [14, 2, 8.8, 22],
      [16, 2, 10, 24],
      [18, 2.5, 11.5, 27],
      [20, 2.5, 12.5, 30],
      [22, 2.5, 14, 32],
      [24, 3, 15, 36],
      [27, 3, 17, 41],
      [30, 3.5, 18.7, 46],
      [33, 3.5, 21, 50],
      [36, 4, 22.5, 55],
      [39, 4, 25, 60],
      [42, 4.5, 26, 65],
    ],
  ),
  'DIN 912': table(
    '040-190-001',
    ['pitch', 'headSize', 'headHeight', 'driveWidth'],
    [
      [1.4, 0.3, 2.6, 1.4, 1.3],
      [1.6, 0.35, 3, 1.6, 1.5],
      [2, 0.4, 3.8, 2, 1.5],
      [2.5, 0.45, 4.5, 2.5, 2],
      [3, 0.5, 5.5, 3, 2.5],
      [4, 0.7, 7, 4, 3],
      [5, 0.8, 8.5, 5, 4],
      [6, 1, 10, 6, 5],
      [8, 1.25, 13, 8, 6],
      [10, 1.5, 16, 10, 8],
      [12, 1.75, 18, 12, 10],
      [14, 2, 21, 14, 12],
      [16, 2, 24, 16, 14],
      [18, 2.5, 27, 18, 14],
      [20, 2.5, 30, 20, 17],
      [22, 2.5, 33, 22, 17],
      [24, 3, 36, 24, 19],
      [27, 3, 40, 27, 19],
      [30, 3.5, 45, 30, 22],
      [33, 3.5, 50, 33, 24],
      [36, 4, 54, 36, 27],
      [42, 4.5, 63, 42, 32],
      [48, 5, 72, 48, 36],
      [56, 5.5, 84, 56, 41],
    ],
  ),
  'DIN 7991': table(
    '040-070-001',
    ['pitch', 'headSize', 'headHeight', 'driveWidth', 'countersinkAngle'],
    [
      [3, 0.5, 6, 1.7, 2, 90],
      [4, 0.7, 8, 2.3, 2.5, 90],
      [5, 0.8, 10, 2.8, 3, 90],
      [6, 1, 12, 3.3, 4, 90],
      [8, 1.25, 16, 4.4, 5, 90],
      [10, 1.5, 20, 5.5, 6, 90],
      [12, 1.75, 24, 6.5, 8, 90],
      [14, 2, 27, 7, 10, 90],
      [16, 2, 30, 7.5, 10, 90],
      [18, 2.5, 33, 8, 12, 90],
      [20, 2.5, 36, 8.5, 12, 90],
      [22, 2.5, 36, 13.1, 14, 60],
      [24, 3, 39, 14, 14, 60],
    ],
  ),
  'DIN 965': table(
    '040-030-001',
    ['pitch', 'headSize', 'headHeight'],
    [
      [1.6, 0.35, 3, 0.96],
      [2, 0.4, 3.8, 1.2],
      [2.5, 0.45, 4.7, 1.5],
      [3, 0.5, 5.6, 1.65],
      [3.5, 0.6, 6.5, 1.93],
      [4, 0.7, 7.5, 2.2],
      [5, 0.8, 9.2, 2.5],
      [6, 1, 11, 3],
      [8, 1.25, 14.5, 4],
      [10, 1.5, 18, 5],
    ],
  ),
  'DIN 7985': table(
    '040-100-001',
    ['pitch', 'headSize', 'headHeight'],
    [
      [1.6, 0.35, 3.2, 1.42],
      [2, 0.4, 4, 1.72],
      [2.5, 0.45, 5, 2.12],
      [3, 0.5, 6, 2.52],
      [3.5, 0.6, 7, 2.82],
      [4, 0.7, 8, 3.25],
      [5, 0.8, 10, 3.95],
      [6, 1, 12, 4.75],
      [8, 1.25, 16, 6.15],
      [10, 1.5, 20, 7.68],
    ],
  ),
  'ISO 7380-1': table(
    '040-140-001',
    ['pitch', 'headSize', 'headHeight', 'driveWidth'],
    [
      [3, 0.5, 5.7, 1.65, 2],
      [4, 0.7, 7.6, 2.2, 2.5],
      [5, 0.8, 9.5, 2.75, 3],
      [6, 1, 10.5, 3.3, 4],
      [8, 1.25, 14, 4.4, 5],
      [10, 1.5, 17.5, 5.5, 6],
      [12, 1.75, 21, 6.6, 8],
      [16, 2, 28, 8.8, 10],
    ],
  ),
  'DIN 967': table(
    '040-010-001',
    ['pitch', 'flangeDiameter', 'headHeight', 'flangeThickness'],
    [
      [3, 0.5, 7.5, 2.35, 0.8],
      [3.5, 0.6, 9, 2.6, 0.9],
      [4, 0.7, 10, 3.05, 1.1],
      [5, 0.8, 11.5, 3.55, 1.35],
      [6, 1, 14.5, 4.55, 1.8],
      [8, 1.25, 19, 5.9, 2.2],
    ],
  ),
  'DIN 7420': table(
    '040-011-001',
    ['headSize', 'headHeight', 'driveWidth'],
    [
      [6, 14.5, 2.2, 4],
      [8, 16, 4, 5],
    ],
  ),
  'DIN 608': table(
    '030-340-001',
    ['pitch', 'headSize', 'neckSize'],
    [
      [10, 1.5, 19.65, 10.58],
      [12, 1.75, 24.65, 12.7],
      [16, 2, 28.65, 16.55],
      [20, 2.5, 35.8, 20.65],
    ],
  ),
  'DIN 15237': table(
    '030-361-001',
    ['headSize'],
    [
      [6, 20],
      [8, 28],
      [10, 35],
      [12, 42],
    ],
  ),
  'DIN 913': table(
    '040-240-001',
    ['pitch', 'driveWidth'],
    [
      [1.6, 0.35, 0.7],
      [2, 0.4, 0.9],
      [2.5, 0.45, 1.3],
      [3, 0.5, 1.5],
      [4, 0.7, 2],
      [5, 0.8, 2.5],
      [6, 1, 3],
      [8, 1.25, 4],
      [10, 1.5, 5],
      [12, 1.75, 6],
      [16, 2, 8],
      [20, 2.5, 10],
      [24, 3, 12],
    ],
  ),
};
fastenerDrawings['DIN 931'] = {
  ...fastenerDrawings['DIN 933'],
  url: 'https://gvyntok.com/wp-content/uploads/2024/06/030-090-001.pdf',
};
for (const standard of ['DIN 960', 'DIN 961'])
  fastenerDrawings[standard] = {
    ...fastenerDrawings['DIN 933'],
    url: `https://gvyntok.com/wp-content/uploads/2024/06/${standard === 'DIN 960' ? '030-250' : '030-260'}-001.pdf`,
    rows: Object.fromEntries(
      Object.entries(fastenerDrawings['DIN 933'].rows).map(([diameter, values]) => [
        diameter,
        { headSize: values.headSize, headHeight: values.headHeight },
      ]),
    ),
  };
fastenerDrawings['DIN 915'] = table(
  '040-280-001',
  ['pitch', 'driveWidth', 'tipDiameter'],
  [
    [3, 0.5, 1.5, 2],
    [4, 0.7, 2, 2.5],
    [5, 0.8, 2.5, 3.5],
    [6, 1, 3, 4],
    [8, 1.25, 4, 5.5],
    [10, 1.5, 5, 7],
    [12, 1.75, 6, 8.5],
    [16, 2, 8, 12],
    [20, 2.5, 10, 15],
    [24, 3, 12, 18],
  ],
);
/** Maximum dog-point projection z; the drawing changes the range at the listed length. */
export function dogPointLength(diameter: number, length: number): number | undefined {
  const rows: Record<number, number[]> = {
    3: [5, 1, 1.75],
    4: [6, 1.25, 2.25],
    5: [6, 1.5, 2.75],
    6: [8, 1.75, 3.25],
    8: [10, 2.25, 4.3],
    10: [12, 2.75, 5.3],
    12: [16, 3.25, 6.3],
    16: [20, 4.3, 8.36],
    20: [25, 5.3, 10.36],
    24: [30, 6.3, 12.43],
  };
  const row = rows[diameter];
  return row ? (length <= row[0] ? row[1] : row[2]) : undefined;
}
fastenerDrawings['DIN 914'] = {
  ...fastenerDrawings['DIN 913'],
  url: 'https://gvyntok.com/wp-content/uploads/2024/06/040-260-001.pdf',
};

export function coarsePitch(diameter: number): number {
  const exact =
    fastenerDrawings['DIN 912'].rows[diameter]?.pitch ??
    fastenerDrawings['DIN 933'].rows[diameter]?.pitch;
  return Number(
    exact ??
      (diameter <= 3
        ? 0.5
        : diameter <= 6
          ? 1
          : diameter <= 10
            ? 1.5
            : diameter <= 16
              ? 2
              : diameter <= 22
                ? 2.5
                : 3),
  );
}
