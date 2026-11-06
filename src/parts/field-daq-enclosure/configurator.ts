import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  bodyWidth: 116,
  sensorCount: '2',
  boardThickness: 1.6,
  fitClearance: 0.25,
  sp16Hole: 16.5,
  sp20Hole: 20.5,
  screwLength: '30',
  showReferences: true,
  componentHeight: 25,
};

export const parameters: ParameterDefinition[] = [
  {
    ...numberParameter('bodyWidth', 'Body width', 'W', 'Enclosure', 116, 180, 1),
    description:
      '116 mm supports two or three SP20 sockets on the narrow end. Set 164 mm or more before choosing four sockets. Width is never changed automatically.',
  },
  {
    key: 'sensorCount',
    label: 'Sensor cassette',
    type: 'select',
    group: 'Connectors',
    options: [
      { value: '2', label: 'Two SP20 apertures' },
      { value: '3', label: 'Three SP20 apertures' },
      {
        value: '4',
        label: 'Four SP20 apertures',
        availableWhen: (p) => Number(p.bodyWidth) >= 164,
      },
      { value: 'blank', label: 'Blank cassette' },
    ],
    description:
      'SP16 and SP20 face opposite narrow ends. Cassettes interchange only between shells of the same body width. Set width to at least 164 mm before choosing four SP20 apertures.',
  },
  {
    ...numberParameter('sp16Hole', 'SP16 mounting aperture', 'D16', 'Connectors', 15, 19, 0.1),
    description:
      'Library SP16 opening: diameter 16.5 mm with opposing flats 15.3 mm apart; verify delivered stock.',
  },
  {
    ...numberParameter('sp20Hole', 'SP20 mounting aperture', 'D20', 'Connectors', 19, 23, 0.1),
    visibleWhen: (p) => p.sensorCount !== 'blank',
    description:
      'Library SP20 mounting diameter. The two opposing flats are D − 1 mm apart: 19.5 mm at the default Ø20.5. Confirm the delivered housing.',
  },
  {
    ...numberParameter('boardThickness', 'PCB thickness', 'tPCB', 'Board retention', 1.2, 2, 0.1),
    description:
      'Bare substrate thickness. Keep solder joints, wires and components clear of the corner envelopes and clamp lands.',
  },
  {
    ...numberParameter(
      'componentHeight',
      'Maximum component height above PCB',
      'h',
      'Board retention',
      5,
      25,
      1,
    ),
    description:
      'Reference envelope only. Connector and wiring zones must remain free of tall components.',
  },
  {
    ...numberParameter(
      'fitClearance',
      'Sliding fit clearance per side',
      'c',
      'Manufacturing',
      0.15,
      0.5,
      0.05,
    ),
    description:
      'Use the fit coupon to qualify the PCB envelopes and cassette keys with the actual PETG profile.',
  },
  {
    key: 'screwLength',
    label: 'Four M3 closure screws',
    type: 'select',
    group: 'Manufacturing',
    options: [
      { value: '25', label: 'M3 × 25 mm' },
      { value: '30', label: 'M3 × 30 mm' },
    ],
    description:
      'Length is measured below the head. The selected length changes the nut-seat stack; use the matching base.',
  },
  {
    key: 'showReferences',
    label: 'Show PCB and connector references',
    type: 'boolean',
    group: 'Inspection',
    description:
      'Reference envelopes are excluded from fabrication exports and the manufactured enclosure composition.',
    filterable: false,
  },
];

export const catalogSelection = [{ key: 'sensorCount', label: 'Sensor cassette' }];
