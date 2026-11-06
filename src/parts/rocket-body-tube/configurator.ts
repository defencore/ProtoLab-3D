import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 20, 600),
  numberParameter('wall', 'Wall thickness', 't', 'Dimensions', 0.25, 25),
  numberParameter('length', 'Tube length', 'L', 'Dimensions', 20, 3000),
];
export const defaults: Parameters = { outerDiameter: 100, wall: 2.5, length: 1200 };
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
