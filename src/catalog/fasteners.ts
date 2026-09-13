import type { Parameters, Preset } from '../core/types';
import sourceData from './data/gvyntok-fasteners-runtime.json';
import { coarsePitch, dogPointLength, fastenerDrawings } from './fastener-dimensions';
import { fastenerValues, MAX_THREAD_TURNS } from './lib/fastener-sizing';

export const nutDrawingUrl = 'https://gvyntok.com/wp-content/uploads/2024/06/050-010-001.pdf';
export const socketCapDrawingUrl = 'https://gvyntok.com/wp-content/uploads/2024/06/040-190-001.pdf';
export const conePointDrawingUrl = 'https://gvyntok.com/wp-content/uploads/2024/06/040-260-001.pdf';

/** Nominal across-flats dimensions and maximum nut heights from the supplier drawing. */
export const hexNutPresets: Preset[] = [
  [2, 4, 1.6],
  [2.5, 5, 2],
  [3, 5.5, 2.4],
  [4, 7, 3.2],
  [5, 8, 4],
  [6, 10, 5],
  [8, 13, 6.5],
  [10, 17, 8],
  [12, 19, 10],
  [16, 24, 13],
  [20, 30, 16],
].map(([bore, acrossFlats, height]) => ({
  id: `m${bore}`,
  name: `M${bore} · DIN 934`,
  description: `${acrossFlats} mm across flats · ${height} mm maximum height · nominal thread bore`,
  parameters: { bore, acrossFlats, height },
  catalog: {
    designation: `M${bore}`,
    standard: 'DIN 934',
    sourceName: 'Gvyntok',
    sourceUrl: nutDrawingUrl,
    verifiedParameters: ['bore', 'acrossFlats', 'height'],
  },
}));

export interface SupplierFastener {
  sku: string;
  url: string;
  categoryUrl: string;
  standard: string | null;
  diameter: number;
  length: number | null;
  pitch: number | null;
}
export const supplierFasteners: SupplierFastener[] = sourceData.rows.map((row) => ({
  sku: String(row[0]),
  url: String(row[1]),
  categoryUrl: sourceData.categories[Number(row[2])],
  standard: row[3] as string | null,
  diameter: Number(row[4]),
  length: row[5] as number | null,
  pitch: row[6] as number | null,
}));

export function supplierFamily(row: SupplierFastener): string {
  if (row.standard === 'ISO 7380') return 'ISO 7380-1';
  if (row.standard) return row.standard;
  if (row.categoryUrl.includes('bolt-norijnyj')) return 'Elevator bolt';
  return row.categoryUrl.includes('l-obraznym')
    ? 'L hook'
    : row.categoryUrl.includes('c-obraznym')
      ? 'C hook'
      : row.categoryUrl.includes('q-obraznym')
        ? 'Q hook'
        : 'O eye';
}

export function groupedSupplierRows(families: string[]): SupplierFastener[][] {
  const groups = new Map<string, SupplierFastener[]>();
  for (const row of supplierFasteners) {
    const family = supplierFamily(row);
    if (!families.includes(family)) continue;
    const variant =
      family === 'DIN 444'
        ? row.categoryUrl.includes('chastichnaya')
          ? 'partial'
          : 'full'
        : family === 'DIN 316' && row.categoryUrl.includes('nemetskaya')
          ? 'german'
          : '';
    const key = [family, row.diameter, row.length, row.pitch, variant].join(':');
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].sort(
    (a, b) =>
      supplierFamily(a[0]).localeCompare(supplierFamily(b[0])) ||
      a[0].diameter - b[0].diameter ||
      (a[0].length ?? 0) - (b[0].length ?? 0),
  );
}

