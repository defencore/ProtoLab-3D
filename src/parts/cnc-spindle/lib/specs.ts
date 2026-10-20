import type { Parameters } from '../../../core/types';

export interface SpindleSpec {
  id: string;
  name: string;
  manufacturer: string;
  drawingDesignation: string;
  cooling: 'water' | 'air';
  power: number;
  collet: 'ER11' | 'ER20';
  bodyDiameter: number;
  bodyLength: number;
  bodyStartZ: number;
  bodyEndZ: number;
  clampStartZ: number;
  clampEndZ: number;
  clampCenterZ: number;
  clampWindowVerified: boolean;
  shaftLength: number;
  neckDiameter?: number;
  neckLength?: number;
  shoulderDiameter: number;
  threadDiameter: number;
  threadPitch: number;
  threadSpan: number;
  nutLength: number;
  portExtension: number;
  connectorExtension: number;
  totalHeight: number;
  rpm: number;
  frequency: number;
  sourceUrl: string;
  drawingUrl: string;
  sourceSha256: string;
  sourceNotes: string;
  threadNotes: string;
}
const pages = 'https://www.apsmotor.com/';
const drawings = 'https://rkrorwxhjmmnlp5m.ldycdn.com/';
type SourceSpec = Omit<SpindleSpec, 'bodyEndZ' | 'clampCenterZ' | 'totalHeight'>;
const values: SourceSpec[] = [
  {
    id: 'jst-1500-water-65',
    name: 'JST 1.5 kW water / 65 mm',
    manufacturer: 'Changzhou Jiesite / JST',
    drawingDesignation: 'JGD-65C-1.5KW',
    cooling: 'water',
    power: 1500,
    collet: 'ER11',
    bodyDiameter: 65,
    bodyLength: 217.5,
    bodyStartZ: 27,
    clampStartZ: 47,
    clampEndZ: 214.5,
    clampWindowVerified: false,
    shaftLength: 21,
    shoulderDiameter: 48,
    threadDiameter: 14,
    threadPitch: 0.75,
    threadSpan: 16,
    nutLength: 11,
    portExtension: 26,
    connectorExtension: 15,
    rpm: 24000,
    frequency: 400,
    sourceUrl:
      pages + 'round-water-cooled-1-5-kw-mtc-spindle-motor-with-er11-collet-65-mm-diameter.html',
    drawingUrl:
      drawings +
      'JST-1.5kw%2BER11%2B65mm%2Bwater-cooled%2Bround%2BMTC%2Bspindle%2Bmotor-aidlmBplKlllkSRnlmqklppkp.pdf',
    sourceSha256: '6767f9c142a6fe3d6e388fd7058c65434164f28d53c7c1c7f913296c3c78d6b4',
    sourceNotes:
      'Page names JGD-65D-1.5; linked drawing names JGD-65C-1.5KW. This reconstructs the drawing execution; verify the order designation. Body 217.5, shoulder 6, nose 21 and port extension 26 are dimensioned. Clamp window and undimensioned shell details are authored installation choices.',
    threadNotes:
      'Drawing declares M14x0.75. Its complete threaded engagement length and nut dimensions are unpublished; the 16 mm thread span and 11 mm nut are explicitly authored inspection envelopes, not supplier manufacturing dimensions.',
  },
  {
    id: 'jst-2200-water-80',
    name: 'JST 2.2 kW water / 80 mm',
    manufacturer: 'Changzhou Jiesite / JST',
    drawingDesignation: 'JGD-80C3-2.2K',
    cooling: 'water',
    power: 2200,
    collet: 'ER20',
    bodyDiameter: 80,
    bodyLength: 220,
    bodyStartZ: 43.8,
    clampStartZ: 63.8,
    clampEndZ: 233.8,
    clampWindowVerified: false,
    shaftLength: 30.8,
    neckDiameter: 49,
    neckLength: 5,
    shoulderDiameter: 65,
    threadDiameter: 25,
    threadPitch: 1.5,
    threadSpan: 20,
    nutLength: 18,
    portExtension: 26,
    connectorExtension: 12,
    rpm: 24000,
    frequency: 400,
    sourceUrl: pages + '2-2-kw-water-cooled-mtc-spindle-motor-er20-80-mm-4-bearings-24000-rpm.html',
    drawingUrl:
      drawings +
      'JST-2.2kw%2BER20%2B80mm%2B4%2Bbearings%2Bwater-cooled%2Bround%2BMTC%2Bspindle%2Bmotor-aidpkBplKlllkSRnlppinpmkm.pdf',
    sourceSha256: '4b23705e8eb678c964a9191c2179ce69ac6d9c8b20134a49215e6f97205c70c7',
    sourceNotes:
      'Drawing body 220, shoulder envelope 8+5 and nose 30.8 yield body datum 43.8 above the shaft mouth. Port extension 26 and port diameter 12 are dimensioned. Endcap split lines and clamp window are not dimensioned mounting instructions.',
    threadNotes:
      'Drawing declares M25x1.5. The 20 mm modeled engagement and 18 mm nut are authored inspection envelopes; source nut profile, span and fit class are unspecified.',
  },
  {
    id: 'jst-2200-air-80',
    name: 'JST 2.2 kW air / 80 mm',
    manufacturer: 'Changzhou Jiesite / JST',
    drawingDesignation: 'JGF-80E-2.2K',
    cooling: 'air',
    power: 2200,
    collet: 'ER20',
    bodyDiameter: 80,
    bodyLength: 255,
    bodyStartZ: 44,
    clampStartZ: 64,
    clampEndZ: 269,
    clampWindowVerified: false,
    shaftLength: 36,
    shoulderDiameter: 58.5,
    threadDiameter: 25,
    threadPitch: 1.5,
    threadSpan: 20,
    nutLength: 18,
    portExtension: 0,
    connectorExtension: 12,
    rpm: 24000,
    frequency: 400,
    sourceUrl:
      pages + 'round-air-cooled-2-2-kw-mtc-spindle-motor-80-mm-diameter-with-er20-collet.html',
    drawingUrl:
      drawings +
      'JST-2.2kw%2BER20%2B80mm%2Bair-cooled%2Bround%2BMTC%2Bspindle%2Bmotor-aidliBplKlllkSRnlqqrokpkp.pdf',
    sourceSha256: 'd84d8d679a1e403339cb77d56f28ab0c51d364f5614b33b51478835f4618a38f',
    sourceNotes:
      'Page names JGF-F80E-2.2; drawing names JGF-80E-2.2K. Body 255, front shoulder 8, nose 36 and shoulder diameter 58.5 are dimensioned. Nut front projection, connector length and individual air vents are not dimensioned; they remain authored envelopes.',
    threadNotes:
      'Drawing declares M25x1.5. The modeled thread span and nut dimensions are authored inspection envelopes, not a verified replacement nut drawing.',
  },
  {
    id: 'jst-3000-water-100',
    name: 'JST 3 kW water / 100 mm',
    manufacturer: 'Changzhou Jiesite / JST',
    drawingDesignation: 'JGD-100A-3.0KW',
    cooling: 'water',
    power: 3000,
    collet: 'ER20',
    bodyDiameter: 100,
    bodyLength: 243,
    bodyStartZ: 58,
    clampStartZ: 70,
    clampEndZ: 276,
    clampWindowVerified: true,
    shaftLength: 45,
    shoulderDiameter: 78,
    threadDiameter: 25,
    threadPitch: 1.5,
    threadSpan: 20,
    nutLength: 18,
    portExtension: 26,
    connectorExtension: 18,
    rpm: 24000,
    frequency: 400,
    sourceUrl:
      pages + '3-0-kw-water-cooled-mtc-spindle-motor-er20-100-mm-4-bearings-24000-rpm.html',
    drawingUrl:
      drawings +
      'JST-3kw%2BER20%2B100mm%2B4%2Bbearings%2Bwater-cooled%2Bround%2BMTC%2Bspindle%2Bmotor-aidpqBplKlllkSRnlqpjpojkp.pdf',
    sourceSha256: '9882c5d547a0af7a83d2d937b49565167e9cc35a65b9edcaef1a8b53b968c1ae',
    sourceNotes:
      'Page names JGD-100A2-3; linked drawing names JGD-100A-3.0KW. Body 243, shoulder 8+5, nose 45 and smooth barrel 206 are dimensioned. The barrel bounds 70..276 are sourced, but clamping permission/torque is not. Port and connector projections are undimensioned envelopes.',
    threadNotes:
      'Drawing declares M25x1.5. Modeled thread span, nut and collet internals remain authored inspection geometry with no supplier fit certification.',
  },
  {
    id: 'zhj-3000-air-100',
    name: 'Zhong Hua Jiang 3 kW air / 100 mm',
    manufacturer: 'Changzhou Huajiang / Zhong Hua Jiang',
    drawingDesignation: 'ER20 100mm 3KW Round Air Cooled',
    cooling: 'air',
    power: 3000,
    collet: 'ER20',
    bodyDiameter: 100,
    bodyLength: 220,
    bodyStartZ: 88,
    clampStartZ: 108,
    clampEndZ: 278,
    clampWindowVerified: false,
    shaftLength: 40,
    shoulderDiameter: 75,
    threadDiameter: 25,
    threadPitch: 1.5,
    threadSpan: 20,
    nutLength: 18,
    portExtension: 0,
    connectorExtension: 12,
    rpm: 18000,
    frequency: 300,
    sourceUrl: 'https://www.zhonghuajiangspindle.com/3kw-cnc-air-cooled-spindle-motor.html',
    drawingUrl: 'https://iprorwxhmkqlll5p.ldycdn.com/cloud/liBpnKilloSRrllkmpkriq/Main.jpg',
    sourceSha256: 'ddbedcaad3b070201efebf8f48350161d71d885534e7cca6a46a1822a46eb2e6',
    sourceNotes:
      'Manufacturer dimensional photo specifies diameter 100, nose assembly 88, body 220 and total 308 excluding the undimensioned connector. Page introduction says 24000 rpm; model table and nameplate say 18000 rpm / 300 Hz. Nose subdivisions and vent/connector details remain authored envelopes.',
    threadNotes:
      'Source specifies ER20 only; shaft thread diameter, pitch and span are unpublished. M25x1.5 is a qualified standard-derived ER20 inspection interface, not manufacturer-verified. The 20 mm span, nut geometry and fit must be measured on the supplied unit before release.',
  },
];
export const spindleSpecs: readonly SpindleSpec[] = values.map((s) => ({
  ...s,
  bodyEndZ: s.bodyStartZ + s.bodyLength,
  clampCenterZ: (s.clampStartZ + s.clampEndZ) / 2,
  totalHeight: s.bodyStartZ + s.bodyLength + Math.max(s.portExtension, s.connectorExtension),
}));
export function spindleSpec(selection: string | Parameters): SpindleSpec {
  const id = typeof selection === 'string' ? selection : String(selection.model);
  const spec = spindleSpecs.find((s) => s.id === id);
  if (!spec) throw new Error('Select a supported manufacturer spindle execution.');
  return { ...spec };
}
