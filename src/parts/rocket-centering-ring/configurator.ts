import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 20, 600),
  numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 598),
  numberParameter('thickness', 'Plate thickness', 't', 'Dimensions', 1, 40),
];
export const defaults: Parameters = { outerDiameter: 94.5, bore: 54.5, thickness: 8 };
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
