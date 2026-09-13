import raw from './data/gvyntok-shajby-koltsa.json';
import type { Parameters, Preset } from '../core/types';

export const retentionWasherSources = {
  split: 'https://guede.net/wp-content/uploads/2021/04/DIN127B_en.pdf',
  ring: 'https://www.americanring.com/products/ringseries.aspx?series=DIN6799&units=metric',
  envelope:
    'https://www.reyher.de/fileadmin/user_upload/Downloadbereich/Reyher_2019-EN_Technische_Informationen_ks.pdf',
};
// Güde DIN 127-B reference maxima: bore d, outside D, thickness s, free height h.
const splitRows: Record<number, number[]> = {
  2: [2.4, 4.4, 0.6, 1.2],
  2.5: [2.9, 5.1, 0.7, 1.4],
  3: [3.4, 6.2, 0.9, 1.9],
  4: [4.4, 7.6, 1, 2.1],
  5: [5.4, 9.2, 1.3, 2.8],
  6: [6.5, 11.8, 1.7, 3.8],
  7: [7.5, 12.8, 1.7, 4.2],
  8: [8.5, 14.8, 2.1, 4.7],
  10: [10.7, 18.1, 2.35, 5.2],
  12: [12.7, 21.1, 2.65, 5.9],
  14: [14.7, 24.1, 3.15, 7.1],
  16: [17, 27.4, 3.7, 8.3],
  18: [19, 29.4, 3.7, 8.3],
  20: [21.2, 33.6, 4.2, 9.4],
  22: [23.5, 35.9, 4.2, 9.4],
  24: [25.5, 40, 5.2, 11.8],
  27: [28.5, 43, 5.2, 11.8],
  30: [31.7, 48.2, 6.2, 14.2],
  36: [37.7, 58.2, 6.2, 14.2],
  39: [40.7, 61.2, 6.2, 14.2],
  42: [43.7, 68.2, 7.25, 16.5],
  45: [46.7, 71.2, 7.25, 16.5],
  48: [50.5, 75, 7.25, 16.5],
  52: [54.5, 83, 8.25, 18.9],
};
// REYHER DIN 6799 maximum outside envelope and nominal thickness; American Ring free contact diameter.
const ringRows: Record<number, number[]> = {
  1.2: [3.25, 0.3, 1.02],
  1.5: [4.25, 0.4, 1.27],
  1.9: [4.8, 0.5, 1.6],
  2.3: [6.3, 0.6, 1.93],
  3.2: [7.3, 0.6, 2.69],
  4: [9.3, 0.7, 3.33],
  5: [11.3, 0.7, 4.11],
  6: [12.3, 0.7, 5.26],
  7: [14.3, 0.9, 5.84],
  8: [16.3, 1, 6.52],
  9: [18.8, 1.1, 7.62],
  10: [20.4, 1.2, 8.33],
  12: [23.4, 1.3, 10.44],
  15: [29.4, 1.5, 12.6],
  19: [37.6, 1.75, 15.93],
  24: [44.6, 2, 21.87],
};
const kindOf = (url: string) =>
  url.includes('grover') ? 'split' : url.includes('din-6799') ? 'ring' : undefined;
export const retentionWasherExclusions = raw.products
  .filter((row) => {
    const kind = kindOf(row.categoryUrl);
    return (
      kind && row.diameter !== null && !(kind === 'split' ? splitRows : ringRows)[row.diameter]
    );
  })
  .map((row) => ({
    sku: row.sku,
    sourceUrl: row.url,
    nominalSize: row.diameter,
    reason:
      'No dimensional row in the selected primary reference. The listed supplier SKU is retained here, not mapped to a neighboring size.',
  }));

export function retentionWasherPresets(kind: 'split' | 'ring', defaults: Parameters): Preset[] {
  const table = kind === 'split' ? splitRows : ringRows,
    groups = new Map<number, typeof raw.products>();
  for (const row of raw.products) {
    if (kindOf(row.categoryUrl) !== kind || row.diameter === null || !table[row.diameter]) continue;
    groups.set(row.diameter, [...(groups.get(row.diameter) ?? []), row]);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([diameter, rows]) => {
      const values = table[diameter],
        parameters: Parameters =
          kind === 'split'
            ? {
                ...defaults,
                diameter,
                innerDiameter: values[0],
                outerDiameter: values[1],
                thickness: values[2],
                freeHeight: values[3],
              }
            : {
                ...defaults,
                grooveDiameter: diameter,
                outerDiameter: values[0],
                thickness: values[1],
                innerDiameter: values[2],
              };
      return {
        id: `gvyntok-${kind === 'split' ? 'lock-washer' : 'e-ring'}-${diameter}`,
        name: `${kind === 'split' ? 'M' : ''}${diameter} · reference envelope`,
        description:
          kind === 'split'
            ? `Gvyntok nominal size · ${rows.length} SKU${rows.length === 1 ? '' : 's'} · Güde DIN127-B reference maxima; supplier standard and profile dimensions are unverified`
            : 'Gvyntok DIN6799 nominal size · REYHER outside/thickness and American Ring free-contact reference dimensions',
        parameters,
        catalog: {
          designation: `${kind === 'split' ? 'Grover M' : 'DIN 6799 '}${diameter}`,
          ...(kind === 'ring' ? { standard: 'DIN 6799' } : {}),
          sourceName: 'Gvyntok',
          sourceUrl: rows[0].url,
          alternateSourceUrls: [
            ...rows.slice(1).map((row) => row.url),
            retentionWasherSources[kind],
            ...(kind === 'ring' ? [retentionWasherSources.envelope] : []),
          ],
          productCodes: rows.map((row) => row.sku),
          verifiedParameters: [kind === 'split' ? 'diameter' : 'grooveDiameter'],
        },
      };
    });
}
