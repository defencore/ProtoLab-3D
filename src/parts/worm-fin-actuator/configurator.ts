import type { Parameters, ParameterDefinition } from '../../core/types';
import { frontBearings, wormBearings } from './lib/layout';
export const defaults: Parameters = {
  frontBearing: 'F6802ZZ',
  frontBore: 15,
  frontOuter: 24,
  frontWidth: 5,
  frontFlangeOuter: 26,
  frontFlangeWidth: 1.1,
  wormBearing: 'F685ZZ',
  travel: 40,
  inputTurns: 1,
  outputAngle: 0,
  plateThickness: 3,
  screwRootDiameter: 5.5,
  driveStubLength: 10,
  housingWall: 2.5,
  housingJoinClearance: 0.2,
  clearance: 0.25,
  seatClearance: 0.04,
  meshClearance: 0.08,
  backlash: 0.1,
};
const number = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 0.1,
  unit = 'mm',
): ParameterDefinition => ({ key, label, group, type: 'number', min, max, step, unit });
const label = (b: { id: string; bore: number; outer: number; width: number }) =>
  `${b.id} · ${b.bore} × ${b.outer} × ${b.width} mm`;
export const parameters: ParameterDefinition[] = [
  {
    key: 'frontBearing',
    catalogSummary: true,
    label: 'Large outer output bearing',
    group: 'Flanged bearings',
    type: 'select',
    options: [
      ...frontBearings.map((b) => ({ value: b.id, label: label(b) })),
      { value: 'custom', label: 'Custom flanged bearing' },
    ],
  },
  ...[
    number('frontBore', 'Outer bearing bore', 'Flanged bearings', 15, 30),
    number('frontOuter', 'Outer bearing body diameter', 'Flanged bearings', 20, 50),
    number('frontWidth', 'Outer bearing overall width', 'Flanged bearings', 4, 12),
    number('frontFlangeOuter', 'Outer bearing flange diameter', 'Flanged bearings', 22, 56),
    number('frontFlangeWidth', 'Outer bearing flange thickness', 'Flanged bearings', 0.5, 3),
  ].map((f) => ({ ...f, visibleWhen: (p: Parameters) => p.frontBearing === 'custom' })),
  {
    key: 'wormBearing',
    catalogSummary: true,
    label: 'Worm bearings · Ø5 turned journals',
    group: 'Flanged bearings',
    type: 'select',
    options: wormBearings.map((b) => ({ value: b.id, label: label(b) })),
  },
  {
    ...number('travel', 'Total output travel', 'Motion', 10, 100, 1, '°'),
    catalogSummary: true,
    description: '40° means −20° to +20°. Fixed Tr8x8(P2) pitch; teeth and diameter recalculate.',
  },
  {
    ...number('inputTurns', 'Target worm turns over full travel', 'Motion', 0.25, 5, 0.05, 'turns'),
    description:
      'The minimum tooth count also clears both output bearings. Exact turns are reported below.',
  },
  {
    ...number('outputAngle', 'Output position', 'Position', -50, 50, 1, '°'),
    filterable: false,
    description: 'Worm rotation = output angle × teeth / four starts.',
  },
  {
    ...number('plateThickness', 'Laser blank thickness', 'Gear fabrication', 1, 4, 0.5),
    description:
      'Default 3 mm sheet. Laser the supplied blank, then finish the enveloping tooth flanks to the 3D reference.',
  },
  {
    ...number('screwRootDiameter', 'Measured TR8 root diameter', 'Screw machining', 5.2, 6.2, 0.05),
    description:
      '5.5 mm is a nominal reconstructed profile. Measure the purchased screw before turning clean Ø5 journals.',
  },
  {
    ...number('driveStubLength', 'Ø4 drive stub length', 'Screw machining', 5, 25, 1),
    description:
      'Total turned stub length. It grows automatically with the housing to retain at least 3 mm of exposed coupling length.',
  },
  number('housingWall', 'Housing wall thickness', 'Housing', 2, 4, 0.25),
  {
    ...number(
      'housingJoinClearance',
      'Locating boss diametral clearance',
      'Housing',
      0.1,
      0.5,
      0.05,
    ),
    description:
      'Two integral locating bosses align the halves. Calibrate this fit for the machining or printing process.',
  },
  number('clearance', 'Axial component clearance', 'Fits', 0.15, 0.5, 0.05),
  {
    ...number('seatClearance', 'Bearing seat diametral clearance', 'Fits', 0.02, 0.4, 0.01),
    description:
      '0.04 mm is the machining starting point. Calibrate printed bores with a fit coupon or finish them after printing.',
  },
  number('meshClearance', 'Tooth radial clearance', 'Fits', 0.04, 0.15, 0.01),
  number('backlash', 'Tooth flank clearance', 'Fits', 0.06, 0.2, 0.01),
];
export const catalogSelection = [];
