import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { recipe: '{"kind":"springBarrel","travel":8}' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'recipe',
    label: 'Local authored features',
    type: 'text',
    group: 'Definition',
    visibleWhen: () => false,
  },
];
