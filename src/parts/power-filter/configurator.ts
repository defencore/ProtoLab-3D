import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'iflight-lc-filter-16x6' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Model',
    type: 'select',
    group: 'Model',
    options: [
      {
        value: 'iflight-lc-filter-16x6',
        label: 'iFlight LC Filter \u00b7 16 \u00d7 6 seller version \u00b7 reference',
      },
    ],
    description:
      'Fixed supplier execution; review the documented geometry evidence before designing interfaces.',
  },
];
