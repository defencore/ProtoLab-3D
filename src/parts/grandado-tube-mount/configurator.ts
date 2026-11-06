import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  tubeOD: 90,
  tubeID: 86,
  mountPitch: 99,
  earThickness: 6,
  earClearance: 0.2,
  mountHole: 3.4,
  windowClearance: 0.6,
  ringClearance: 0.3,
  fitClearance: 0.3,
  nutAF: 5.8,
  nutHeight: 2.7,
  holderLength: 77.7,
  holderWidth: 59.69,
  holderHeight: 21.54,
  connectorClearance: 1,
  smaProjection: 14,
  powerDepth: 12,
  powerCableDiameter: 4,
  gasketOuterWall: 1.775,
  gasketEndWall: 1.725,
  gasketGrooveWidth: 1.8,
  gasketInnerWall: 1,
  gasketGrooveDepth: 2,
  lidAxialFitAllowance: 0.5,
  antenna: true,
  antennaHole: 12,
  antennaX: 0,
  antennaY: -17.5,
  showTube: true,
  showPayload: true,
};

const numeric = (key: string, label: string, group: string, min: number, max: number, step = 0.1) =>
  numberParameter(key, label, '', group, min, max, step);
export const parameters: ParameterDefinition[] = [
  numeric('tubeOD', 'Tube outside diameter', 'Tube and window', 89, 92),
  numeric('tubeID', 'Tube inside diameter', 'Tube and window', 84, 88),
  {
    ...numeric('windowClearance', 'Window total size allowance', 'Tube and window', 0, 1.5),
    description:
      'Added to both 83 × 58 mm body dimensions. Zero makes the nominal template; 0.6 mm gives 83.6 × 58.6 mm for fitting. Width is a projected chord, not a tape-measured arc.',
  },
  {
    ...numeric('mountPitch', 'Measured Grandado ear hole pitch', 'Grandado mounting', 96, 102),
    description:
      '99 mm is estimated from the listing photographs. Measure the actual pair to set the internal ear-capture frame.',
  },
  {
    ...numeric('earThickness', 'Measured mounting ear thickness', 'Grandado mounting', 5.5, 6.5),
    description: 'The delivered Grandado ears are 6 mm high. This controls the cassette pocket; it does not resize the purchased enclosure.',
  },
  {
    ...numeric('earClearance', 'Mounting ear vertical fitting allowance', 'Print fits', 0, 0.5, 0.05),
    unit: 'mm',
    description: 'Added above the measured mounting ear: 6 mm + 0.2 mm gives a 6.2 mm pocket. Tune the print fit without altering the purchased part.',
  },
  numeric('mountHole', 'M3 through-hole diameter', 'Tube anchors', 3.2, 3.8, 0.05),
  numeric('nutAF', 'M3 nut pocket across flats', 'Print fits', 5.6, 6.1, 0.05),
  numeric('nutHeight', 'M3 nut pocket height', 'Print fits', 2.5, 3, 0.05),
  {
    ...numeric('ringClearance', 'Alignment ring diametral allowance', 'Print fits', 0, 0.8, 0.05),
    description: 'Nominal ID90 plus this printing allowance. Set zero for exactly 90 mm.',
  },
  numeric('fitClearance', 'Cassette radial sliding allowance', 'Print fits', 0.15, 0.6, 0.05),
  {
    ...numeric('holderLength', '3S holder length', 'Library holder fit', 76, 80),
    description:
      'Default is the existing BeiLaMoo 3S library model. Match the delivered holder; no unverified mounting holes are used.',
  },
  numeric('holderWidth', '3S holder width', 'Library holder fit', 58, 62),
  numeric('holderHeight', '3S holder height', 'Library holder fit', 20, 24),
  numeric('connectorClearance', 'Connector envelope allowance per side', 'Connectors', 0.5, 2),
  {
    ...numeric('smaProjection', 'SMA connector and plug outward space', 'Connectors', 10, 22),
    description:
      'Available axial service space beyond the short X+ wall; connector occupies Y−19…−8 and bottom+0.9…20 mm.',
  },
  {
    ...numeric('powerDepth', 'Power connector depth inside Grandado', 'Connectors', 8, 18),
    description:
      'The Ø19 connector points inward, with its centre measured 12 mm above the external enclosure bottom. Only its cable leaves the long wall.',
  },
  {
    ...numeric('powerCableDiameter', 'Power cable outside diameter', 'Connectors', 3, 4.8),
    description:
      'Only the cable leaves the long wall. The passage goes around the holder end into the cavity beneath it and through both end discs. Cable diameter plus twice the service allowance must not exceed 6 mm.',
  },
  {
    ...numeric('gasketOuterWall', 'Gasket channel outside side wall', 'Lid gasket groove', 1, 2.2, 0.025),
    unit: 'mm',
    description: 'Transverse Y wall. The 1.775 mm default centres the 1.8 mm groove on the delivered body rim: outside 53.7 mm, inside 51.6 mm. The original lid measurement was 1.6 mm.',
  },
  {
    ...numeric('gasketEndWall', 'Gasket channel outside end wall', 'Lid gasket groove', 1, 2.2, 0.025),
    unit: 'mm',
    description: 'Axial X outside wall. The 1.725 mm default locates the nominal channel on the delivered body rim: outside 78.7 mm, inside 76.8 mm. Axial fit allowance relieves only its inner flank; this outer wall stays fixed.',
  },
  {
    ...numeric('gasketGrooveWidth', 'Gasket groove width', 'Lid gasket groove', 1, 2.2, 0.05),
    unit: 'mm',
    description: 'Measured nominal channel width: 4.4 − 1.6 − 1.0 = 1.8 mm. Side sections and the four post turns retain this width; straight X ends additionally receive half the total axial fit allowance.',
  },
  {
    ...numeric('lidAxialFitAllowance', 'Lid axial fit allowance, total', 'Lid gasket groove', 0, 1, 0.05),
    unit: 'mm',
    description: 'Print-fit correction after the lid felt approximately 0.5 mm too long while its width fitted easily. The 0.5 mm total default moves each straight end groove\'s inner flank inward by 0.25 mm and retains the 1 mm inner wall. Outer flanks, width, post turns and screw axes stay fixed. Zero restores the previous fit; repeat the physical trial.',
  },
  {
    ...numeric('gasketInnerWall', 'Gasket channel inner wall', 'Lid gasket groove', 0.8, 2, 0.05),
    unit: 'mm',
    description: 'Measured original lid inner wall: 1 mm. Retained along both axes after recentering the channel.',
  },
  {
    ...numeric('gasketGrooveDepth', 'Nominal gasket groove depth', 'Lid gasket groove', 0.5, 3, 0.05),
    unit: 'mm',
    description: 'The original groove is approximately 2 mm deep. Its local floor follows the roof where needed to retain 3 mm of radial structural stock; inspect the reported minimum depth.',
  },
  { key: 'antenna', label: 'Mark underside antenna cable entry', type: 'boolean', group: 'Antenna' },
  {
    ...numeric('antennaHole', 'SMA cable insertion opening', 'Antenna', 9, 16),
    description:
      'Side entry beside the directly bonded antenna. No antenna cover is fitted. The 12 mm default is a fitting allowance, not a sourced connector dimension. Check the delivered plug and cable exit before drilling.',
    visibleWhen: (p) => p.antenna === true,
  },
  {
    ...numeric('antennaX', 'Underside cable opening axial position', 'Antenna', -12, 12),
    visibleWhen: (p) => p.antenna === true,
  },
  {
    ...numeric('antennaY', 'Side cable opening transverse position', 'Antenna', -24, -14),
    visibleWhen: (p) => p.antenna === true,
  },
  {
    key: 'showTube',
    label: 'Show cut tube reference',
    type: 'boolean',
    group: 'Inspection',
    filterable: false,
  },
  {
    key: 'showPayload',
    label: 'Show library Grandado and 3S holder',
    type: 'boolean',
    group: 'Inspection',
    filterable: false,
  },
];
export const catalogSelection = [
  { key: 'tubeOD', label: 'Tube OD' },
  { key: 'tubeID', label: 'Tube ID' },
  { key: 'windowClearance', label: 'Window allowance' },
];
