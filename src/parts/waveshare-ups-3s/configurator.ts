import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = { model: 'ups-module-3s' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module',
    type: 'select',
    group: 'Model',
    options: [{ value: 'ups-module-3s', label: 'Waveshare UPS Module 3S · bare holder' }],
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'boardLength',
    label: 'PCB length',
    type: 'number',
    unit: 'mm',
    group: 'Dimensions',
    catalogSummary: true,
  },
  {
    key: 'boardWidth',
    label: 'PCB width',
    type: 'number',
    unit: 'mm',
    group: 'Dimensions',
    catalogSummary: true,
  },
  {
    key: 'outputCurrent',
    label: 'Published 5 V output current',
    type: 'number',
    unit: 'A',
    group: 'Electrical',
    catalogSummary: true,
  },
];
