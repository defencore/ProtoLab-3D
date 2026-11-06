import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'syla-lr2170la-4s1p-xt60' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Model',
    type: 'select',
    group: 'Model',
    options: [
      { value: 'syla-lr2170la-4s1p-xt60', label: 'SYLA Lishen LR2170LA \u00b7 4S1P \u00b7 XT60' },
    ],
    description:
      'Fixed supplier execution; review the documented geometry evidence before designing interfaces.',
  },
];
