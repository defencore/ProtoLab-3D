import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  length: 270,
  width: 194,
  deckWidth: 143,
  plateThickness: 2,
  layers: 'single',
  upperDeckGap: 32,
  trackWidth: 24,
  driveDiameter: 58,
  roadDiameter: 29,
  roadCount: 4,
  leftAngle: 0,
  rightAngle: 0,
  idlerAdjustment: 0,
  detail: 'detailed',
};
const number = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 1,
): ParameterDefinition => ({ key, label, type: 'number', group, min, max, step, unit: 'mm' });
export const parameters: ParameterDefinition[] = [
  {
    key: 'layers',
    label: 'Deck configuration',
    type: 'select',
    group: 'Chassis',
    options: [
      { value: 'single', label: 'Single deck · standard' },
      { value: 'double', label: 'Two decks · advanced' },
    ],
  },
  number('length', 'Nominal overall length', 'Chassis', 250, 420),
  {
    ...number('width', 'Overall width', 'Chassis', 190, 300),
    visibleWhen: (_, state) => state !== 'frame',
  },
  number('deckWidth', 'Deck width', 'Chassis', 140, 230),
  number('plateThickness', 'Plate thickness', 'Chassis', 1.5, 4, 0.5),
  {
    ...number('upperDeckGap', 'Clearance between decks', 'Chassis', 20, 80),
    visibleWhen: (p) => p.layers === 'double',
  },
  ...[
    number('trackWidth', 'Track width', 'Running gear', 22, 45),
    number('driveDiameter', 'End wheel diameter', 'Running gear', 52, 70),
    number('roadDiameter', 'Road wheel diameter', 'Running gear', 26, 38),
    { ...number('roadCount', 'Road wheels per side', 'Running gear', 3, 6), unit: '' },
    {
      ...number('idlerAdjustment', 'Idler tensioner extension', 'Running gear', 0, 4, 0.5),
      description:
        'Moves the front idler and adjusts the taut belt contour; increases overall length.',
    },
    { ...number('leftAngle', 'Left suspension angle', 'Suspension pose', -8, 8), unit: '°' },
    { ...number('rightAngle', 'Right suspension angle', 'Suspension pose', -8, 8), unit: '°' },
  ].map((field) => ({
    ...field,
    visibleWhen: (_: Parameters, state?: string) => state !== 'frame',
  })),
  {
    key: 'detail',
    label: 'Model detail',
    type: 'select',
    group: 'Model',
    visibleWhen: (_, s) => s !== 'frame',
    options: [
      { value: 'detailed', label: 'Mechanism · springs, bearings and tread ribs' },
      { value: 'lightweight', label: 'Lightweight · smooth belts and spring envelopes' },
    ],
  },
];
