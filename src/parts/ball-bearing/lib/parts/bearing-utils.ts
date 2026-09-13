import { n, numberParameter } from '../../../../core/geometry';
import type { ParameterDefinition, Parameters } from '../../../../core/types';

export const bearingParameters: ParameterDefinition[] = [
  numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 500),
  numberParameter('outer', 'Outer diameter', 'D', 'Dimensions', 3, 1000),
  numberParameter('width', 'Width', 'B', 'Dimensions', 1, 300),
];

export const assemblyStates = [
  {
    id: 'assembled',
    label: 'Assembled',
    description: 'Nominal component positions for integration.',
  },
  {
    id: 'exploded',
    label: 'Exploded',
    description: 'Races separated along Z to inspect the rolling elements.',
  },
];

export function validateBearing(p: Parameters): string[] {
  return n(p, 'outer') <= n(p, 'bore') + 2
    ? ['Outer diameter must exceed the bore by more than 2 mm.']
    : [];
}

export function radialSizes(p: Parameters) {
  const bore = n(p, 'bore') / 2;
  const outer = n(p, 'outer') / 2;
  const width = n(p, 'width');
  const wall = (outer - bore) * 0.27;
  const pitchRadius = (outer + bore) / 2;
  const ballRadius = (outer - bore) * 0.225;
  return { bore, outer, width, wall, pitchRadius, ballRadius };
}
