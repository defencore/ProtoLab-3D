import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { form: 'parallel', width: 6, height: 6, length: 25 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'form',
    label: 'Key form',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'parallel', label: 'Parallel square-end key' },
      { value: 'round', label: 'Parallel round-end key' },
      { value: 'woodruff', label: 'Woodruff segment key' },
    ],
  },
  {
    key: 'width',
    label: 'Key width',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'height',
    label: 'Key height',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'length',
    label: 'Key length / disc diameter',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
];
