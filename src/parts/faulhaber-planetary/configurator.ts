import type { Parameters, ParameterDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: '06/1 4:1' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Manufacturer model',
    type: 'select',
    group: 'Catalogue',
    options: models.map((m) => ({ value: m.model, label: m.model })),
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'series',
    label: 'Series',
    group: 'Specifications',
    catalogSummary: true,
    type: 'select',
    options: [
      {
        value: '06/1',
        label: '06/1',
      },
      {
        value: '08/1',
        label: '08/1',
      },
      {
        value: '10/1',
        label: '10/1',
      },
      {
        value: '12/4',
        label: '12/4',
      },
      {
        value: '13A',
        label: '13A',
      },
      {
        value: '14/1',
        label: '14/1',
      },
      {
        value: '14GPT',
        label: '14GPT',
      },
      {
        value: '15/10',
        label: '15/10',
      },
      {
        value: '15A',
        label: '15A',
      },
      {
        value: '16/7',
        label: '16/7',
      },
      {
        value: '16GPT',
        label: '16GPT',
      },
      {
        value: '17/1',
        label: '17/1',
      },
      {
        value: '20/1R',
        label: '20/1R',
      },
      {
        value: '20GPT',
        label: '20GPT',
      },
      {
        value: '22/7',
        label: '22/7',
      },
      {
        value: '22E',
        label: '22E',
      },
      {
        value: '22EKV',
        label: '22EKV',
      },
      {
        value: '22GPT',
        label: '22GPT',
      },
      {
        value: '22GPT HT',
        label: '22GPT HT',
      },
      {
        value: '22GPT LN',
        label: '22GPT LN',
      },
      {
        value: '23/1',
        label: '23/1',
      },
      {
        value: '26/1R',
        label: '26/1R',
      },
      {
        value: '26A',
        label: '26A',
      },
      {
        value: '30/1',
        label: '30/1',
      },
      {
        value: '30/1S',
        label: '30/1S',
      },
      {
        value: '32/3R',
        label: '32/3R',
      },
      {
        value: '32GPT',
        label: '32GPT',
      },
      {
        value: '32GPT HT',
        label: '32GPT HT',
      },
      {
        value: '32GPT LN',
        label: '32GPT LN',
      },
      {
        value: '38/1',
        label: '38/1',
      },
      {
        value: '38/1S',
        label: '38/1S',
      },
      {
        value: '38/2',
        label: '38/2',
      },
      {
        value: '38/2S',
        label: '38/2S',
      },
      {
        value: '42GPT',
        label: '42GPT',
      },
      {
        value: '44/1',
        label: '44/1',
      },
    ],
  },
  {
    key: 'bodyDiameter',
    label: 'Body diameter',
    group: 'Specifications',
    catalogSummary: true,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'mm',
  },
  {
    key: 'bodyLength',
    label: 'Catalog body length',
    group: 'Specifications',
    catalogSummary: false,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'mm',
  },
  {
    key: 'stages',
    label: 'Gear stages',
    group: 'Specifications',
    catalogSummary: true,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: '',
  },
  {
    key: 'ratio',
    label: 'Reduction ratio · rounded',
    group: 'Specifications',
    catalogSummary: true,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: ':1',
  },
  {
    key: 'continuousTorque',
    label: 'Continuous torque up to',
    group: 'Specifications',
    catalogSummary: true,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'Nm',
  },
  {
    key: 'intermittentTorque',
    label: 'Intermittent torque up to',
    group: 'Specifications',
    catalogSummary: false,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'Nm',
  },
];
