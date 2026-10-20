import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  meshConform: false,
  nativeRefine: true,
  meshEdgeTolerance: 0.01,
  meshMinimumTriangleArea: 5e-8,
  recipe: JSON.stringify({
    kind: 'subtract',
    children: [
      { kind: 'box', size: [80, 60, 8], origin: [0, 0, 0] },
      { kind: 'cylinder', radius: 4.5, height: 10, origin: [10, 10, -1], axis: 'z' },
      { kind: 'cylinder', radius: 4.5, height: 10, origin: [70, 50, -1], axis: 'z' },
    ],
  }),
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'meshConform',
    label: 'Conform precision mesh junctions',
    type: 'boolean',
    group: 'Definition',
    visibleWhen: () => false,
  },
  {
    key: 'nativeRefine',
    label: 'Refine native CAD seams',
    type: 'boolean',
    group: 'Definition',
    visibleWhen: () => false,
  },
  {
    key: 'meshEdgeTolerance',
    label: 'Mesh edge tolerance',
    type: 'number',
    min: 1e-8,
    max: 0.1,
    step: 1e-8,
    unit: 'mm',
    group: 'Definition',
    visibleWhen: () => false,
  },
  {
    key: 'meshMinimumTriangleArea',
    label: 'Minimum triangle area',
    type: 'number',
    min: 1e-12,
    max: 0.01,
    step: 1e-12,
    unit: 'mm²',
    group: 'Definition',
    visibleWhen: () => false,
  },
  {
    key: 'recipe',
    label: 'Local component geometry',
    type: 'text',
    group: 'Definition',
    visibleWhen: () => false,
  },
];
