import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('flangeDiameter', 'Flange outside diameter', 'D', 'Outside envelope', 8, 100),
  numberParameter('domeDiameter', 'Dome base diameter', 'd', 'Outside envelope', 5, 95),
  numberParameter('height', 'Overall height', 'H', 'Outside envelope', 2, 50),
  numberParameter(
    'flangeThickness',
    'Assumed flange thickness',
    'f',
    'Construction assumptions',
    0.2,
    5,
  ),
  numberParameter(
    'wall',
    'Assumed spherical shell thickness',
    't',
    'Construction assumptions',
    0.2,
    5,
  ),
];

export const defaults: Parameters = {
  flangeDiameter: 23,
  domeDiameter: 17,
  height: 6,
  flangeThickness: 1,
  wall: 1,
};
