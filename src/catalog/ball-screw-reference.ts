import type { Parameters, Preset } from '../core/types';
import { getSfeReferences, getInternalReturnReferences } from './ball-screw-additional';
import { getEndReturnReferences } from './ball-screw-end-return';

export interface BallScrewReference {
  designation: string;
  parameters: Parameters;
  catalog?: Preset['catalog'];
  note?: string;
}

const wangong = 'https://www.wangong.net/product/ball-screw/';
export const limonBallScrewReference =
  'https://image.makewebeasy.net/makeweb/0/WRl0sbTiz/Document/Ball_Screw_catalogue.pdf?v=202012190947';

// d, lead, Da, D, A, B, L, W, H, X, Q, circuits, Ca, Coa, K.
// Q records nominal lubrication-thread diameter, not a verified drilled pilot diameter.
function row(
  family: string,
  code: string,
  values: number[],
  source: string,
  sourceName: string,
  extra: Parameters = {},
  note = '',
): BallScrewReference {
  const [
    shaftDiameter,
    lead,
    ballDiameter,
    nutDiameter,
    flangeDiameter,
    flangeThickness,
    nutLength,
    mountCircle,
    flangeWidth,
    mountHoleDiameter,
    oilHoleDiameter,
    circuits,
    dynamic,
    statik,
    stiffness,
  ] = values;
  const parameters: Parameters = {
    family,
    shaftDiameter,
    lead,
    ballDiameter,
    nutDiameter,
    flangeDiameter,
    flangeThickness,
    flangeOffset: 0,
    nutLength,
    mountCircle,
    flangeWidth,
    mountHoleDiameter,
    mountHoleCount: family === 'SFK' ? '4' : shaftDiameter >= 50 ? '8' : '6',
    oilHoleDiameter,
    circuits,
    circuitTurns: 1,
    ...extra,
  };
  return {
    designation: `${family}${code}`,
    parameters,
    note,
    catalog: {
      designation: `${family}${code}`,
      sourceName,
      sourceUrl: source,
      ...(!source
        ? { sourceKind: 'attachment' as const }
        : { manufacturer: sourceName }),
      verifiedParameters: Object.keys(parameters).filter(
        (key) =>
          key !== 'oilHoleDiameter' && (key !== 'circuitTurns' || extra.circuitTurns !== undefined),
      ),
      specifications: [
        {
          label:
            extra.circuitTurns === undefined
              ? 'Reference circuits n'
              : 'Ball circuits · turns × rows',
          value:
            extra.circuitTurns === undefined
              ? String(circuits)
              : `${parameters.circuitTurns} × ${circuits}`,
        },
        ...(oilHoleDiameter
          ? [{ label: 'Lubrication thread Q', value: `M${oilHoleDiameter}` }]
          : []),
        ...(dynamic ? [{ label: 'Reference dynamic rating Ca', value: `${dynamic} kgf` }] : []),
        ...(statik ? [{ label: 'Reference static rating Coa', value: `${statik} kgf` }] : []),
        ...(stiffness ? [{ label: 'Reference stiffness K', value: `${stiffness} kgf/µm` }] : []),
      ],
    },
  };
}

const sfu = (code: string, values: number[]) =>
  row('SFU', code, values, '', 'User-supplied reference');

