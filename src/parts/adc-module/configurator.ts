import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'cjmcu-1220' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'cjmcu-1220', label: 'CJMCU-1220 ADS1220 \u00b7 installation reference' }],
    description:
      'Fixed supplier execution; review the documented geometry evidence before designing interfaces.',
  },
];
