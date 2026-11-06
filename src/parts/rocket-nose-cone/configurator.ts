import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  {
    key: 'profile',
    label: 'Nose profile',
    type: 'select',
    group: 'Profile',
    options: [
      { value: 'conical', label: 'Conical' },
      { value: 'elliptical', label: 'Elliptical' },
      { value: 'tangent-ogive', label: 'Tangent ogive' },
    ],
  },
  numberParameter('baseDiameter', 'Base outside diameter', 'D', 'Profile', 15, 600),
  numberParameter('length', 'Nose length', 'L', 'Profile', 15, 1500),
  { key: 'solid', label: 'Filled nose and shoulder', type: 'boolean', group: 'Construction' },
  {
    ...numberParameter('wall', 'Cavity radial and end allowance', 't', 'Construction', 0.5, 20),
    visibleWhen: (p) => !p.solid,
  },
  numberParameter(
    'shoulderLength',
    'Shoulder length (zero omits shoulder)',
    's',
    'Shoulder',
    0,
    300,
  ),
  {
    ...numberParameter('shoulderDiameter', 'Shoulder outside diameter', 'd', 'Shoulder', 10, 599),
    visibleWhen: (p) => Number(p.shoulderLength) > 0,
  },
];

export const defaults: Parameters = {
  profile: 'tangent-ogive',
  baseDiameter: 100,
  length: 300,
  solid: false,
  wall: 2.5,
  shoulderDiameter: 94.5,
  shoulderLength: 60,
};

export const catalogSelection = [];
