import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';

export const defaults: Parameters = {
  fitClearance: 0.6,
  printClearance: 0.2,
  bearingPressFit: 0.04,
  angle1: 0,
  angle2: 0,
  angle3: 0,
  angle4: 0,
};
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
export const parameters: ParameterDefinition[] = [
  {
    key: 'fitClearance',
    label: 'Tube radial clearance',
    type: 'number',
    unit: 'mm',
    min: 0.4,
    max: 0.7,
    step: 0.1,
    group: 'Printed fits',
    description:
      'Clearance per side inside the fixed 86 mm tube bore. Motor and hardware sizes remain fixed.',
  },
  {
    key: 'printClearance',
    label: 'Printed sliding clearance',
    type: 'number',
    unit: 'mm',
    min: 0.15,
    max: 0.3,
    step: 0.05,
    group: 'Printed fits',
    description:
      'Clearance per side at the clocked nut pocket and printed rocker fit; qualify with a fit coupon.',
  },
  {
    key: 'bearingPressFit',
    label: 'Bearing seat interference',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 0.15,
    step: 0.01,
    group: 'Printed fits',
    description:
      'Diametral interference at fixed outer-race seats. Rear screw supports remain sliding fits. Qualify on the actual printer.',
  },
  ...[1, 2, 3, 4].map((i): ParameterDefinition => ({
    key: `angle${i}`,
    label: `Nominal output ${i} angle`,
    type: 'number',
    unit: '°',
    min: -18,
    max: 18,
    step: 1,
    group: 'Demonstration pose',
    filterable: false,
    description:
      'Prescribed output pose for the 8.5 mm rocker and centred 26 mm screw working thread; ±18° corresponds to ±2.627 mm nominal joint travel. Loaded contact and actual driven travel are not simulated.',
  })),
];
