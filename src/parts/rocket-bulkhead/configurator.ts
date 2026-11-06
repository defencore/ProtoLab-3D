import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('diameter', 'Outside diameter', 'D', 'Dimensions', 20, 600),
  numberParameter('holeDiameter', 'Central clearance hole', 'd', 'Dimensions', 0, 580),
  numberParameter('thickness', 'Plate thickness', 't', 'Dimensions', 1, 40),
];
export const defaults: Parameters = { diameter: 94.5, holeDiameter: 6.5, thickness: 8 };
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
