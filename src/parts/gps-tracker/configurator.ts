import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'zx908' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'zx908', label: 'GPS tracker ZX908' }],
  },
];
