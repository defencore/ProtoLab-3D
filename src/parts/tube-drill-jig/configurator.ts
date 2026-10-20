import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { threads } from './lib/selection';

export const defaults: Parameters = {
  tubeOD: 90,
  tubeWall: 2,
  tubeClearance: 0.4,
  endOffset: 10,
  axisHeight: 30,
  spacerClearance: 0.3,
  holeCount: '4',
  phase: 0,
  holeMode: 'tap',
  thread: 'M3',
  holeDiameter: 3,
  guide: 'auto',
  bearingGap: 4,
  seatClearance: 0.1,
  cartridgeClearance: 0.3,
  guideClearance: 0.05,
  stopThickness: 4,
  plainWall: 6,
};
export const parameters: ParameterDefinition[] = [
  numberParameter('tubeOD', 'Tube outside diameter', 'D', 'Tube and end stop', 12, 500),
  numberParameter('tubeWall', 'Tube wall thickness', 't', 'Tube and end stop', 0.3, 25),
  numberParameter(
    'tubeClearance',
    'Tube diametral clearance',
    'c',
    'Tube and end stop',
    0.1,
    2,
    0.05,
  ),
  {
    ...numberParameter('endOffset', 'Tube end to hole axis', 'L', 'Hole belt', 3, 200, 0.5),
    description:
      'Change the spacer stack to set this distance without changing the collar. Steps of 0.5 mm, up to the fixed drill height.',
  },
  {
    key: 'holeCount',
    label: 'Holes around the tube',
    type: 'select',
    group: 'Hole belt',
    options: ['4', '8', '12'].map((value) => ({
      value,
      label: `${value} holes / ${360 / Number(value)} degrees`,
    })),
  },
  { ...numberParameter('phase', 'Angular phase', 'a', 'Hole belt', 0, 359, 1), unit: 'deg' },
  {
    key: 'holeMode',
    label: 'Hole operation',
    type: 'select',
    group: 'Drill and guides',
    options: [
      { value: 'tap', label: 'Pilot for a cutting tap' },
      { value: 'through', label: 'Plain through hole' },
    ],
  },
  {
    key: 'thread',
    label: 'Thread after drilling',
    type: 'select',
    group: 'Drill and guides',
    visibleWhen: (p) => p.holeMode === 'tap',
    options: Object.entries(threads).map(([value, { pitch, drill }]) => ({
      value,
      label: `${value} x ${pitch} / drill ${drill} mm`,
    })),
  },
  {
    ...numberParameter(
      'holeDiameter',
      'Through-hole drill diameter',
      'd',
      'Drill and guides',
      1,
      12,
      0.05,
    ),
    visibleWhen: (p) => p.holeMode === 'through',
  },
  {
    key: 'guide',
    label: 'Drill guide construction',
    type: 'select',
    group: 'Drill and guides',
    options: [
      { value: 'auto', label: 'Automatic: exact bearing bore or steel bushing' },
      { value: 'bearing', label: 'Two bearings per station / exact bore required' },
      { value: 'bushing', label: 'Custom hardened steel drill bushing' },
      { value: 'plain', label: 'Printed marking / short-use guide' },
    ],
  },
  {
    ...numberParameter('bearingGap', 'Space between bearings', 'g', 'Fit and manufacture', 2, 15),
    visibleWhen: (p) => p.guide === 'bearing' || p.guide === 'auto',
  },
  {
    ...numberParameter(
      'seatClearance',
      'Bearing / bushing diametral seat allowance',
      's',
      'Fit and manufacture',
      0,
      0.5,
      0.05,
    ),
    description: 'Prototype fit allowance. Test with the actual purchased components.',
  },
  numberParameter(
    'cartridgeClearance',
    'Cartridge diametral clearance',
    'k',
    'Fit and manufacture',
    0.1,
    0.8,
    0.05,
  ),
  {
    ...numberParameter(
      'guideClearance',
      'Bushing / printed guide running clearance',
      'r',
      'Fit and manufacture',
      0.01,
      0.3,
      0.01,
    ),
    description:
      'Added to drill diameter for bushing and printed holes. Bearing bores retain their catalog size.',
  },
  numberParameter('stopThickness', 'Bottom stop thickness', 'b', 'Fit and manufacture', 2, 12),
  {
    ...numberParameter(
      'axisHeight',
      'Fixed drill height / body capacity',
      'H',
      'Fit and manufacture',
      10,
      200,
      0.5,
    ),
    description:
      'Choose before printing the body. The same body covers offsets up to H using spacers: stack height = H minus the desired offset.',
  },
  numberParameter(
    'spacerClearance',
    'Spacer diametral clearance',
    's',
    'Fit and manufacture',
    0.1,
    1,
    0.05,
  ),
  {
    ...numberParameter(
      'plainWall',
      'Printed guide radial length',
      'w',
      'Fit and manufacture',
      3,
      20,
    ),
    visibleWhen: (p) => p.guide === 'plain',
  },
];
export const catalogSelection = [
  { key: 'tubeOD', label: 'Tube OD' },
  { key: 'holeCount', label: 'Hole count' },
  { key: 'holeMode', label: 'Operation' },
  { key: 'thread', label: 'Thread' },
];
