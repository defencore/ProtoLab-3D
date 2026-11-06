import type { Parameters, ParameterDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: models[0].id };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Select the fixed supplier execution; read the geometry evidence before defining a mounting interface.',
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'function',
    label: 'Function',
    type: 'select',
    group: 'Supplier characteristics',
    options: models.map((m) => ({ value: m.kind, label: m.kind })),
  },
];
