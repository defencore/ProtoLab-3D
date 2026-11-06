import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  {
    key: 'shape',
    label: 'Planform',
    type: 'select',
    group: 'Fin shape',
    options: [
      { value: 'trapezoidal', label: 'Trapezoidal' },
      { value: 'elliptical', label: 'Elliptical' },
      { value: 'freeform', label: 'Freeform polygon' },
    ],
  },
  {
    ...numberParameter('rootChord', 'Root chord', 'C', 'Planform', 1, 1000),
    visibleWhen: (p) => p.shape !== 'freeform',
  },
  {
    ...numberParameter('tipChord', 'Tip chord', 'c', 'Planform', 1, 1000),
    visibleWhen: (p) => p.shape === 'trapezoidal',
  },
  {
    ...numberParameter('span', 'Radial span', 's', 'Planform', 1, 1000),
    visibleWhen: (p) => p.shape !== 'freeform',
  },
  {
    ...numberParameter('sweep', 'Tip leading-edge offset', 'a', 'Planform', -1000, 1000),
    visibleWhen: (p) => p.shape === 'trapezoidal',
  },
  {
    key: 'points',
    label: 'Outline points: JSON [x, y] pairs',
    type: 'text',
    group: 'Freeform outline',
    description:
      'Millimetres in the fin plane. List each corner once; the outline closes automatically.',
    filterable: false,
    visibleWhen: (p) => p.shape === 'freeform',
  },
  numberParameter('thickness', 'Plate thickness', 't', 'Construction', 0.2, 30),
];

export const defaults: Parameters = {
  shape: 'trapezoidal',
  rootChord: 120,
  tipChord: 50,
  span: 60,
  sweep: 30,
  points: '[[0,0],[140,0],[105,25],[65,75],[20,60]]',
  thickness: 3,
};
