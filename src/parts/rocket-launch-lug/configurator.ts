import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outside diameter', 'D', 'Guide', 3, 40),
  numberParameter('bore', 'Guide rod clearance bore', 'd', 'Guide', 1, 35),
  numberParameter('length', 'Guide length', 'L', 'Guide', 5, 200),
];
export const defaults: Parameters = { outerDiameter: 8, bore: 6.5, length: 40 };
