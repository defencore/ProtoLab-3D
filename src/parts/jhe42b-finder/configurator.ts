import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = { model: 'jhe42b' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Finder model',
    type: 'select',
    group: 'Model',
    options: [
      { value: 'jhe42b', label: 'JHEMCU JHE42B · standard' },
      {
        value: 'jhe42b-project-reference-26x17x15',
        label: 'JHE42B · 26 × 17 × 15 mm',
      },
    ],
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  ...[
    ['bodyLength', 'Published length', 'mm'],
    ['bodyWidth', 'Published width', 'mm'],
    ['bodyHeight', 'Published height', 'mm'],
    ['mass', 'Published mass', 'g'],
    ['alarmLevel', 'Published alarm level', 'dB'],
    ['inputVoltage', 'Nominal power input', 'V'],
  ].map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Supplier data',
    catalogSummary: true,
  })),
];
