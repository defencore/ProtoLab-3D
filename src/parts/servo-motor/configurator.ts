import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { modelDefinitions } from './lib/models';
import { catalogFilterFields } from './lib/catalog-fields';

export const defaults: Parameters = {
  model: 'waveshare-st3215-hs',
  outputAngle: 0,
  showHorn: true,
  hornStyle: 'disc',
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Servo model',
    type: 'select',
    group: 'Model',
    options: modelDefinitions.map(({ model, name }) => ({
      value: model,
      label: name,
    })),
    description: 'Select a real supplier model. Case, mounting and shaft dimensions are fixed.',
  },
  {
    ...numberParameter('outputAngle', 'Output angle', 'θ', 'Assembly position', -180, 180, 1),
    unit: '°',
    filterable: false,
    description:
      'Geometric position: ST3215-HS ±180°, KST Pro ±60°, X10 V8.0 ±50°, Power-HD ±55°. Ratings stay unchanged.',
  },
  {
    key: 'showHorn',
    label: 'Include output horn',
    type: 'boolean',
    group: 'Assembly position',
    filterable: false,
    description: 'Fixed illustrative single arm, or the source-dimensioned ST3215 disc pair.',
  },
  {
    key: 'hornStyle',
    label: 'Horn form',
    type: 'select',
    group: 'Assembly position',
    filterable: false,
    options: [
      { value: 'single', label: 'Illustrative single arm' },
      { value: 'disc', label: 'Supplied disc pair' },
    ],
    visibleWhen: (p) => p.model === 'waveshare-st3215-hs' && p.showHorn === true,
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export { catalogFilterFields };
