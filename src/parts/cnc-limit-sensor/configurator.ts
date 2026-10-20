import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { model: 'e2b-m12' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Purchased limit sensor',
    type: 'select',
    group: 'Model',
    options: [{ value: 'e2b-m12', label: 'OMRON E2B-M12KS04-WP-B1 2M' }],
  },
];
