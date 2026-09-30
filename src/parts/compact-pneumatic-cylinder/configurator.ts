import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { bore: '50', stroke: '25', extension: 25 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'bore',
    label: 'ACE bore',
    type: 'select',
    group: 'Model',
    options: [
      { value: '32', label: '32 mm' },
      { value: '50', label: '50 mm' },
    ],
  },
  {
    key: 'stroke',
    label: 'Cylinder stroke',
    type: 'select',
    group: 'Model',
    options: [
      { value: '25', label: '25 mm' },
      { value: '50', label: '50 mm' },
      { value: '100', label: '100 mm' },
      { value: '200', label: '200 mm' },
    ],
  },
  {
    key: 'extension',
    label: 'Rod extension',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 200,
    step: 0.1,
    group: 'Pose',
    filterable: false,
  },
];
