import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'pem-current' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Source layout',
    group: 'Model',
    type: 'select',
    options: [{ value: 'pem-current', label: 'Current ZX908 / JHE42B / USB seating layout' }],
  },
];
