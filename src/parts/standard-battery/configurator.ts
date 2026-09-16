import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'energizer-e96' };
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
        value: 'Energizer',
        label: 'Energizer',
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
        value: 'AAAA',
        label: 'AAAA',
      },
      {
        value: 'AAA',
        label: 'AAA',
      },
      {
        value: 'AA',
        label: 'AA',
      },
      {
        value: 'CR123A',
        label: 'CR123A',
      },
      {
        value: 'C',
        label: 'C',
      },
      {
        value: 'D',
        label: 'D',
      },
      {
        value: '9V PP3',
        label: '9V PP3',
      },
      {
        value: 'CR2032',
        label: 'CR2032',
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
        value: 'Alkaline',
        label: 'Alkaline',
      },
      {
        value: 'Lithium primary',
        label: 'Lithium primary',
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
        value: 'Button top',
        label: 'Button top',
      },
      {
        value: 'Miniature snap',
        label: 'Miniature snap',
      },
      {
        value: 'Coin contacts',
        label: 'Coin contacts',
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
    max: 1500,
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
    max: 9,
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
    max: 1.5,
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
    max: 34.2,
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
    max: 34.2,
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
    max: 34.2,
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
    max: 61.5,
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
    max: 139,
    step: 1,
    catalogSummary: false,
  },
];
