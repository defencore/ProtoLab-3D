import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { form: 'hooke', diameter: 30, shaft: 8, length: 70 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'form',
    label: 'Joint form',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'hooke', label: 'Hooke universal joint' },
      { value: 'ball', label: 'Ball and socket' },
    ],
  },
  {
    key: 'diameter',
    label: 'Joint diameter',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'shaft',
    label: 'Shaft diameter',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'length',
    label: 'Overall length',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
];
