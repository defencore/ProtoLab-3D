import type { Parameters, ParameterDefinition } from '../../core/types';
import { spindleSpecs } from './lib/specs';
export const defaults: Parameters = { model: 'jst-2200-water-80' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Spindle drawing execution',
    type: 'select',
    group: 'Supplier component',
    options: spindleSpecs.map((s) => ({ value: s.id, label: s.name })),
    description:
      'Manufacturer-derived installation model; these executions are not confirmed factory-supplied machine SKUs.',
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'power',
    label: 'Rated spindle power',
    type: 'number',
    unit: 'W',
    min: 1500,
    max: 3000,
    step: 100,
    group: 'Published characteristics',
    catalogSummary: true,
  },
  {
    key: 'cooling',
    label: 'Cooling',
    type: 'select',
    group: 'Published characteristics',
    catalogSummary: true,
    options: [
      { value: 'water', label: 'Water cooled' },
      { value: 'air', label: 'Air cooled' },
    ],
  },
  {
    key: 'bodyDiameter',
    label: 'Body diameter',
    type: 'number',
    unit: 'mm',
    min: 65,
    max: 100,
    step: 1,
    group: 'Published dimensions',
    catalogSummary: true,
  },
  {
    key: 'bodyLength',
    label: 'Body length',
    type: 'number',
    unit: 'mm',
    min: 200,
    max: 260,
    step: 0.1,
    group: 'Published dimensions',
    catalogSummary: true,
  },
  {
    key: 'collet',
    label: 'Tool collet',
    type: 'select',
    group: 'Published characteristics',
    catalogSummary: true,
    options: [
      { value: 'ER11', label: 'ER11' },
      { value: 'ER20', label: 'ER20' },
    ],
  },
];
