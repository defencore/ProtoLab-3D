import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = { focusExtension: 10 };
export const parameters: ParameterDefinition[] = [
  numberParameter('focusExtension', 'Manual-focus lens projection', 'f', 'Lens adjustment', 7, 10),
];
