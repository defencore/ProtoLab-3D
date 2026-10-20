import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { material: 'steel', outerDiameter: 4, bore: 2.1, length: 10 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'material',
    label: 'Material / finish',
    type: 'select',
    group: 'Custom order',
    options: [
      { value: 'steel', label: 'Steel / zinc plated' },
      { value: 'brass', label: 'Brass / nickel plated' },
      { value: 'aluminium', label: 'Aluminium / self finish' },
      { value: 'stainless-steel', label: 'Stainless steel / self finish' },
    ],
  },
  {
    key: 'outerDiameter',
    label: 'Outside diameter',
    type: 'number',
    group: 'Requested dimensions',
    unit: 'mm',
    min: 4,
    max: 36,
    step: 0.1,
  },
  {
    key: 'bore',
    label: 'Through bore',
    type: 'number',
    group: 'Requested dimensions',
    unit: 'mm',
    min: 0.1,
    max: 35.9,
    step: 0.1,
  },
  {
    key: 'length',
    label: 'Body length',
    type: 'number',
    group: 'Requested dimensions',
    unit: 'mm',
    min: 1,
    max: 60,
    step: 0.1,
  },
];
export const catalogSelection = [];
