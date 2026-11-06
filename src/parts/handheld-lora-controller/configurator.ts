import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = {
  bodyModel: 'contoured',
  antennaType: 'external',
  externalMount: 'compact-top',
  safetyPosition: 'locked',
  batteryLength: 43,
  batteryWidth: 25,
  batteryHeight: 10,
  batteryTapeThickness: 0.5,
  guardProjection: 5.5,
  buttonA: 'first',
  buttonB: 'first',
  powerButton: 'first',
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'bodyModel',
    label: 'Body model',
    type: 'select',
    group: 'Model',
    filterable: true,
    options: [
      { value: 'original', label: 'Straight' },
      { value: 'contoured', label: 'Palm' },
      { value: 'web-grip', label: 'Palm Lock' },
    ],
    description:
      'Straight has a tapered body and two side buttons. Palm adds a rounded palm profile. Palm Lock recesses the second button for the thumb web and adds a captive sliding safety. Antenna type is independent of body model.',
  },
  {
    key: 'antennaType',
    label: 'Antenna type',
    type: 'select',
    group: 'Antenna',
    filterable: true,
    options: [
      { value: 'external', label: 'External SMA' },
      { value: 'internal', label: 'Internal FPC' },
    ],
    description:
      'Independent library filter. The internal option reserves an unselected adhesive antenna; the external option mounts the SMA pigtail.',
  },
  {
    key: 'externalMount',
    label: 'External antenna position',
    type: 'select',
    group: 'Advanced antenna installation',
    filterable: false,
    visibleWhen: (p) => p.antennaType === 'external',
    options: [
      { value: 'bottom', label: 'Bottom · USB end' },
      { value: 'top', label: 'Top · power end' },
      { value: 'compact-top', label: 'Compact top · power end' },
    ],
    description:
      'Bottom places SMA beside USB. Top and Compact top retain their selections near the power key and now share a compact recessed keyed seat. This position is independent of the antenna-type library filter.',
  },
  {
    key: 'safetyPosition',
    label: 'Mechanical blocker',
    type: 'select',
    group: 'Mechanical control',
    filterable: false,
    visibleWhen: (p) => p.bodyModel === 'web-grip',
    options: [
      { value: 'locked', label: 'Locked' },
      { value: 'unlocked', label: 'Unlocked' },
    ],
    description:
      'Palm Lock inspection pose. Unlock the sliding safety before pressing the recessed second button; no load or accidental-actuation rating is assigned.',
  },
  ...[
    ['batteryLength', 'Battery length', 40, 50],
    ['batteryWidth', 'Battery width', 20, 25],
    ['batteryHeight', 'Battery thickness', 5, 10],
  ].map(([key, label, min, max]): ParameterDefinition => ({
    key: String(key),
    label: String(label),
    type: 'number',
    filterable: false,
    unit: 'mm',
    min: Number(min),
    max: Number(max),
    step: 0.5,
    group: 'Battery envelope',
    description:
      'The 102540 cell was measured at 43 × 25 × 10 mm. Include its complete protected package and leads; capacity, connector and wiring are not specified.',
  })),
  {
    key: 'batteryTapeThickness',
    label: 'Battery adhesive thickness',
    type: 'number',
    filterable: false,
    unit: 'mm',
    min: 0.2,
    max: 1.2,
    step: 0.1,
    group: 'Battery envelope',
    description:
      'Double-sided tape beneath the measured cell. The default allowance is 0.5 mm; set the actual adhesive thickness before printing or cutting the clamp pad.',
  },
  {
    key: 'guardProjection',
    label: 'Protective guard projection',
    type: 'number',
    filterable: false,
    unit: 'mm',
    min: 5.5,
    max: 6,
    step: 0.5,
    group: 'Protection',
    description:
      'Distance beyond the button mounting face. The illustrative released cap projects 5 mm; 5.5–6 mm guard projection leaves 0.5–1 mm above it. The default is 0.5 mm. The seat rim has a rounded return. Check the delivered switch height before printing.',
  },
  ...[
    ['buttonA', 'Second button'],
    ['buttonB', 'Upper button · index finger'],
    ['powerButton', 'Hold power button'],
  ].map(([key, label]): ParameterDefinition => ({
    key,
    label,
    type: 'select',
    group: 'Inspection',
    filterable: false,
    options: [
      { value: 'first', label: 'Released · OFF' },
      { value: 'last', label: 'Pressed · momentary ON' },
    ],
    description:
      key === 'powerButton'
        ? 'Momentary power-key inspection pose. Long-press shutdown and wake behavior depend on the installed firmware.'
        : key === 'buttonA'
          ? 'Middle-finger control on Straight and Palm; recessed thumb-web control on Palm Lock. Unlock its mechanical blocker before selecting the pressed pose.'
          : 'Independent index-finger inspection pose; the button does not latch.',
  })),
];
