import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 15, 590),
  numberParameter('wall', 'Wall thickness', 't', 'Dimensions', 0.25, 25),
  numberParameter('length', 'Sleeve length', 'L', 'Dimensions', 10, 1000),
];
export const defaults: Parameters = { outerDiameter: 94.5, wall: 2.5, length: 200 };
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
