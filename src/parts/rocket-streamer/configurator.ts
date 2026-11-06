import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('length', 'Unfolded strip length', 'L', 'Strip envelope', 100, 5000),
  numberParameter('width', 'Strip width', 'W', 'Strip envelope', 10, 500),
  {
    ...numberParameter('thickness', 'Reference sheet thickness', 't', 'Strip envelope', 0.02, 2),
    step: 0.01,
  },
];
export const defaults: Parameters = { length: 1000, width: 100, thickness: 0.1 };
