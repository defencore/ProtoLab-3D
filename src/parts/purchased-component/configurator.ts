import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  meshConform: false,
  nativeRefine: true,
  meshEdgeTolerance: 0.01,
  meshMinimumTriangleArea: 5e-8,
  recipe: JSON.stringify({ kind: 'box', size: [40, 20, 15], origin: [0, 0, 0] }),
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
    label: 'Supplier installation geometry',
    type: 'text',
    group: 'Definition',
    visibleWhen: () => false,
  },
];
