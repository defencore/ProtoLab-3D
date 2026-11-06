import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('diameter', 'Outside diameter', 'D', 'Geometry', 3, 150),
  numberParameter('length', 'Axial length', 'L', 'Geometry', 2, 300),
  numberParameter('bore', 'Axial clearance bore (zero for solid)', 'd', 'Geometry', 0, 140),
  {
    ...numberParameter('density', 'Assumed material density', '\u03c1', 'Mass estimate', 0.1, 25),
    unit: 'g/cm\u00b3',
    step: 0.01,
  },
];
export const defaults: Parameters = { diameter: 20, length: 20, bore: 4.5, density: 7.85 };
