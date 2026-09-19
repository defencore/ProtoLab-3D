import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';
export const defaults: Parameters = {
  layout: 'band',
  diameter: 90,
  bore: 86,
  segments: 16,
  release: 0,
  separation: 25,
  springs: true,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'layout',
    label: 'Clamp arrangement',
    group: 'Mechanism',
    type: 'select',
    options: [
      { value: 'band', label: 'Split tension band · V-clamp blocks' },
      { value: 'pivot', label: 'Captive pivoting segments · inner actuation ring' },
    ],
  },
  numberParameter('diameter', 'Interface outside diameter', 'D', 'Interface', 90, 240, 1),
  numberParameter('bore', 'Clear passage diameter', 'd', 'Interface', 60, 230, 1),
  {
    key: 'segments',
    label: 'Clamp segments',
    group: 'Mechanism',
    type: 'number',
    min: 12,
    max: 24,
    step: 2,
    unit: '',
  },
  {
    key: 'release',
    label: 'Release sequence',
    visibleWhen: (_p, state) => state !== 'released',
    group: 'Motion',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    description:
      'The latch clears first, then the clamps open; 55–100% lifts the upper interface. The sequence represents position, not time or force.',
  },
  numberParameter('separation', 'Separated display distance', 's', 'Motion', 10, 80, 1),
  { key: 'springs', label: 'Show spring stations', group: 'Display', type: 'boolean' },
];
