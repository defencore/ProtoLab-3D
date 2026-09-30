import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { model: 'lu5h50001' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Blade',
    type: 'select',
    group: 'Model',
    options: [
      { value: 'lu5h50001', label: 'Freud LU5H50001 · 500×4×30 · Z120' },
      { value: 'lu5h50002', label: 'Freud LU5H50002 · 500×4×32 · Z120' },
    ],
  },
];
