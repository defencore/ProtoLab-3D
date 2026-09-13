import type { Parameters, Preset } from '../core/types';
import { coarsePitch } from './fastener-dimensions';
import { groupedSupplierRows, supplierCatalog, supplierFamily } from './fasteners';

const drawing = (code: string) => `https://gvyntok.com/wp-content/uploads/2024/06/${code}.pdf`;
const eyeRows: Record<number, number[]> = Object.fromEntries(
  [
    [5, 5, 12, 6],
    [6, 6, 14, 7],
    [8, 8, 18, 9],
    [10, 10, 20, 12],
    [12, 12, 25, 14],
    [16, 16, 32, 17],
    [20, 18, 40, 22],
    [24, 22, 45, 25],
    [27, 25, 50, 27],
    [30, 28, 55, 30],
    [33, 30, 60, 34],
    [36, 32, 65, 38],
    [39, 35, 70, 41],
  ].map(([d, ...values]) => [d, values]),
);
const wingRows: Record<number, number[]> = {
  4: [9.5, 21.5, 10.3],
  5: [10.4, 21.5, 10.3],
  6: [12.1, 26.4, 12.7],
  8: [14.3, 30, 15],
  10: [17, 34.9, 18.6],
  12: [22, 47.6, 23.4],
};
export const liftingEyeRows: Record<number, number[]> = Object.fromEntries(
  [
    [6, 20, 36, 20, 6, 36, 13],
    [8, 20, 36, 20, 6, 36, 13],
    [10, 25, 45, 25, 8, 45, 17],
    [12, 30, 54, 30, 10, 53, 20.5],
    [16, 35, 63, 35, 12, 62, 27],
    [20, 40, 72, 40, 14, 71, 30],
    [24, 50, 90, 50, 18, 90, 36],
    [30, 65, 108, 60, 22, 109, 45],
    [36, 75, 126, 70, 26, 128, 54],
    [42, 85, 144, 80, 30, 147, 63],
    [48, 100, 166, 90, 35, 168, 68],
    [56, 110, 184, 100, 38, 187, 78],
    [64, 120, 206, 110, 42, 208, 90],
    [72, 150, 260, 140, 50, 260, 100],
    [80, 170, 296, 160, 55, 298, 112],
    [100, 190, 330, 180, 60, 330, 130],
  ].map(([d, ...values]) => [d, values]),
);

/** Supplier SKUs share a preset only when every nominal geometry dimension agrees. */
export function specialFastenerPresets(
  kind: 'wing' | 'swing-eye' | 'lifting-eye',
  defaults: Parameters,
): Preset[] {
  const families = kind === 'wing' ? ['DIN 316'] : kind === 'swing-eye' ? ['DIN 444'] : ['DIN 580'];
  return groupedSupplierRows(families).map((rows) => {
    const row = rows[0],
      d = row.diameter,
      family = supplierFamily(row);
    const p: Parameters = { ...defaults, diameter: d, pitch: row.pitch ?? coarsePitch(d) };
    const verified = ['diameter'];
    let url: string | undefined;
    if (kind === 'wing') {
      const table = wingRows[d];
      Object.assign(p, {
        length: row.length!,
        form: row.categoryUrl.includes('nemetskaya') ? 'german' : 'standard',
        baseDiameter: table?.[0] ?? d * 2,
        wingSpan: table?.[1] ?? d * 4,
        headHeight: table?.[2] ?? d * 1.9,
        tipThickness: d * 0.5,
      });
      verified.push('length', 'form');
      if (table) verified.push('baseDiameter', 'wingSpan');
      // The supplier's h and overall-length rows disagree; h remains a prototype setting.
      url = drawing('040-300-001');
    } else if (kind === 'swing-eye') {
      const table = eyeRows[d],
        length = row.length!;
      Object.assign(p, {
        length,
        eyeBore: table?.[0] ?? d,
        eyeDiameter: table?.[1] ?? d * 2.2,
        headThickness: table?.[2] ?? d * 1.1,
        threadSpan: row.categoryUrl.includes('chastichnaya') ? 'partial' : 'full',
        threadLength: Math.min(
          length - Math.sqrt((Number(table?.[1] ?? d * 2.2) / 2) ** 2 - (d * 0.55) ** 2),
          2 * d + (length <= 125 ? 6 : length <= 200 ? 12 : 25),
        ),
      });
      verified.push('length', 'threadSpan');
      if (table) verified.push('eyeBore', 'eyeDiameter', 'headThickness');
      url = drawing('030-390-001');
    } else if (kind === 'lifting-eye') {
      const table = liftingEyeRows[d];
      Object.assign(p, {
        collarDiameter: table?.[0] ?? d * 2,
        eyeDiameter: table?.[1] ?? d * 3.8,
        eyeBore: table?.[2] ?? d * 2,
        collarHeight: table?.[3] ?? d * 0.6,
        headHeight: table?.[4] ?? d * 3.8,
        length: table?.[5] ?? d * 1.4,
      });
      if (table)
        verified.push(
          'collarDiameter',
          'eyeDiameter',
          'eyeBore',
          'collarHeight',
          'headHeight',
          'length',
        );
      url = drawing('030-370-001');
    }
    return {
      id: `gvyntok-${row.sku}`,
      name: `M${d}${kind === 'lifting-eye' ? '' : ` × ${row.length}`} · ${family}${kind === 'wing' && p.form === 'german' ? ' German form' : ''}${kind === 'swing-eye' ? ` · ${p.threadSpan} thread` : ''}`,
      description: `Supplier catalogue size${rows.length > 1 ? ` · ${rows.length} material/finish listings` : ''}. Verified drawing dimensions are identified; curved transitions and thread envelopes are prototype geometry.`,
      parameters: p,
      catalog: supplierCatalog(rows, verified, url),
    };
  });
}
