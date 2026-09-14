import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter as number } from '../../core/geometry';

export const defaults: Parameters = {
  profileMode: 'standard',
  module: 0.8,
  teeth: 20,
  pressureAngle: 20,
  backlash: 0,
  faceWidth: 6,
  hub: false,
  hubDiameter: 11,
  hubExtension: 2,
  splineTeeth: 24,
  splineMajor: 5.9,
  splineMinor: 5.3,
  splineAngle: 0,
  socket: 'blind',
  socketDepth: 3,
  screwBore: 3,
  counterbore: true,
  counterboreDiameter: 6.4,
  counterboreDepth: 1,
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'profileMode',
    label: 'Tooth profile use',
    type: 'select',
    group: 'External gear teeth',
    options: [
      { value: 'standard', label: 'Unshifted involute' },
      { value: 'layout', label: 'Small pinion · layout profile' },
    ],
    description:
      'Layout profiles use radial root relief; they do not reproduce a supplier-specific undercut or profile shift.',
  },
  {
    ...number('module', 'Gear module', 'm', 'External gear teeth', 0.2, 4, 0.1),
    description: 'Pitch diameter = module × external tooth count.',
  },
  { ...number('teeth', 'External gear teeth', 'z', 'External gear teeth', 12, 120, 1), unit: '' },
  {
    ...number('pressureAngle', 'Pressure angle', 'α', 'External gear teeth', 14.5, 30, 0.5),
    unit: '°',
  },
  number('backlash', 'Pair backlash allowance', 'j', 'External gear teeth', 0, 1, 0.01),
  number('faceWidth', 'Gear width', 'b', 'Gear body', 1, 30, 0.1),
  { key: 'hub', label: 'Extended servo hub', type: 'boolean', group: 'Gear body' },
  {
    ...number('hubDiameter', 'Hub diameter', 'Dh', 'Gear body', 3, 100, 0.1),
    visibleWhen: (p) => Boolean(p.hub),
  },
  {
    ...number('hubExtension', 'Hub extension below gear', 'Lh', 'Gear body', 0.5, 20, 0.1),
    visibleWhen: (p) => Boolean(p.hub),
  },
  {
    ...number('splineTeeth', 'Servo spline teeth', 'T', 'Servo connection', 6, 64, 1),
    unit: '',
    description:
      'Common counts include 15T, 21T, 23T, 24T and 25T. Tooth count alone does not establish a compatible fit.',
  },
  number('splineMajor', 'Socket major diameter', 'Ds', 'Servo connection', 2, 30, 0.01),
  number('splineMinor', 'Socket minor diameter', 'ds', 'Servo connection', 1, 29, 0.01),
  { ...number('splineAngle', 'Spline clocking', 'θ', 'Servo connection', 0, 360, 1), unit: '°' },
  {
    key: 'socket',
    label: 'Spline socket',
    type: 'select',
    group: 'Servo connection',
    options: [
      { value: 'blind', label: 'Recess with retaining screw hole' },
      { value: 'through', label: 'Through spline' },
    ],
  },
  {
    ...number('socketDepth', 'Spline recess depth', 'Ls', 'Servo connection', 0.5, 40, 0.1),
    visibleWhen: (p) => p.socket === 'blind',
  },
  {
    ...number('screwBore', 'Retaining screw clearance', 'd', 'Retaining screw', 0.8, 20, 0.1),
    visibleWhen: (p) => p.socket === 'blind',
  },
  {
    key: 'counterbore',
    label: 'Recess for screw head',
    type: 'boolean',
    group: 'Retaining screw',
    visibleWhen: (p) => p.socket === 'blind',
  },
  {
    ...number('counterboreDiameter', 'Head recess diameter', 'Dc', 'Retaining screw', 1, 30, 0.1),
    visibleWhen: (p) => p.socket === 'blind' && Boolean(p.counterbore),
  },
  {
    ...number('counterboreDepth', 'Head recess depth', 'Lc', 'Retaining screw', 0.2, 10, 0.1),
    visibleWhen: (p) => p.socket === 'blind' && Boolean(p.counterbore),
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'splineTeeth', label: 'Servo spline teeth' },
  { key: 'module', label: 'Gear module' },
  { key: 'teeth', label: 'External teeth' },
  { key: 'faceWidth', label: 'Gear width' },
];
