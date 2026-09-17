import type { Parameters, ParameterDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: '06L...HL 64:1' };
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
        value: '06L...HL',
        label: '06L...HL',
      },
      {
        value: '06L...SL',
        label: '06L...SL',
      },
      {
        value: '08L...HL',
        label: '08L...HL',
      },
      {
        value: '08L...SL',
        label: '08L...SL',
      },
      {
        value: '10L...HL',
        label: '10L...HL',
      },
      {
        value: '10L...SL',
        label: '10L...SL',
      },
      {
        value: '22L...ML',
        label: '22L...ML',
      },
      {
        value: '22L...PB',
        label: '22L...PB',
      },
      {
        value: '22L...SB',
        label: '22L...SB',
      },
      {
        value: '32L...ML',
        label: '32L...ML',
      },
      {
        value: '32L...PB',
        label: '32L...PB',
      },
      {
        value: '32L...SB',
        label: '32L...SB',
      },
      {
        value: '32L...TL',
        label: '32L...TL',
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
    key: 'screwLength',
    label: 'Standard screw length',
    group: 'Specifications',
    catalogSummary: false,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'mm',
  },
  {
    key: 'screwType',
    label: 'Screw specification',
    group: 'Specifications',
    catalogSummary: false,
    type: 'select',
    options: [
      {
        value: '10 × 2 IT1',
        label: '10 × 2 IT1',
      },
      {
        value: '10 × 2 IT3',
        label: '10 × 2 IT3',
      },
      {
        value: '3 × 0.5 proprietary',
        label: '3 × 0.5 proprietary',
      },
      {
        value: '6 × 2 IT1',
        label: '6 × 2 IT1',
      },
      {
        value: '6 × 2 IT3',
        label: '6 × 2 IT3',
      },
      {
        value: 'M10 × 1',
        label: 'M10 × 1',
      },
      {
        value: 'M6 × 1',
        label: 'M6 × 1',
      },
      {
        value: 'Tr10 × 2',
        label: 'Tr10 × 2',
      },
    ],
  },
  {
    key: 'continuousForce',
    label: 'Continuous force up to',
    group: 'Specifications',
    catalogSummary: true,
    type: 'number',
    min: 0,
    max: 100000,
    step: 0.001,
    unit: 'N',
  },
];
