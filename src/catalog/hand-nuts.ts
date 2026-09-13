import raw from './data/gvyntok-gajki.json';
import type { Parameters, Preset } from '../core/types';
import { nutCoarsePitch } from './lib/fastener-sizing';

export const handNutDrawings = {
  wing: 'https://gvyntok.com/wp-content/uploads/2024/06/050-500-001.pdf',
  eye: 'https://gvyntok.com/wp-content/uploads/2024/06/050-840-001.pdf',
};

// DIN 315 drawing: maximum d2, e, h and m. These are maximum fit envelopes, not measured products.
const wingRows: Record<number, number[]> = {
  3: [10.92, 23.11, 11.94, 4.57],
  4: [11, 23.5, 12, 4.6],
  5: [13.4, 28, 14.5, 5],
  6: [14.2, 28.7, 15, 5.6],
  8: [14.8, 32, 16.8, 6.4],
  10: [17.8, 36.6, 21, 10.5],
  12: [23.7, 50, 25.4, 11],
  16: [30.2, 70.1, 36.6, 13.5],
  20: [32, 74, 40, 13.5],
};
// DIN 582 drawing: d2, d3, d4, e, h and k. The source explicitly marks M6 as non-standard.
const eyeRows: Record<number, number[]> = {
  6: [20, 36, 20, 8.5, 36, 8],
  8: [20, 36, 20, 8.5, 36, 8],
  10: [25, 45, 25, 10, 45, 10],
  12: [30, 54, 30, 11, 53, 12],
  16: [35, 63, 35, 13, 62, 14],
  20: [40, 72, 40, 16, 71, 16],
  24: [50, 90, 50, 20, 90, 20],
  30: [65, 108, 60, 25, 109, 24],
  36: [75, 126, 70, 30, 128, 28],
  42: [85, 144, 80, 35, 147, 32],
};

export const handNutExclusions = raw.products
  .filter((row) =>
    row.standard === 'DIN 315'
      ? !wingRows[row.diameter!]
      : row.standard === 'DIN 582' && !eyeRows[row.diameter!],
  )
  .map((row) => ({
    sku: row.sku,
    diameter: row.diameter,
    standard: row.standard,
    sourceUrl: row.url,
    reason: 'The supplier lists this thread size but its linked drawing has no dimensional row.',
  }));

/** Group material/coating SKUs only when their published dimensions share one envelope. */
export function handNutPresets(kind: 'wing' | 'eye', defaults: Parameters): Preset[] {
  const standard = kind === 'wing' ? 'DIN 315' : 'DIN 582';
  const table = kind === 'wing' ? wingRows : eyeRows;
  const groups = new Map<number, typeof raw.products>();
  for (const row of raw.products) {
    if (row.standard !== standard || row.diameter === null || !table[row.diameter]) continue;
    groups.set(row.diameter, [...(groups.get(row.diameter) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([diameter, products]) => {
      const row = table[diameter];
      const dimensions: Parameters =
        kind === 'wing'
          ? { baseDiameter: row[0], wingSpan: row[1], height: row[2], baseHeight: row[3] }
          : {
              collarDiameter: row[0],
              eyeDiameter: row[1],
              eyeBore: row[2],
              collarHeight: row[3],
              height: row[4],
              eyeThickness: row[5],
            };
      const parameters: Parameters = {
        ...defaults,
        diameter,
        pitch: nutCoarsePitch(diameter),
        ...dimensions,
      };
      if (kind === 'wing') parameters.wingThickness = Math.max(1.5, diameter * 0.4);
      return {
        id: `gvyntok-${kind}-nut-m${diameter}`,
        name: `M${diameter}${kind === 'wing' ? ' · maximum envelope' : diameter === 6 ? ' · non-standard size' : ''}`,
        description: `${standard} · ${products.length} supplier SKU${products.length === 1 ? '' : 's'} · ${kind === 'wing' ? 'Published maximum d2/e/h/m dimensions' : 'Published nominal ring and collar dimensions'}`,
        parameters,
        catalog: {
          designation: `${standard} M${diameter}`,
          standard,
          sourceName: 'Gvyntok',
          sourceUrl: products[0].url,
          alternateSourceUrls: [
            ...products.slice(1).map((product) => product.url),
            handNutDrawings[kind],
          ],
          productCodes: products.map((product) => product.sku),
          verifiedParameters: ['diameter', ...Object.keys(dimensions)],
        },
      };
    });
}
