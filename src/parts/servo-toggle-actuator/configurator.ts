import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = {
  mechanism: 'rocker',
  phase: 'off',
  baseLength: 100,
  baseWidth: 90,
  deckHeight: 42,
  contactHeight: 12,
  padGap: 14.6,
  servoSweep: 50,
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'mechanism',
    label: 'Mechanism',
    type: 'select',
    group: 'Design',
    options: [
      { value: 'rocker', label: 'Printed rocker · three parts' },
      { value: 'parallel', label: 'Parallel-shaft rocker' },
      { value: 'parallel-dual', label: 'Parallel-shaft rocker · two switches' },
      { value: 'guided', label: 'Guided fork' },
    ],
    description:
      'Choose a printed rocker with a horizontal or parallel servo shaft, or the guided fork with soft pads.',
  },
  {
    key: 'phase',
    label: 'Operating stage',
    type: 'select',
    group: 'Operation',
    filterable: false,
    options: [
      { value: 'off', label: 'OFF · at rest' },
      { value: 'press-on', label: 'Press ON' },
      { value: 'on', label: 'ON · at rest' },
      { value: 'press-off', label: 'Press OFF' },
    ],
    description:
      'Inspect a push and the return to centre. The maintained toggle stays in its selected position after the mechanism moves away.',
  },
  {
    key: 'manualState',
    label: 'Manual switch · ARM 1',
    type: 'select',
    group: 'Operation',
    filterable: false,
    optionalWhenHidden: true,
    visibleWhen: (p) => p.mechanism === 'parallel-dual',
    options: [
      { value: 'guarded-off', label: 'OFF · cover closed' },
      { value: 'open-off', label: 'OFF · cover open' },
      { value: 'open-on', label: 'ON · cover open' },
    ],
    description:
      'Set ARM 1, the manual toggle on the left, and its protective cover. Its position is independent of ARM 2, the servo-operated switch on the right.',
  },
  {
    key: 'baseLength',
    label: 'Base length',
    type: 'number',
    unit: 'mm',
    min: 80,
    max: 220,
    step: 1,
    group: 'Mounting',
    description:
      'Base footprint; for the parallel-shaft rocker, this sets the mounting flange length.',
  },
  {
    key: 'baseWidth',
    label: 'Base width',
    type: 'number',
    unit: 'mm',
    min: 60,
    max: 180,
    step: 1,
    group: 'Mounting',
    description:
      'Base footprint; for the parallel-shaft rocker, this sets the mounting flange width.',
  },
  {
    key: 'deckHeight',
    label: 'Switch height',
    type: 'number',
    unit: 'mm',
    min: 42,
    max: 65,
    step: 1,
    group: 'Mounting',
    visibleWhen: (p) => !['parallel', 'parallel-dual'].includes(String(p.mechanism)),
    description:
      'Height of the switch case mounting face above the base bottom. The mounting plate starts 3 mm higher.',
  },
  {
    key: 'contactHeight',
    label: 'Contact height',
    type: 'number',
    unit: 'mm',
    min: 8,
    max: 12,
    step: 0.5,
    group: 'Linkage',
    visibleWhen: (p) => p.mechanism === 'guided',
    description:
      'Height of the soft-pad contact above the modeled toggle pivot. Adjust to the purchased switch before use.',
  },
  {
    key: 'padGap',
    label: 'Fork opening',
    type: 'number',
    unit: 'mm',
    min: 13,
    max: 15,
    step: 0.1,
    group: 'Linkage',
    visibleWhen: (p) => p.mechanism === 'guided',
    description: 'Clear opening between the uncompressed pads when the fork is centred.',
  },
  {
    key: 'servoSweep',
    label: 'Servo push angle',
    type: 'number',
    unit: '°',
    min: 40,
    max: 70,
    step: 1,
    group: 'Linkage',
    visibleWhen: (p) => p.mechanism === 'guided',
    description:
      'Angle from centre for each push. The servo returns to centre after the switch changes position.',
  },
];
