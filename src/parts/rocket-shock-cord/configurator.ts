import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('length', 'Straight reference length', 'L', 'Cord envelope', 100, 20000),
  {
    ...numberParameter('diameter', 'Reference cord diameter', 'D', 'Cord envelope', 0.5, 25),
    step: 0.1,
  },
];
export const defaults: Parameters = { length: 3000, diameter: 3 };
