import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { recipe: '{"kind":"box","size":[20,30,10],"origin":[0,0,0]}' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'recipe',
    label: 'Local authored features',
    type: 'text',
    group: 'Definition',
    visibleWhen: () => false,
  },
];
