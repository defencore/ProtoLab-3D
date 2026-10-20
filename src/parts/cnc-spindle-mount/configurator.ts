import type { Parameters, ParameterDefinition } from '../../core/types';

export const defaults: Parameters = {
  component: 'back',
  bodyDiameter: 80,
  clampHeight: 40,
  radialWall: 14,
  rearWall: 18,
  splitGap: 1,
  boreClearance: 0.15,
  clampBoltDiameter: '6',
  mountBoltDiameter: '6',
  threadFitAllowance: 0,
};
const dimension = (
  key: string,
  label: string,
  min: number,
  max: number,
  step = 1,
): ParameterDefinition => ({
  key,
  label,
  type: 'number',
  group: 'Manufactured clamp',
  min,
  max,
  step,
  unit: 'mm',
});
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Physical detail',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'back', label: 'Rear mounting block' },
      { value: 'cap', label: 'Front clamp cap' },
    ],
  },
  dimension('bodyDiameter', 'Spindle body diameter', 40, 125, 0.1),
  dimension('clampHeight', 'Axial clamp height', 32, 80),
  dimension('radialWall', 'Side wall', 12, 25),
  dimension('rearWall', 'Rear mounting wall', 16, 30),
  dimension('splitGap', 'Assembly split gap', 0.5, 2, 0.1),
  dimension('boreClearance', 'Nominal bore allowance', 0, 0.5, 0.05),
  {
    ...dimension('threadFitAllowance', 'Authored thread radial allowance', 0, 0.2, 0.01),
    visibleWhen: () => false,
    filterable: false,
    description:
      'Explicit inspection clearance; this is not a released thread fit or tolerance class.',
  },
  {
    key: 'clampBoltDiameter',
    label: 'Clamp screw thread',
    type: 'select',
    group: 'Fasteners',
    options: [
      { value: '6', label: 'M6' },
      { value: '8', label: 'M8' },
    ],
  },
  {
    key: 'mountBoltDiameter',
    label: 'Rear mounting thread',
    type: 'select',
    group: 'Fasteners',
    options: [
      { value: '6', label: 'M6' },
      { value: '8', label: 'M8' },
    ],
  },
];
