import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'jhe20b' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'jhe20b', label: 'Recovery buzzer JHE20B' }],
  },
];
