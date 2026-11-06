import type { Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters = [
  numberParameter('width', 'Plate width', 'W', 'Plate', 20, 250),
  numberParameter('length', 'Plate length', 'L', 'Plate', 40, 600),
  numberParameter('thickness', 'Plate thickness', 't', 'Plate', 1, 15),
  numberParameter('pitchX', 'Mounting hole transverse pitch', 'Px', 'Mounting', 5, 220),
  numberParameter('pitchY', 'Mounting hole longitudinal pitch', 'Py', 'Mounting', 5, 560),
  numberParameter('holeDiameter', 'Mounting clearance hole', 'd', 'Mounting', 1.5, 12),
];

export const defaults: Parameters = {
  width: 60,
  length: 180,
  thickness: 3,
  pitchX: 40,
  pitchY: 140,
  holeDiameter: 3.4,
};
