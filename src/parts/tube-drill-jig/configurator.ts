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
  holeCount: '12',
  holeMode: 'through',
  thread: 'M3',
  holeDiameter: 3,
  guide: 'auto',
  seatClearance: 0.1,
  cartridgeClearance: 0.3,
  guideClearance: 0.05,
  stopMode: 'end',
  stopThickness: 5,
  bodyCapacity: 110,
  station: 1,
  showTube: true,
};
export const parameters: ParameterDefinition[] = [
  {
    ...numberParameter(
      'bodyCapacity',
      'Reusable body tube capacity',
      'C',
      'Tube and end stop',
      110,
      540,
    ),
    description:
      'Choose once before printing. Change the centering head for smaller tubes; allow at least 6 mm between capacity and tube OD.',
  },
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
      'With the end stop fitted: change only the measured spacer stack. In through mode, position the fixture on a measured axial mark.',
    visibleWhen: (p) => p.stopMode === 'end',
  },
  {
    key: 'holeCount',
    label: 'Holes around the tube',
    type: 'select',
    group: 'Hole belt',
    description:
      'Available patterns depend on tube diameter and cassette size. Invalid patterns are blocked to preserve at least 2.4 mm between sockets.',
    options: ['4', '8', '12'].map((value) => ({
      value,
      label: `${value} holes / ${360 / Number(value)} degrees`,
    })),
  },
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
      { value: 'bearing', label: 'One movable cassette / two exact-bore bearings total' },
      { value: 'bushing', label: 'Custom hardened steel drill bushing' },
      { value: 'plain', label: 'Printed marking / short-use guide' },
    ],
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
  {
    key: 'stopMode',
    label: 'Tube positioning',
    type: 'select',
    group: 'Tube and end stop',
    options: [
      { value: 'end', label: 'Removable end stop and measured spacers' },
      { value: 'through', label: 'Through tube / stop and spacers removed' },
    ],
    description:
      'Remove only the bottom plate for a belt anywhere along a long tube. The centering liner remains positively seated in the body.',
  },
  numberParameter(
    'stopThickness',
    'Removable stop plate thickness',
    'b',
    'Fit and manufacture',
    5,
    12,
  ),
  {
    ...numberParameter(
      'axisHeight',
      'Fixed drill height / body capacity',
      'H',
      'Fit and manufacture',
      26,
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
    ...numberParameter('station', 'Current drilling station', 'N', 'Hole belt', 1, 12, 1),
    description:
      'Inspection position of the single movable cassette. Must not exceed the selected hole count.',
  },
  { key: 'showTube', label: 'Show reference tube', type: 'boolean', group: 'Tube and end stop' },
];
export const catalogSelection = [
  { key: 'tubeOD', label: 'Tube OD' },
  { key: 'holeCount', label: 'Hole count' },
  { key: 'holeMode', label: 'Operation' },
  { key: 'thread', label: 'Thread' },
];
