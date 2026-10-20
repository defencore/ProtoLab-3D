import type { ParameterDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'atv12hu22m2', panelThickness: 4 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'panelThickness',
    label: 'Installed panel thickness',
    type: 'number',
    min: 1,
    max: 6,
    step: 0.1,
    unit: 'mm',
    group: 'Mounting',
    filterable: false,
    visibleWhen: (p) => p.model === 'xb5as8444',
  },
  {
    key: 'model',
    label: 'Catalog component',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
];
