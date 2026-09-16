import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'molicel-p28a' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Battery model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Fixed manufactured dimensions. Select a model by format, capacity and electrical ratings.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Battery selection',
    options: [
      {
        value: 'Molicel',
        label: 'Molicel',
      },
    ],
  },
  {
    key: 'format',
    label: 'Cell format / series',
    type: 'select',
    group: 'Battery selection',
    options: [
      {
        value: '18650',
        label: '18650',
      },
      {
        value: '21700',
        label: '21700',
      },
    ],
  },
  {
    key: 'chemistry',
    label: 'Chemistry',
    type: 'select',
    group: 'Battery selection',
    options: [
      {
        value: 'Li-ion',
        label: 'Li-ion',
      },
    ],
  },
  {
    key: 'connection',
    label: 'Terminal / connection',
    type: 'select',
    group: 'Battery selection',
    options: [
      {
        value: 'Flat top',
        label: 'Flat top',
      },
    ],
  },
  {
    key: 'capacity',
    label: 'Capacity',
    unit: 'mAh',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 5000,
    step: 1,
    catalogSummary: true,
  },
  {
    key: 'voltage',
    label: 'Nominal voltage',
    unit: 'V',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 3.6,
    step: 0.01,
    catalogSummary: true,
  },
  {
    key: 'current',
    label: 'Manufacturer discharge rating',
    unit: 'A',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 60,
    step: 0.01,
    catalogSummary: true,
  },
  {
    key: 'diameter',
    label: 'Maximum diameter',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 21.7,
    step: 0.01,
    catalogSummary: false,
  },
  {
    key: 'width',
    label: 'Pack width / envelope X',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 21.7,
    step: 0.01,
    catalogSummary: false,
  },
  {
    key: 'length',
    label: 'Pack length / envelope Y',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 21.7,
    step: 0.01,
    catalogSummary: false,
  },
  {
    key: 'height',
    label: 'Height / envelope Z',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 70.2,
    step: 0.01,
    catalogSummary: false,
  },
  {
    key: 'weight',
    label: 'Weight',
    unit: 'g',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 71,
    step: 1,
    catalogSummary: false,
  },
];
