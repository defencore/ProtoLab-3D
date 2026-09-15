import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  {
    key: 'action',
    label: 'Output action',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'pull', label: 'Pull · front rod' },
      { value: 'push', label: 'Push · rear rod' },
    ],
    description:
      'Both variants attract the armature toward the rear pole. The output rod exits the front for pull action or the rear for push action.',
  },
  numberParameter('outerDiameter', 'Body diameter', 'D', 'Housing', 12, 120, 1),
  numberParameter('bodyLength', 'Body length', 'L', 'Housing', 20, 240, 1),
  numberParameter('wallThickness', 'Housing wall', 't', 'Housing', 0.5, 12, 0.1),
  numberParameter('endThickness', 'End plate thickness', 'e', 'Housing', 1, 20, 0.1),
  numberParameter('plungerDiameter', 'Armature diameter', 'd', 'Motion', 3, 70, 0.5),
  numberParameter('plungerLength', 'Armature length', 'a', 'Motion', 5, 180, 1),
  numberParameter('rodDiameter', 'Output rod diameter', 'dr', 'Motion', 1, 40, 0.5),
  numberParameter('stroke', 'Stroke', 's', 'Motion', 0.5, 70, 0.5),
  {
    ...numberParameter('extension', 'Retracted rod protrusion', 'p', 'Motion', 1, 80, 0.5),
    description:
      'Distance from the output face to the rod tip in the retracted state. Extended protrusion is this value plus the stroke.',
  },
  {
    ...numberParameter('clearance', 'Running clearance', 'c', 'Internals', 0.05, 2, 0.05),
    description: 'Radial armature clearance and minimum axial clearance at the rear pole.',
  },
  numberParameter('guideWall', 'Guide sleeve wall', 'g', 'Internals', 0.3, 4, 0.1),
  {
    key: 'terminals',
    label: 'Insulated terminals',
    type: 'boolean',
    group: 'Connections',
  },
  {
    ...numberParameter('terminalDiameter', 'Terminal diameter', 'dt', 'Connections', 0.5, 5, 0.1),
    visibleWhen: (p) => p.terminals === true,
  },
  {
    ...numberParameter('terminalLength', 'Terminal protrusion', 'lt', 'Connections', 2, 40, 0.5),
    visibleWhen: (p) => p.terminals === true,
  },
  {
    ...numberParameter('terminalSpacing', 'Terminal spacing', 'pt', 'Connections', 5, 100, 0.5),
    visibleWhen: (p) => p.terminals === true,
  },
];

export const defaults: Parameters = {
  action: 'pull',
  outerDiameter: 30,
  bodyLength: 50,
  wallThickness: 1.5,
  endThickness: 3,
  plungerDiameter: 10,
  plungerLength: 28,
  rodDiameter: 5,
  stroke: 8,
  extension: 5,
  clearance: 0.2,
  guideWall: 0.8,
  terminals: true,
  terminalDiameter: 1.5,
  terminalLength: 8,
  terminalSpacing: 20,
};

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
