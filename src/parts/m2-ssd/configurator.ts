import type { ParameterDefinition, Parameters } from '../../core/types';
export const parameters: ParameterDefinition[] = [
  {
    key: 'format',
    label: 'M.2 module format',
    group: 'Module',
    type: 'select',
    options: [
      { value: '2230', label: '2230 · 22 × 30 mm' },
      { value: '2242', label: '2242 · 22 × 42 mm' },
      { value: '2280', label: '2280 · 22 × 80 mm' },
    ],
  },
];
export const defaults: Parameters = { format: '2280' };
