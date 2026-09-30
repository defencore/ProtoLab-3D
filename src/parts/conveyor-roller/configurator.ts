import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { model: '1700', installationLength: 300 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Roller series',
    type: 'select',
    group: 'Model',
    options: [
      { value: '1700', label: 'Interroll 1700 · passive' },
      { value: 'ec5000', label: 'Interroll EC5000 · crowned D50 · 24 V 35 W' },
    ],
  },
  {
    key: 'installationLength',
    label: 'Installation length EL',
    type: 'number',
    unit: 'mm',
    min: 200,
    max: 600,
    step: 1,
    group: 'Dimensions',
    description: 'Clear frame spacing; roller order reference RL = EL - 10 mm.',
  },
];
