import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';
import data from './lib/models.json';
export const defaults: Parameters = { model: 'pomona-4243-0' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Terminal model',
    type: 'select',
    group: 'Terminal selection',
    options: data.map((m) => ({ value: m.id, label: m.name })),
    description: 'Choose an existing supplier model with fixed dimensions.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(['manufacturer', 'connection', 'mount'] as const).map((key) => ({
    key,
    label: { manufacturer: 'Manufacturer', connection: 'Connection type', mount: 'Mounting' }[key],
    type: 'select' as const,
    group: 'Terminal selection',
    catalogSummary: true,
    options: [...new Set(data.map((m) => m[key === 'connection' ? 'kind' : key]))].map((value) => ({
      value,
      label: value.replaceAll('-', ' '),
    })),
  })),
  ...(
    [
      ['contacts', 'Wire entries / contacts', ''],
      ['contactDiameter', 'Banana contact', 'mm'],
      ['terminalPitch', 'Terminal pitch', 'mm'],
      ['cutoutDiameter', 'Panel hole diameter', 'mm'],
      ['mountPitch', 'Mounting hole pitch', 'mm'],
      ['mountHole', 'Mounting hole diameter', 'mm'],
      ['width', 'Published width', 'mm'],
      ['depth', 'Published depth', 'mm'],
      ['length', 'Published length / height', 'mm'],
    ] as const
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    step: 0.01,
    catalogSummary: ['contacts', 'contactDiameter', 'terminalPitch'].includes(key),
  })),
];
