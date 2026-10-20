import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = {
  mode: 'path',
  coilRadius: 2.2,
  coilHeight: 22.1,
  turns: 7,
  path: JSON.stringify([
    [0, 0, 0],
    [0, 0, 10],
    [2, 0, 15],
    [7, 0, 18],
  ]),
  wireDiameter: 0.7,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'mode',
    label: 'Wire definition',
    type: 'select',
    group: 'Definition',
    options: [
      { value: 'path', label: 'Centreline' },
      { value: 'helix', label: 'Uniform helix' },
    ],
  },
  ...[
    { key: 'coilRadius', label: 'Mean coil radius', unit: 'mm', min: 0.1, max: 10000, step: 0.1 },
    { key: 'coilHeight', label: 'Coil height', unit: 'mm', min: 0.1, max: 100000, step: 0.1 },
    { key: 'turns', label: 'Turns', unit: '', min: 0.25, max: 128, step: 0.25 },
  ].map((field): ParameterDefinition => ({
    ...field,
    type: 'number',
    group: 'Coil',
    visibleWhen: (p) => p.mode === 'helix',
  })),
  {
    key: 'path',
    label: 'Local wire centreline',
    type: 'text',
    group: 'Definition',
    visibleWhen: () => false,
  },
  {
    key: 'wireDiameter',
    label: 'Wire diameter',
    type: 'number',
    unit: 'mm',
    min: 0.1,
    max: 20,
    step: 0.1,
    group: 'Wire',
  },
];
