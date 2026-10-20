import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { radius: 10, reach: 70, plate: 5, fenceDrop: 8 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'radius',
    label: 'Finished external corner radius',
    type: 'number',
    min: 2,
    max: 45,
    step: 0.1,
    unit: 'mm',
    group: 'Dimensions',
  },
  {
    key: 'reach',
    label: 'Template side length',
    type: 'number',
    min: 35,
    max: 140,
    step: 0.1,
    unit: 'mm',
    group: 'Dimensions',
  },
  {
    key: 'plate',
    label: 'Template thickness',
    type: 'number',
    min: 3,
    max: 12,
    step: 0.1,
    unit: 'mm',
    group: 'Dimensions',
  },
  {
    key: 'fenceDrop',
    label: 'Underside edge-fence depth',
    type: 'number',
    min: 3,
    max: 25,
    step: 0.1,
    unit: 'mm',
    group: 'Dimensions',
  },
];
