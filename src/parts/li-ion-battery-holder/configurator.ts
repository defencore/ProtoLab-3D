import type { Parameters, ParameterDefinition } from '../../core/types';
import models from './lib/models.json';

export const defaults: Parameters = { model: 'beilamoo-4s' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Holder model',
    type: 'select',
    group: 'Holder',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
];

export const catalogFilterFields: ParameterDefinition[] = [
  ...(
    [
      ['manufacturer', 'Manufacturer', ['BeiLaMoo', 'MPD']],
      ['connection', 'Connection', ['2S1P', '3S1P', '4S1P', 'Independent']],
      ['termination', 'Terminals', ['Wire leads', 'PC pins']],
      ['format', 'Cell format', ['18650']],
    ] as const
  ).map(([key, label, options]) => ({
    key,
    label,
    type: 'select' as const,
    group: 'Holder selection',
    options: options.map((value) => ({ value, label: value })),
    catalogSummary: key === 'connection' || key === 'termination',
  })),
  ...(
    [
      ['cells', 'Cell count', ''],
      ['length', 'Body length', 'mm'],
      ['width', 'Body width', 'mm'],
      ['bodyHeight', 'Body height', 'mm'],
      ['mountDiameter', 'Verified mounting hole', 'mm'],
      ['pinExtension', 'PCB pin extension', 'mm'],
    ] as const
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    step: key === 'cells' ? 1 : 0.01,
    catalogSummary: key === 'cells',
  })),
];
