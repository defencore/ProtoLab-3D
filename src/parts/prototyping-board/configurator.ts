import type { ParameterDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';

export const defaults: Parameters = { model: 'py-10x10cm' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Board model',
    type: 'select',
    group: 'Board',
    options: models.map((model) => ({ value: model.id, label: model.name })),
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'sides',
    label: 'Copper sides',
    type: 'select',
    group: 'Board selection',
    options: ['Single sided', 'Double sided'].map((value) => ({ value, label: value })),
    catalogSummary: true,
  },
  ...(
    [
      ['length', 'Length', 'mm'],
      ['width', 'Width', 'mm'],
      ['thickness', 'Published thickness', 'mm'],
      ['pitch', 'Hole pitch', 'mm'],
      ['holeDiameter', 'Published hole diameter', 'mm'],
      ['mountDiameter', 'Published mounting hole', 'mm'],
      ['holes', 'Grid holes', ''],
    ] as const
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Board dimensions',
    min: 0,
    step: key === 'holes' ? 1 : 0.01,
    catalogSummary: key === 'pitch',
  })),
];
