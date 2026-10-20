import type { ParameterDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'teyu-cw3000-tgty' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Purchased cooling equipment',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
];