/** Every row of the user's SFU table, including its original load and stiffness values. */
export const sfuReferences = [
  sfu('1204-4', [12, 4, 2.381, 24, 40, 10, 40, 32, 30, 4.5, 0, 4, 593, 1129, 12.5]),
  sfu('1604-4', [16, 4, 2.381, 28, 48, 10, 40, 38, 40, 5.5, 6, 4, 629, 1270, 35]),
  sfu('1605-4', [16, 5, 3.175, 28, 48, 10, 50, 38, 40, 5.5, 6, 4, 780, 1790, 20]),
  sfu('1610-3', [16, 10, 3.175, 28, 48, 10, 57, 38, 40, 5.5, 6, 3, 721, 1249, 15]),
  sfu('2004-4', [20, 4, 2.381, 36, 58, 10, 42, 47, 44, 6.6, 6, 4, 699, 1617, 41]),
  sfu('2005-4', [20, 5, 3.175, 36, 58, 10, 51, 47, 44, 6.6, 6, 4, 1130, 2380, 25]),
  sfu('2504-4', [25, 4, 2.381, 40, 62, 10, 42, 51, 48, 6.6, 6, 4, 777, 2052, 48]),
  sfu('2505-4', [25, 5, 3.175, 40, 62, 10, 51, 51, 48, 6.6, 6, 4, 1280, 3110, 35]),
  sfu('2506-4', [25, 6, 3.969, 40, 62, 10, 54, 51, 48, 6.6, 6, 4, 1528, 3284, 40]),
  sfu('2508-4', [25, 8, 4.762, 40, 62, 10, 63, 51, 48, 6.6, 6, 4, 1941, 3863, 38]),
  sfu('2510-4', [25, 10, 4.762, 40, 62, 12, 85, 51, 48, 6.6, 6, 4, 1944, 3877, 33]),
  sfu('3204-4', [32, 4, 2.381, 50, 80, 12, 44, 65, 62, 9, 6, 4, 871, 2661, 56]),
  sfu('3205-4', [32, 5, 3.175, 50, 80, 12, 52, 65, 62, 9, 6, 4, 1450, 4150, 40]),
  sfu('3206-4', [32, 6, 3.969, 50, 80, 12, 57, 65, 62, 9, 6, 4, 1720, 4298, 47]),
  sfu('3208-4', [32, 8, 4.762, 50, 80, 12, 65, 65, 62, 9, 6, 4, 2189, 5079, 44]),
  sfu('3210-4', [32, 10, 6.35, 50, 80, 12, 90, 65, 62, 9, 6, 4, 3390, 7170, 79]),
  sfu('4005-4', [40, 5, 3.175, 63, 93, 14, 55, 78, 70, 9, 8, 4, 1610, 5330, 49]),
  sfu('4006-4', [40, 6, 3.969, 63, 93, 14, 60, 78, 70, 9, 8, 4, 1911, 5458, 55]),
  sfu('4008-4', [40, 8, 4.762, 63, 93, 14, 67, 78, 70, 9, 8, 4, 2435, 6469, 52]),
  sfu('4010-4', [40, 10, 6.35, 63, 93, 14, 93, 78, 70, 9, 8, 4, 3910, 9520, 50]),
  sfu('5010-4', [50, 10, 6.35, 75, 110, 16, 93, 93, 85, 11, 8, 4, 4450, 12500, 65]),
  sfu('5020-4', [50, 20, 7.144, 75, 110, 16, 138, 93, 85, 11, 8, 4, 4644, 14327, 59.5]),
  sfu('6310-4', [63, 10, 6.35, 95, 125, 18, 98, 108, 95, 11, 8, 4, 5070, 16600, 80]),
  sfu('6320-4', [63, 20, 9.525, 95, 135, 20, 149, 115, 100, 13.5, 8, 4, 7573, 23860, 84.1]),
  sfu('8010-4', [80, 10, 6.35, 105, 145, 20, 98, 125, 110, 13.5, 8, 4, 5620, 21300, 90]),
  sfu('8020-4', [80, 20, 9.525, 125, 165, 25, 154, 145, 130, 13.5, 8, 4, 8485, 30895, 84.1]),
  sfu('10020-4', [100, 20, 9.525, 150, 202, 30, 180, 170, 155, 17.5, 8, 4, 9420, 39183, 110.1]),
];

const sfk = (code: string, values: number[]) =>
  row('SFK', code, values, `${wangong}mini-type-sfk-series-ball-screw.html`, 'Wangong');
export const sfkReferences = [
  sfk('0401', [4, 1, 0.8, 10, 20, 3, 12, 15, 14, 2.9, 0, 2, 64, 97, 5]),
  sfk('0601', [6, 1, 0.8, 12, 24, 3.5, 15, 18, 16, 3.4, 0, 3, 111, 224, 9]),
  sfk('0801', [8, 1, 0.8, 14, 27, 4, 16, 21, 18, 3.4, 0, 4, 161, 403, 14]),
  sfk('0802', [8, 2, 1.2, 14, 27, 4, 16, 21, 18, 3.4, 0, 3, 222, 458, 13]),
  sfk('082.5', [8, 2.5, 1.2, 16, 29, 4, 26, 23, 20, 3.4, 0, 3, 221, 457, 13]),
  sfk('1002', [10, 2, 1.2, 18, 35, 5, 28, 27, 22, 4.5, 0, 3, 243, 569, 15]),
  sfk('1004', [10, 4, 2, 26, 46, 10, 34, 36, 28, 4.5, 6, 3, 468, 905, 17]),
  sfk('1202', [12, 2, 1.2, 20, 37, 5, 28, 29, 24, 4.5, 0, 4, 334, 906, 22]),
  sfk('1402', [14, 2, 1.2, 21, 40, 6, 23, 31, 26, 5.5, 0, 4, 354, 1053, 24]),
  sfk('1602', [16, 2, 1.2, 25, 43, 10, 40, 35, 29, 5.5, 6, 4, 373, 1200, 26]),
];
const sfk1004 = sfkReferences.find((reference) => reference.designation === 'SFK1004')!;
Object.assign(sfk1004.parameters, { mountCounterboreDiameter: 8, mountCounterboreDepth: 4.5 });
sfk1004.catalog!.verifiedParameters.push('mountCounterboreDiameter', 'mountCounterboreDepth');

