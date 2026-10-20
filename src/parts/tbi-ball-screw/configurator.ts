import type { ParameterDefinition, PartDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = {
  model: 'sfnu01605-4',
  length: 500,
  nutPosition: 50,
  rotation: 0,
};
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Screw and nut model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: 'TBI ' + m.code })),
  },
  {
    key: 'length',
    label: 'Unmachined shaft cut length',
    type: 'number',
    unit: 'mm',
    min: 100,
    max: 2000,
    step: 1,
    group: 'Order dimensions',
    filterable: false,
  },
  {
    key: 'nutPosition',
    label: 'Nut travel position',
    type: 'number',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    group: 'Placement',
    filterable: false,
  },
  {
    key: 'rotation',
    label: 'Screw rotation',
    type: 'number',
    unit: '°',
    min: -360,
    max: 360,
    step: 1,
    group: 'Placement',
    filterable: false,
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'series',
    label: 'Nut series',
    type: 'select',
    group: 'Construction',
    options: ['SFU', 'SFNU', 'SFB'].map((value) => ({ value, label: value })),
    catalogSummary: true,
  },
  ...[
    ['diameter', 'Nominal screw diameter'],
    ['lead', 'Lead per revolution'],
    ['nutLength', 'Nut length'],
    ['nutDiameter', 'Nut body diameter'],
    ['flangeDiameter', 'Flange diameter'],
    ['flangeWidth', 'Width across flange flats'],
    ['flangeThickness', 'Flange thickness'],
    ['mountCircle', 'Mounting pitch circle'],
    ['mountHole', 'Flange mounting hole'],
    ['ballDiameter', 'Ball diameter'],
  ].map(([key, label]) => ({
    key,
    label,
    type: 'number' as const,
    unit: 'mm',
    group: 'Source dimensions',
    catalogSummary: ['diameter', 'lead', 'nutLength', 'flangeDiameter'].includes(key),
  })),
];
