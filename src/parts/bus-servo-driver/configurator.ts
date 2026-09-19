import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'waveshare-hat-a' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Servo driver',
    group: 'Model',
    type: 'select',
    options: [{ value: 'waveshare-hat-a', label: 'Waveshare Bus Servo Driver HAT (A) · 27577' }],
  },
];

export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Hardware',
    options: [{ value: 'Waveshare', label: 'Waveshare' }],
  },
  {
    key: 'supplyMin',
    label: 'Minimum input',
    type: 'number',
    group: 'Electrical',
    unit: 'V',
    min: 0,
    max: 30,
    step: 1,
    catalogSummary: true,
  },
  {
    key: 'supplyMax',
    label: 'Maximum input',
    type: 'number',
    group: 'Electrical',
    unit: 'V',
    min: 0,
    max: 30,
    step: 1,
    catalogSummary: true,
  },
];