export function supplierCatalog(
  rows: SupplierFastener[],
  verifiedParameters: string[],
  drawingUrl?: string,
): NonNullable<Preset['catalog']> {
  const row = rows[0];
  const family = supplierFamily(row);
  return {
    designation: `M${row.diameter}${row.length === null ? '' : ` × ${row.length}`}${row.pitch === null ? '' : ` · P${row.pitch}`}`,
    standard: /^(DIN|ISO) /.test(family) ? family : undefined,
    sourceName: 'Gvyntok',
    sourceUrl: row.url,
    verifiedParameters: [...new Set(verifiedParameters)],
    productCodes: rows.map((item) => item.sku),
    alternateSourceUrls: [
      ...rows.slice(1).map((item) => item.url),
      ...(drawingUrl ? [drawingUrl] : []),
    ],
  };
}

const basicFamilies: Record<string, [string, string]> = {
  'DIN 933': ['hex', 'none'],
  'DIN 931': ['hex', 'none'],
  'DIN 960': ['hex', 'none'],
  'DIN 961': ['hex', 'none'],
  'DIN 6921': ['hex-flange', 'none'],
  'DIN 603': ['carriage', 'none'],
  'DIN 608': ['countersunk-square', 'none'],
  'DIN 15237': ['elevator', 'none'],
  'Elevator bolt': ['elevator', 'none'],
  'DIN 912': ['socket-cap', 'hex'],
  'DIN 7991': ['countersunk', 'hex'],
  'DIN 965': ['countersunk', 'cross'],
  'DIN 7985': ['pan', 'cross'],
  'DIN 967': ['pan-flange', 'cross'],
  'DIN 7420': ['cheese', 'hex'],
  'ISO 7380-1': ['button', 'hex'],
  'ISO 7380-2': ['button-flange', 'hex'],
};

export function sourceBoltPresets(defaults: Parameters): Preset[] {
  return groupedSupplierRows(Object.keys(basicFamilies)).map((rows) => {
    const row = rows[0],
      family = supplierFamily(row),
      d = row.diameter,
      length = row.length!;
    const [head, drive] = basicFamilies[family];
    const drawing = fastenerDrawings[family];
    const dimensions = drawing?.rows[d] ?? {};
    const partial = [
      'DIN 931',
      'DIN 960',
      'DIN 603',
      'DIN 608',
      'DIN 15237',
      'Elevator bolt',
    ].includes(family);
    const headSize = Number(
      dimensions.headSize ??
        (head === 'hex' || head === 'hex-flange'
          ? d * 1.65
          : head === 'elevator'
            ? d * 3.5
            : d * 2),
    );
    const headHeight = Number(
      dimensions.headHeight ??
        (head === 'socket-cap'
          ? d
          : head.includes('countersunk')
            ? (headSize - d) / 2
            : head === 'elevator'
              ? d * 0.25
              : d * 0.55),
    );
    const shaftLength = length - (head.includes('countersunk') ? headHeight : 0);
    const neckHeight = Math.min(d * 0.5, shaftLength * 0.25);
    const squareNeck = ['carriage', 'countersunk-square', 'elevator'].includes(head);
    const available = shaftLength - (squareNeck ? neckHeight : 0);
    const b = Math.min(available, 2 * d + (length <= 125 ? 6 : length <= 200 ? 12 : 25));
    const p: Parameters = {
      ...defaults,
      diameter: d,
      shankDiameter: d,
      length,
      head,
      drive,
      headSize,
      headHeight,
      neckSize: d,
      neckHeight,
      countersinkAngle: 90,
      flangeDiameter: d * 2.5,
      flangeThickness: headHeight * 0.25,
      pitch: row.pitch ?? coarsePitch(d),
      threadMode: 'envelope',
      threadSpan: partial ? 'partial' : 'full',
      threadStart: 0,
      threadLength: b,
      tip: 'chamfer',
      tipLength: Math.min(d * 0.1, shaftLength * 0.1),
      tipDiameter: d * 0.6,
      driveWidth: drive === 'cross' ? d * 0.8 : d * 0.6,
      driveDepth: headHeight * 0.42,
      driveThickness: d * 0.22,
      ...dimensions,
    };
    if (row.pitch !== null) p.pitch = row.pitch;
    if (family === 'DIN 912' || family === 'DIN 7991') {
      const thread = Math.min(available, 2 * d + (family === 'DIN 912' ? 12 : 6));
      p.threadSpan = thread < available ? 'partial' : 'full';
      p.threadLength = thread;
    }
    if (head === 'pan-flange') p.headSize = Number(p.flangeDiameter) * 0.78;
    if (head === 'button-flange') {
      p.headSize = d * 1.8;
      p.flangeDiameter = d * 2.4;
    }
    if (head === 'carriage') p.headSize = Math.max(Number(p.headSize), Number(p.neckSize) * 1.6);
    const thread = fastenerValues(p);
    p.threadMode =
      thread.threadLength >= thread.pitch && thread.threadLength / thread.pitch <= MAX_THREAD_TURNS
        ? 'modeled'
        : 'envelope';
    const verified = ['diameter', 'length', 'head', 'drive', ...Object.keys(dimensions)];
    if (row.pitch !== null) verified.push('pitch');
    return {
      id: `gvyntok-${row.sku}`,
      name: `M${d} × ${length}${row.pitch === null ? '' : ` · P${row.pitch}`} · ${family}`,
      description: `Supplier catalogue size${rows.length > 1 ? ` · ${rows.length} material/finish listings` : ''}. Linked drawing values are identified; remaining profile details are editable prototype settings.`,
      parameters: p,
      catalog: supplierCatalog(rows, verified, drawing?.url),
    };
  });
}

