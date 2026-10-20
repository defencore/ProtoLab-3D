import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';
import catalog from './lib/catalog.json';
export const defaults: Parameters = { model: 'ugv-rover', explodedGap: 25 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Chassis model',
    type: 'select',
    group: 'Chassis',
    options: catalog.map((m) => ({ value: m.id, label: m.name })),
  },
  {
    key: 'explodedGap',
    label: 'Inspection separation',
    type: 'number',
    min: 10,
    max: 60,
    step: 5,
    unit: 'mm',
    group: 'Inspection',
    filterable: false,
    visibleWhen: (_, state) => state === 'exploded',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
