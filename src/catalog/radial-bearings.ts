import type { Parameters, Preset } from '../core/types';

export type RadialFamily =
  | 'ball'
  | 'cylindrical'
  | 'self-aligning'
  | 'angular'
  | 'spherical'
  | 'tapered'
  | 'needle'
  | 'double-row';

interface SupplierBearing {
  id: string;
  family: RadialFamily;
  designation: string;
  manufacturer: string;
  bore: number;
  outer: number;
  width: number;
  sourceUrl: string;
}

// Curated supplier dimensions checked on 2026-09-13. Internal geometry is illustrative.
const products: SupplierBearing[] = [
  {
    id: 'o2580',
    family: 'ball',
    designation: '625',
    manufacturer: 'GPZ',
    bore: 5.0,
    outer: 16.0,
    width: 5.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-625-25-gost-o2580/',
  },
  {
    id: 'o2345',
    family: 'ball',
    designation: '607',
    manufacturer: 'GPZ',
    bore: 7.0,
    outer: 19.0,
    width: 6.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-607-17-gost-o2345/',
  },
  {
    id: 'o2347',
    family: 'ball',
    designation: '608',
    manufacturer: 'GPZ',
    bore: 8.0,
    outer: 22.0,
    width: 7.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-608-18-gost-o2347/',
  },
  {
    id: 'o8231',
    family: 'self-aligning',
    designation: '1201',
    manufacturer: 'CX',
    bore: 12.0,
    outer: 32.0,
    width: 10.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-1201-cx-poland-o8231/',
  },
  {
    id: 'o598',
    family: 'self-aligning',
    designation: '1205',
    manufacturer: 'KYK',
    bore: 25.0,
    outer: 52.0,
    width: 15.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-1205-kyk-japan-o598/',
  },
  {
    id: 'o599',
    family: 'self-aligning',
    designation: '1206',
    manufacturer: 'KYK',
    bore: 30.0,
    outer: 62.0,
    width: 16.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-1206-kyk-japan-o599/',
  },
  {
    id: 'o9776',
    family: 'angular',
    designation: '7001',
    manufacturer: 'FO Bearings',
    bore: 12.0,
    outer: 28.0,
    width: 8.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-7001-46101e-fo-bearings-o9776/',
  },
  {
    id: 'o7735',
    family: 'angular',
    designation: '7200 AC',
    manufacturer: 'FO Bearings',
    bore: 10.0,
    outer: 30.0,
    width: 9.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-7200-ac-46200-e-fo-o7735/',
  },
  {
    id: 'o3343',
    family: 'angular',
    designation: '7201-BTNG',
    manufacturer: 'FO Bearings',
    bore: 12.0,
    outer: 32.0,
    width: 10.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-7201-btng-46201e-fo-bearings-o3343/',
  },
  {
    id: 'o9778',
    family: 'spherical',
    designation: '22205 MBW33',
    manufacturer: 'FO Bearings',
    bore: 25.0,
    outer: 52.0,
    width: 18.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-22205-mbw33-3505-fo-bearings-o9778/',
  },
  {
    id: 'o3906',
    family: 'spherical',
    designation: '22207-MW33',
    manufacturer: 'FO Bearings',
    bore: 35.0,
    outer: 72.0,
    width: 23.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-22207-mw33-3507-fo-bearings-o3906/',
  },
  {
    id: 'o3907',
    family: 'spherical',
    designation: '22208 MW33',
    manufacturer: 'FO Bearings',
    bore: 40.0,
    outer: 80.0,
    width: 23.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-22208-mw33-3508-fo-bearings-o3907/',
  },
  {
    id: 'o3903',
    family: 'spherical',
    designation: '22206 MW33',
    manufacturer: 'FO Bearings',
    bore: 30.0,
    outer: 62.0,
    width: 20.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-22206-mw33-3506-fo-bearings-o3903/',
  },
  {
    id: 'o11243',
    family: 'cylindrical',
    designation: 'NU205',
    manufacturer: 'FO Bearings',
    bore: 25.0,
    outer: 52.0,
    width: 15.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-nu-205-32205-fo-bearings-o11243/',
  },
  {
    id: 'o1411',
    family: 'cylindrical',
    designation: 'NJ204',
    manufacturer: 'FO Bearings',
    bore: 20.0,
    outer: 47.0,
    width: 14.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-nj204-42204-fo-beearings-o1411/',
  },
  {
    id: 'o11223',
    family: 'cylindrical',
    designation: 'NJ305',
    manufacturer: 'FO Bearings',
    bore: 25.0,
    outer: 62.0,
    width: 17.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-nj305-42305-fo-bearings-o11223/',
  },
  {
    id: 'o4783',
    family: 'cylindrical',
    designation: 'NJ205',
    manufacturer: 'FO Bearings',
    bore: 25.0,
    outer: 52.0,
    width: 15.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-nj205-42205-fo-o4783/',
  },
  {
    id: 'o9927',
    family: 'needle',
    designation: 'HK0608',
    manufacturer: 'CX',
    bore: 6.0,
    outer: 10.0,
    width: 8.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-hk0608-6x10x8-cx-poland-o9927/',
  },
  {
    id: 'o9929',
    family: 'needle',
    designation: 'HK1010',
    manufacturer: 'CX',
    bore: 10.0,
    outer: 14.0,
    width: 10.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-hk1010-cx-poland-o9929/',
  },
  {
    id: 'o10047',
    family: 'needle',
    designation: 'HK0810',
    manufacturer: 'CX',
    bore: 8.0,
    outer: 12.0,
    width: 10.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-hk0810-cx-poland-o10047/',
  },
  {
    id: 'o10980',
    family: 'needle',
    designation: 'HK0812',
    manufacturer: 'CX',
    bore: 8.0,
    outer: 12.0,
    width: 12.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-hk0812-cx-poland-o10980/',
  },
  {
    id: 'o8031',
    family: 'double-row',
    designation: '4203-2RS',
    manufacturer: 'CX',
    bore: 17.0,
    outer: 40.0,
    width: 16.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-4203-2rs-17x40x16-cx-poland-o8031/',
  },
  {
    id: 'o7588',
    family: 'double-row',
    designation: '4202-2RS',
    manufacturer: 'CX',
    bore: 15.0,
    outer: 35.0,
    width: 14.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-4202-2rs-cx-poland-o7588/',
  },
  {
    id: 'o7598',
    family: 'double-row',
    designation: '4304-2RS',
    manufacturer: 'CX',
    bore: 20.0,
    outer: 52.0,
    width: 21.0,
    sourceUrl: 'https://promtehimport.com.ua/offer/pidshipnik-4304-2rs-cx-poland-o7598/',
  },
];

export function radialCatalog(family: RadialFamily, internal: Parameters): Preset[] {
  return products
    .filter((product) => product.family === family)
    .map((product) => ({
      id: `promteh-${product.id}`,
      name: `${product.designation} · ${product.manufacturer}`,
      description: `${product.bore} × ${product.outer} × ${product.width} mm · Supplier envelope`,
      parameters: { ...internal, bore: product.bore, outer: product.outer, width: product.width },
      catalog: {
        designation: product.designation,
        manufacturer: product.manufacturer,
        sourceName: 'Promtehimport',
        sourceUrl: product.sourceUrl,
        verifiedParameters: ['bore', 'outer', 'width'],
      },
    }));
}
