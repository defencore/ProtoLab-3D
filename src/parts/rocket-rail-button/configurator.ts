import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('flangeDiameter', 'Flange diameter', 'D', 'Rail interface', 6, 30),
  numberParameter('neckDiameter', 'Groove root diameter', 'd', 'Rail interface', 3, 24),
  numberParameter('height', 'Overall height', 'H', 'Rail interface', 4, 30),
  numberParameter('flangeThickness', 'Each flange thickness', 't', 'Rail interface', 0.8, 8),
  numberParameter('bore', 'Screw clearance bore', 'b', 'Mounting', 2, 12),
  numberParameter('counterbore', 'Screw head recess diameter', 'C', 'Mounting', 3, 20),
  numberParameter('counterboreDepth', 'Screw head recess depth', 'h', 'Mounting', 0.5, 6),
];

export const defaults: Parameters = {
  flangeDiameter: 10,
  neckDiameter: 6,
  height: 9.7,
  flangeThickness: 2.5,
  bore: 3.4,
  counterbore: 6.2,
  counterboreDepth: 1.5,
};

export const catalogSelection = [];
