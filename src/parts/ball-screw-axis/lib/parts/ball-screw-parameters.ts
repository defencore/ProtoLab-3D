import { numberParameter } from '../../../../core/geometry';
import type { ParameterDefinition } from '../../../../core/types';

export const ballNutParameters: ParameterDefinition[] = [
  {
    key: 'family',
    label: 'Nut construction',
    group: 'Series',
    type: 'select',
    options: [
      { value: 'SFK', label: 'SFK · miniature internal return' },
      { value: 'SFU', label: 'SFU · single flanged nut' },
      { value: 'SFS', label: 'SFS · end return' },
      { value: 'SFE', label: 'SFE · high lead end return' },
      { value: 'DFU', label: 'DFU · double nut with spacer' },
      { value: 'SFI', label: 'SFI · internal channel return' },
      { value: 'DFI', label: 'DFI · double internal return' },
      { value: 'SFH', label: 'SFH · end-cap return' },
      { value: 'SFY', label: 'SFY · compact end-cap return' },
    ],
    description:
      'Construction family changes return features and single/double nut bodies. Use a dimensioned preset for a particular product.',
  },
  numberParameter('shaftDiameter', 'Screw nominal diameter', 'd', 'Raceway', 2, 100, 0.1),
  numberParameter('lead', 'Lead per revolution', 'l', 'Raceway', 0.5, 100, 0.1),
  {
    ...numberParameter('starts', 'Helix starts', 's', 'Raceway', 1, 4, 1),
    unit: '',
    description:
      'Axial groove pitch is lead divided by starts. Use the count specified for the selected screw.',
  },
  {
    ...numberParameter('circuitTurns', 'Turns per ball circuit', 'nt', 'Raceway', 0.5, 6, 0.1),
    unit: '',
  },
  numberParameter('ballDiameter', 'Ball diameter', 'Da', 'Raceway', 0.2, 16, 0.001),
  {
    ...numberParameter('circuits', 'Nominal ball circuits', 'n', 'Raceway', 1, 12, 1),
    unit: '',
    description: 'Loaded ball train count; internal return routing is representative.',
  },
  {
    key: 'hand',
    label: 'Screw hand',
    group: 'Raceway',
    type: 'select',
    options: [
      { value: 'right', label: 'Right hand' },
      { value: 'left', label: 'Left hand' },
    ],
  },
  {
    key: 'detail',
    label: 'Model detail',
    group: 'Raceway',
    type: 'select',
    options: [
      { value: 'raceway', label: 'Helical raceways and balls' },
      { value: 'envelope', label: 'Envelope · fast layout' },
    ],
    description: 'Detailed long screws require more time for native CAD generation.',
  },
  numberParameter('nutDiameter', 'Nut body diameter', 'D', 'Nut envelope', 4, 200),
  numberParameter('nutLength', 'Overall nut length', 'L', 'Nut envelope', 8, 300),
  numberParameter('flangeDiameter', 'Flange outside diameter', 'A', 'Flange', 6, 300),
  numberParameter('flangeWidth', 'Flange width across flats', 'H', 'Flange', 5, 250),
  numberParameter('flangeThickness', 'Flange thickness', 'B', 'Flange', 1, 50),
  numberParameter('flangeOffset', 'Flange offset from nut end', 'E', 'Flange', 0, 150),
  numberParameter('mountCircle', 'Mounting pitch circle', 'W', 'Mounting', 4, 280),
  numberParameter('mountHoleDiameter', 'Mounting hole diameter', 'X', 'Mounting', 0.5, 30),
  numberParameter(
    'mountCounterboreDiameter',
    'Mounting counterbore diameter',
    'Y',
    'Mounting',
    0,
    40,
  ),
  numberParameter('mountCounterboreDepth', 'Mounting counterbore depth', 'Z', 'Mounting', 0, 30),
  {
    key: 'mountHoleCount',
    label: 'Mounting hole pattern',
    description:
      'Six-hole SFI and DFI flanges use equal 60° spacing. Other six-hole families use the 45° / 90° drawing pattern.',
    group: 'Mounting',
    type: 'select',
    options: [
      { value: '4', label: '4 holes · 30° from vertical' },
      { value: '6', label: '6 holes · family pattern' },
      { value: '8', label: '8 holes · large flange' },
    ],
  },
  {
    ...numberParameter('oilHoleDiameter', 'Lubrication port diameter', 'Q', 'Mounting', 0, 16),
    description:
      'Zero removes the port. The model uses a blind pilot bore; thread and internal oil routing are not specified.',
  },
];
export const ballScrewParameters: ParameterDefinition[] = [
  ...ballNutParameters,
  numberParameter('length', 'Overall shaft length', 'Ls', 'Screw and ends', 30, 2000, 1),
  {
    key: 'accuracy',
    label: 'Requested accuracy class',
    group: 'Screw and ends',
    type: 'select',
    options: [
      { value: 'C5', label: 'C5' },
      { value: 'C7', label: 'C7' },
      { value: 'custom', label: 'Custom / unspecified' },
    ],
    description: 'Reference metadata only. A CAD model does not certify lead accuracy or preload.',
  },
  {
    key: 'endMachining',
    label: 'End machining',
    group: 'Screw and ends',
    type: 'select',
    options: [
      { value: 'none', label: 'Unmachined · full length raceway' },
      { value: 'custom', label: 'Machined · custom journals' },
    ],
  },
  ...[
    numberParameter(
      'fixedJournalDiameter',
      'Fixed bearing journal diameter',
      'df',
      'Fixed end',
      1,
      90,
    ),
    numberParameter(
      'fixedJournalLength',
      'Fixed bearing journal length',
      'Lf',
      'Fixed end',
      1,
      300,
    ),
    numberParameter('driveJournalDiameter', 'Drive journal diameter', 'dd', 'Fixed end', 1, 90),
    numberParameter('driveJournalLength', 'Drive journal length', 'Ld', 'Fixed end', 1, 150),
    numberParameter(
      'supportJournalDiameter',
      'Support journal diameter',
      'ds',
      'Support end',
      1,
      90,
    ),
    numberParameter('supportJournalLength', 'Support journal length', 'Ls', 'Support end', 1, 100),
  ].map((field) => ({
    ...field,
    visibleWhen: (p: import('../../../../core/types').Parameters) => p.endMachining === 'custom',
  })),
  {
    ...numberParameter('nutPosition', 'Base travel position', 'x', 'Motion', 0, 100, 1),
    unit: '%',
  },
  {
    ...numberParameter('rotation', 'Screw rotation', 'θ', 'Motion', -360, 360, 5),
    unit: '°',
    description: 'Nut translation follows lead × revolutions, reversing for a left-hand screw.',
  },
];
