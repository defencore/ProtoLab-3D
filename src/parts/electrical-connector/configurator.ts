import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'xt60-m', detail: 'envelope' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'AMASS connector model',
    type: 'select',
    group: 'Connector selection',
    options: models.map((m) => ({
      value: m.id,
      label: `${m.name} · ${m.sex === 'M' ? 'Male pins' : 'Female sockets'}`,
    })),
    description: 'Fixed manufacturer outline dimensions. M/F describes the metal contacts.',
  },
  {
    key: 'detail',
    label: 'Model detail',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'envelope', label: 'Assembly · housing and contacts' },
      { value: 'detailed', label: 'Detailed · grip and contact slots' },
    ],
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(['family', 'sex'] as const).map((key) => ({
    key,
    label: key === 'family' ? 'Connector series' : 'Contact type',
    type: 'select' as const,
    group: 'Connector selection',
    catalogSummary: true,
    options: [...new Set(models.map((m) => m[key]))].map((value) => ({
      value,
      label: value === 'M' ? 'M · Male pins' : value === 'F' ? 'F · Female sockets' : value,
    })),
  })),
  ...(['pins', 'width', 'height', 'length'] as const).map((key) => ({
    key,
    label: key === 'pins' ? 'Contacts' : `Overall ${key}`,
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    max: 50,
    step: 0.01,
    unit: key === 'pins' ? '' : 'mm',
    catalogSummary: true,
  })),
];