const sfs = (code: string, values: number[], turns: number, starts = 1) =>
  row(
    'SFS',
    code,
    values,
    `${wangong}high-speed-low-noise-sfs-series-ball-screw.html`,
    'Wangong',
    { circuitTurns: turns, starts },
    'Published shaft diameter d is retained, including 15 mm and 31 mm variants; series digits are not substituted for d.',
  );
export const sfsReferences = [
  sfs('1205-2.8', [12, 5, 2.5, 24, 40, 10, 31, 32, 30, 4.5, 6, 1, 661, 1316, 19], 2.8),
  sfs('1210-2.8', [12, 10, 2.5, 24, 40, 10, 48.5, 32, 30, 4.5, 6, 1, 642, 1287, 19], 2.8, 2),
  sfs('1605-3.8', [15, 5, 2.778, 28, 48, 10, 38, 38, 40, 5.5, 6, 1, 1112, 2507, 30], 3.8),
  sfs('1610-2.8', [15, 10, 2.778, 28, 48, 10, 47, 38, 40, 5.5, 6, 1, 839, 1821, 23], 2.8, 2),
  sfs('1616-1.8', [15, 16, 2.778, 28, 48, 10, 45, 38, 40, 5.5, 6, 1, 552, 1137, 14], 1.8, 2),
  sfs('1620-1.8', [15, 20, 2.778, 28, 48, 10, 57, 38, 40, 5.5, 6, 1, 554, 1170, 14], 1.8, 2),
  sfs('2010-3.8', [20, 10, 3.175, 36, 58, 10, 60, 47, 44, 6.6, 6, 1, 1516, 3833, 40], 3.8),
  sfs('2510-3.8', [25, 10, 3.175, 40, 62, 12, 62, 51, 48, 6.6, 6, 1, 1638, 4633, 45], 3.8),
  sfs('2525-1.8', [25, 25, 3.175, 40, 62, 12, 70, 51, 48, 6.6, 6, 1, 843, 2199, 22], 1.8, 2),
  sfs('3210-3.8', [31, 10, 3.969, 50, 80, 13, 62, 65, 62, 9, 6, 1, 2460, 7255, 55], 3.8),
  sfs('3220-2.8', [31, 20, 3.969, 50, 80, 12, 80, 65, 62, 9, 6, 1, 1907, 5482, 43], 2.8),
  sfs('3232-1.8', [31, 32, 3.969, 50, 80, 13, 84, 65, 62, 9, 6, 1, 1257, 3426, 27], 1.8, 2),
];
// The shaft-start count comes from the separate shaft table, not the nut's circuit suffix.
for (const reference of sfsReferences) {
  reference.catalog!.verifiedParameters = reference.catalog!.verifiedParameters.filter(
    (key) => key !== 'starts',
  );
  reference.catalog!.alternateSourceUrls = [
    limonBallScrewReference + '#page=7',
    '',
  ];
}

const dfu = (code: string, values: number[]) =>
  row('DFU', code, values, `${wangong}double-nut-dfu-series-ball-screw.html`, 'Wangong');
export const dfuReferences = [
  dfu('2505-4', [25, 5, 3.175, 40, 62, 10, 101, 51, 48, 6.6, 6, 4, 1724, 4904, 62]),
  dfu('2510-4', [25, 10, 4.762, 40, 62, 12, 145, 51, 48, 6.6, 6, 4, 2954, 7295, 67]),
];

export const sfeReferences = getSfeReferences(row);
export const internalReturnReferences = getInternalReturnReferences(row, limonBallScrewReference);
export const endReturnReferences = getEndReturnReferences(row);

// Listing names are preserved as examples when the supplied material has no matching drawing.
export const unresolvedListingReferences: BallScrewReference[] = [
  {
    designation: 'SFK602 / SFK0602 · unverified listing',
    parameters: { ...sfkReferences[1].parameters, lead: 2, nutLength: 18 },
    note: 'The supplied listing says SFK602. This example interprets it as a 6 mm shaft with 2 mm lead. Nut dimensions are provisional; the listing does not provide a dimensioned SFK0602 drawing.',
  },
  {
    designation: 'SFE3210 · unverified listing',
    parameters: {
      ...sfeReferences.find((reference) => reference.designation === 'SFE3232-4')!.parameters,
      lead: 10,
      starts: 1,
    },
    note: 'The supplied listing says SFE3210. No matching manufacturer dimension table was found. This 32 mm × 10 mm example uses a provisional envelope and must be measured or edited before fitting an actual product.',
  },
];

export const ballScrewReferences: BallScrewReference[] = [
  ...sfuReferences,
  ...sfkReferences,
  ...sfsReferences,
  ...dfuReferences,
  ...sfeReferences,
  ...internalReturnReferences,
  ...endReturnReferences,
  ...unresolvedListingReferences,
];

export { row as ballScrewReferenceRow };
