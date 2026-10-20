import type { Parameters } from '../../../core/types';

export const encoderDrawingSource =
  'https://www.heidenhain.us/wp-content/uploads/2022/07/PR_Linear_Encoders_for_Numerically_Controlled_Machine_Tools_ID571470_en.pdf#page=20';
export const encoderMountingInstructionReference =
  'HEIDENHAIN MSL 41 mounting instructions 894918-94, 06/2019; obtain current copy from manufacturer documentation before release';
export type EncoderHole = {
  position: [number, number, number];
  axis: 'y';
  diameter: number;
  counterboreDiameter?: number;
  counterboreDepth?: number;
  seatY?: number;
  seatVerified?: boolean;
  bolt: 'M4' | 'M6' | 'M8';
  note: string;
};
type Execution = {
  id: string;
  kind: 'encoder' | 'spar';
  designation: string;
  source: string;
  measuringLength: number;
  endBlock?: '09A' | '10A';
  interpolation?: number;
  evaluatedStepMicrons?: number;
  accuracyMicrons?: number;
  pairedModel: string;
};
export const encoderExecutions: Execution[] = [
  {
    id: 'ls477-605365-86',
    kind: 'encoder',
    designation: 'HEIDENHAIN LS 477, ID 605365-86',
    source: 'https://www.heidenhain.com/product-details/sealed-linear-encoders/605365-86',
    measuringLength: 920,
    endBlock: '09A',
    interpolation: 5,
    evaluatedStepMicrons: 1,
    accuracyMicrons: 3,
    pairedModel: 'msl41-770902-17',
  },
  {
    id: 'ls477-605363-30',
    kind: 'encoder',
    designation: 'HEIDENHAIN LS 477, ID 605363-30',
    source: 'https://www.heidenhain.com/product-details/sealed-linear-encoders/605363-30',
    measuringLength: 1640,
    endBlock: '10A',
    interpolation: 5,
    evaluatedStepMicrons: 1,
    accuracyMicrons: 3,
    pairedModel: 'msl41-770902-24',
  },
  {
    id: 'ls477-605363-27',
    kind: 'encoder',
    designation: 'HEIDENHAIN LS 477, ID 605363-27',
    source: 'https://www.heidenhain.com/product-details/sealed-linear-encoders/605363-27',
    measuringLength: 270,
    endBlock: '10A',
    interpolation: 10,
    evaluatedStepMicrons: 0.5,
    accuracyMicrons: 3,
    pairedModel: 'msl41-770902-05',
  },
  {
    id: 'msl41-770902-17',
    kind: 'spar',
    designation: 'HEIDENHAIN MSL 41 ML 920, ID 770902-17',
    source:
      'https://www.heidenhain.com/search?tx_solr%5Bfilter%5D%5B0%5D=type%3Afacet_product&tx_solr%5Bpage%5D=3&tx_solr%5Bq%5D=MSL41',
    measuringLength: 920,
    pairedModel: 'ls477-605365-86',
  },
  {
    id: 'msl41-770902-24',
    kind: 'spar',
    designation: 'HEIDENHAIN MSL 41 ML 1640, ID 770902-24',
    source:
      'https://www.heidenhain.com/search?tx_solr%5Bfilter%5D%5B0%5D=type%3Afacet_product&tx_solr%5Bpage%5D=2&tx_solr%5Bq%5D=MSL41',
    measuringLength: 1640,
    pairedModel: 'ls477-605363-30',
  },
  {
    id: 'msl41-770902-05',
    kind: 'spar',
    designation: 'HEIDENHAIN MSL 41 ML 270, ID 770902-05',
    source:
      'https://www.heidenhain.com/search?tx_solr%5Bfilter%5D%5B0%5D=type%3Afacet_product&tx_solr%5Bpage%5D=2&tx_solr%5Bq%5D=MSL41',
    measuringLength: 270,
    pairedModel: 'ls477-605363-27',
  },
];

/** X is the measurement axis. All coordinates refer to the paired housing midpoint,
 * its rear plane Y=0 and bottom Z=0. The separately ordered spar shares these datums. */
