import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  frameWidth: 30,
  frameDepth: 30,
  frameLength: 44,
  frameWall: 2,
  coilDiameter: 22,
  bobbinWall: 1,
  flangeThickness: 1,
  plungerDiameter: 8,
  plungerLength: 40,
  sleeveWall: 0.7,
  clearance: 0.2,
  poleLength: 7,
  residualGap: 0.5,
  stroke: 8,
  mountPattern: 'two-hole',
  mountHoleDiameter: 3.2,
  mountPitchZ: 24,
  mountPitchX: 16,
  includePushRod: false,
  pushRodDiameter: 4,
  pushRodLength: 12,
};
export const parameters: ParameterDefinition[] = [
  numberParameter('frameWidth', 'Frame width', 'W', 'Steel frame', 12, 160),
  numberParameter('frameDepth', 'Frame depth', 'D', 'Steel frame', 12, 160),
  numberParameter('frameLength', 'Frame length', 'L', 'Steel frame', 15, 240),
  numberParameter('frameWall', 'Frame wall thickness', 't', 'Steel frame', 0.8, 12),
  numberParameter('coilDiameter', 'Winding outside diameter', 'Dc', 'Coil and guide', 6, 130),
  numberParameter('bobbinWall', 'Bobbin tube wall', 'tb', 'Coil and guide', 0.4, 5),
  numberParameter('flangeThickness', 'Bobbin flange thickness', 'tf', 'Coil and guide', 0.4, 6),
  numberParameter('sleeveWall', 'Guide sleeve wall', 'ts', 'Coil and guide', 0.3, 5),
  numberParameter('clearance', 'Radial / fitting clearance', 'c', 'Coil and guide', 0.05, 1, 0.05),
  numberParameter('plungerDiameter', 'Plunger diameter', 'd', 'Travel', 2, 60),
  numberParameter('plungerLength', 'Plunger length', 'Lp', 'Travel', 10, 260),
  numberParameter('poleLength', 'Fixed pole length', 'Lf', 'Travel', 2, 80),
  numberParameter('residualGap', 'Retracted pole gap', 'g', 'Travel', 0.1, 5),
  numberParameter('stroke', 'Plunger stroke', 's', 'Travel', 0, 80),
  { key: 'includePushRod', label: 'Include push rod', type: 'boolean', group: 'Travel' },
  {
    ...numberParameter('pushRodDiameter', 'Push rod diameter', 'dr', 'Travel', 1, 40),
    visibleWhen: (p) => p.includePushRod === true,
  },
  {
    ...numberParameter('pushRodLength', 'Push rod extension', 'Lr', 'Travel', 2, 120),
    visibleWhen: (p) => p.includePushRod === true,
  },
  {
    key: 'mountPattern',
    label: 'Rear mounting pattern',
    type: 'select',
    group: 'Mounting',
    options: [
      { value: 'two-hole', label: 'Two holes on centerline' },
      { value: 'four-hole', label: 'Four-hole rectangle' },
    ],
  },
  numberParameter('mountHoleDiameter', 'Mounting through-hole diameter', 'dm', 'Mounting', 1.5, 12),
  numberParameter('mountPitchZ', 'Mount spacing along axis', 'Pz', 'Mounting', 4, 180),
  {
    ...numberParameter('mountPitchX', 'Mount spacing across frame', 'Px', 'Mounting', 4, 120),
    visibleWhen: (p) => p.mountPattern === 'four-hole',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
