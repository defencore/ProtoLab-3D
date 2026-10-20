import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'st3215-12v', outputAngle: 0, showHorn: false };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Supplier model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'st3215-12v', label: 'Waveshare ST3215 12 V' }],
  },
  {
    key: 'outputAngle',
    label: 'Output position',
    type: 'number',
    group: 'Position',
    unit: 'deg',
    min: -180,
    max: 180,
    step: 1,
  },
  { key: 'showHorn', label: 'Include supplied horns', type: 'boolean', group: 'Position' },
];