export function encoderSpec(p: Parameters | string) {
  const id = typeof p === 'string' ? p : String(p.model);
  const execution = encoderExecutions.find((row) => row.id === id);
  if (!execution) throw new Error('Select an identified HEIDENHAIN LS 477 or MSL 41 execution.');
  const ml = execution.measuringLength;
  const block =
    execution.endBlock ??
    encoderExecutions.find((row) => row.id === execution.pairedModel)?.endBlock;
  const length = ml + (block === '09A' ? 138 : 105);
  const scaleHoleX = (ml + (block === '09A' ? 115 : 94)) / 2;
  const scaleMounts: EncoderHole[] = [-1, 1].map((sign) => ({
    position: [sign * scaleHoleX, 0, block === '09A' ? 18.7 : 16.5],
    axis: 'y',
    diameter: block === '09A' ? 9.6 : 4.3,
    counterboreDiameter: block === '09A' ? 15 : 7,
    bolt: block === '09A' ? 'M8' : 'M4',
    note:
      block === '09A'
        ? 'Normal 09A source end block. Factory M8 retention/clamping hardware must be checked before direct mounting.'
        : 'Short 10A end retention, source D7.0/4.3 for ISO 4762 M4; install with the separately ordered MSL 41.',
  }));
  const readheadMounts: EncoderHole[] = [-40.5, 15.5].map((x) => ({
    position: [x, -0.25, -4],
    axis: 'y',
    diameter: 4.3,
    counterboreDiameter: 7,
    bolt: 'M4',
    note: 'MSL mounting Fig III: head plane 10 mm from spar host plane. Source head pitch 56 mm; first hole is 12 mm from the head left datum. Direct mounting Fig I uses a different +0.25 mm plane.',
  }));
  const sparLength = ml + 105;
  const sparMounts: EncoderHole[] = [-1, 1].map((sign) => ({
    position: [sign * (ml / 2 + 15), -10.25, 17],
    axis: 'y',
    diameter: 8.5,
    counterboreDiameter: 17,
    counterboreDepth: 6,
    seatY: -8.55,
    seatVerified: false,
    bolt: 'M6',
    note: 'MSL 41 source slot width 8.5 +8.8/-0.3 mm and center 37.5 mm from the end. Manufacturer mounting instruction calls for M6 (M5), not M8. Circular slot and recessed screw seat are nominal installation envelopes; actual slot/counterbore contour must be checked against delivered supplier instructions.',
  }));
  if (ml > 820)
    sparMounts.push({
      position: [0, -10.25, 17],
      axis: 'y',
      diameter: 6.5,
      counterboreDiameter: 11,
      counterboreDepth: 6,
      seatY: -8.55,
      seatVerified: false,
      bolt: 'M6',
      note: 'Source central D11/6.5 mounting point. Additional source mounting/clamping hardware is supplied with the spar; no fabricated clamp contours are certified.',
    });
  return {
    ...execution,
    length: execution.kind === 'spar' ? sparLength : length,
    scaleLength: length,
    scaleEndBlock: block,
    bodyDepth: 18,
    bodyHeight: 32.2,
    sparLength,
    sparDepth: 7.7,
    sparHeight: 36.1,
    sparBackY: -10.25,
    sparBottomZ: -1,
    installedDepth: 28.25,
    measurementStartX: -ml / 2 - 52.5,
    readheadLeftX: -52.5,
    readheadBodyLength: 97.5,
    readheadOverallLength: 115,
    readheadRearY: -0.25,
    readheadDirectMountRearY: 0.25,
    readheadBottomZ: -13,
    readheadDepth: 18.25,
    sparClampCenters: [-1, 1].flatMap((sign) =>
      [55, ml === 920 ? 450 : ml === 1640 ? 810 : 115].map((x) => sign * x),
    ),
    scaleMounts,
    readheadMounts,
    sparMounts,
    supplyVolts: 5,
    maxNoLoadCurrentMilliamp: 140,
    output: 'Complementary TTL A,/A,B,/B,Z,/Z; 14-pin flange socket',
    signalPitchMicrons: 20,
  };
}
