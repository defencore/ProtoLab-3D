import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'dsbc-63-500-ppsa-n3', extension: 0 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'dsbc-63-500-ppsa-n3', label: 'Festo DSBC-63-500-PPSA-N3 · 1383643' }],
  },
  {
    key: 'extension',
    label: 'Rod extension',
    type: 'number',
    group: 'Pose',
    unit: 'mm',
    min: 0,
    max: 500,
    step: 1,
    description:
      'Continuous rod pose within the published stroke; mounting geometry remains an installation reference.',
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'bore',
    label: 'Published bore',
    type: 'number',
    group: 'Supplier dimensions',
    unit: 'mm',
    min: 0,
    max: 200,
    step: 1,
    catalogSummary: true,
  },
  {
    key: 'stroke',
    label: 'Published stroke',
    type: 'number',
    group: 'Supplier dimensions',
    unit: 'mm',
    min: 0,
    max: 2000,
    step: 1,
    catalogSummary: true,
  },
];
