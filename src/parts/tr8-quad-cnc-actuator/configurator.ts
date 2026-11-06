import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { motorModel: '361-12', angleA: 0, angleB: 0, angleC: 0, angleD: 0 };
export const parameters: ParameterDefinition[] = [
  { key: 'motorModel', label: 'Gearmotors', type: 'select', group: 'Drive', options: [
    { value: '361-12', label: '361:1 · 12 V' }, { value: '107-12', label: '107:1 · 12 V' },
    { value: '361-24', label: '361:1 · 24 V' }, { value: '107-24', label: '107:1 · 24 V' },
  ] },
  ...(['A', 'B', 'C', 'D'] as const).map((id): ParameterDefinition => ({ key: 'angle' + id,
    label: 'Output ' + id, type: 'number', group: 'Independent outputs', unit: '°',
    min: -20, max: 20, step: 1, filterable: false, description: 'Independent output angle; the machined frame stays fixed.' })),
];
