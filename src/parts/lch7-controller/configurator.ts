import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'lch7-v3-2' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'lch7-v3-2', label: 'LCH7 v3.2' }],
  },
];
