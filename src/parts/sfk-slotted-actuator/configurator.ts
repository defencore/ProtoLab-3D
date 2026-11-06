import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = { motorModel: '361-12', outputAngle: 0 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'motorModel',
    label: 'Gearmotor',
    type: 'select',
    group: 'Drive',
    options: [
      { value: '361-12', label: '361:1 · 12 V' },
      { value: '107-12', label: '107:1 · 12 V' },
      { value: '361-24', label: '361:1 · 24 V' },
      { value: '107-24', label: '107:1 · 24 V' },
    ],
  },
  {
    key: 'outputAngle',
    label: 'Output shaft angle',
    type: 'number',
    group: 'Motion',
    unit: '°',
    min: -20,
    max: 20,
    step: 1,
    filterable: false,
    description: 'Moves the original nut yoke and rollers along the two slotted cranks.',
  },
];
