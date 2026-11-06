import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'ma32x50-sca', extension: 0 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Cylinder model',
    type: 'select',
    group: 'Model',
    options: models.map((model) => ({ value: model.id, label: model.name })),
  },
  {
    key: 'extension',
    label: 'Rod extension',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 100,
    step: 0.1,
    group: 'Assembly position',
    filterable: false,
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'bore',
    label: 'Piston bore',
    type: 'number',
    unit: 'mm',
    group: 'Cylinder selection',
    min: 0,
    max: 32,
    step: 1,
    catalogSummary: true,
  },
  {
    key: 'stroke',
    label: 'Stroke',
    type: 'number',
    unit: 'mm',
    group: 'Cylinder selection',
    min: 0,
    max: 100,
    step: 1,
    catalogSummary: true,
  },
];
