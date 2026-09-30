import type { ParameterDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'atv12hu22m2' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Catalog component',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
];
