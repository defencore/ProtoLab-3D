import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('diameter', 'Open canopy diameter', 'D', 'Canopy envelope', 100, 5000),
  numberParameter('rise', 'Unvented apex rise', 'H', 'Canopy envelope', 10, 2500),
  {
    ...numberParameter(
      'thickness',
      'Axial fabric reference thickness',
      't',
      'Canopy envelope',
      0.05,
      5,
    ),
    step: 0.05,
  },
  numberParameter('ventDiameter', 'Central vent diameter', 'd', 'Canopy envelope', 0, 2000),
];

export const defaults: Parameters = { diameter: 600, rise: 250, thickness: 0.15, ventDiameter: 30 };
