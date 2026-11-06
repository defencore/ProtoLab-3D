import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('foreDiameter', 'Forward outside diameter', 'Df', 'Transition', 10, 600),
  numberParameter('aftDiameter', 'Aft outside diameter', 'Da', 'Transition', 10, 600),
  numberParameter('length', 'Transition length', 'L', 'Transition', 5, 1500),
  numberParameter('wall', 'Radial wall thickness', 't', 'Transition', 0.5, 25),
];

export const defaults: Parameters = { foreDiameter: 75, aftDiameter: 100, length: 120, wall: 2.5 };
export const catalogSelection = [];