export function sourceSetScrewPresets(defaults: Parameters): Preset[] {
  return groupedSupplierRows(['DIN 913', 'DIN 914', 'DIN 915']).map((rows) => {
    const row = rows[0],
      d = row.diameter,
      length = row.length!,
      family = supplierFamily(row);
    const tip = family === 'DIN 914' ? 'cone' : family === 'DIN 915' ? 'dog' : 'flat';
    const drawing = fastenerDrawings[family] ?? fastenerDrawings['DIN 913'];
    const dimensions = { ...(drawing.rows[d] ?? {}) };
    const dogLength = family === 'DIN 915' ? dogPointLength(d, length) : undefined;
    if (dogLength !== undefined) dimensions.tipLength = dogLength;
    const tipLength =
      tip === 'cone' ? Math.min(d * 0.5, length * 0.35) : Math.min(d * 0.35, length * 0.25);
    const p = {
      ...defaults,
      diameter: d,
      shankDiameter: d,
      length,
      pitch: coarsePitch(d),
      drive: 'hex',
      driveWidth: d * 0.5,
      driveDepth: Math.min(d * 0.55, (length - (tip === 'flat' ? 0 : tipLength)) * 0.4),
      driveThickness: d * 0.2,
      threadMode: 'envelope',
      threadSpan: 'full',
      threadStart: 0,
      threadLength: length,
      tip,
      tipLength,
      tipDiameter: tip === 'cone' ? 0 : d * 0.5,
      ...dimensions,
    };
    return {
      id: `gvyntok-${row.sku}`,
      name: `M${d} × ${length} · ${family} ${tip} point`,
      description: `Listed headless screw size. Socket and pitch use the linked drawing where available; tip lengths and drive depth remain editable.`,
      parameters: p,
      catalog: supplierCatalog(
        rows,
        ['diameter', 'length', 'tip', 'drive', ...Object.keys(dimensions)],
        drawing.url,
      ),
    };
  });
}

export const conePointCatalog: Preset['catalog'] = {
  designation: 'M2.5 cone point',
  standard: 'DIN 914 / ISO 4027',
  sourceName: 'Gvyntok',
  sourceUrl: conePointDrawingUrl,
  verifiedParameters: ['diameter', 'pitch', 'drive', 'driveWidth', 'tip'],
};
