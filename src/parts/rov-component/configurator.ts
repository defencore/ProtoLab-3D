import type { ParameterDefinition, Parameters } from '../../core/types';
import { models } from './lib/model';

export const defaults: Parameters = { component: models[0]?.id ?? '' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Original project part',
    group: 'Source component',
    type: 'select',
    options: models.map((model) => ({
      value: model.id,
      label: `${model.projectName} · ${model.label}`,
    })),
  },
];
export const catalogSelection = [];
