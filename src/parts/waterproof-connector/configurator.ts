import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { findModel, models } from './lib/catalog';

export const defaults: Parameters = {
  model: 'sp20-2-panel-socket',
  panelThickness: 2,
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'SP connector half',
    type: 'select',
    group: 'Product',
    options: models.map((model) => ({ value: model.id, label: model.designation })),
  },
  {
    ...numberParameter('panelThickness', 'Host panel thickness', 't', 'Installation', 0.8, 4, 0.1),
    visibleWhen: (p) => findModel(p.model)?.housing === 'panel-socket',
    filterable: false,
    description:
      'Positions the approximate retaining nut behind the panel. The range is an installation study, not a verified panel-thickness rating.',
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'series',
    label: 'Series',
    type: 'select',
    group: 'Product',
    options: [
      { value: 'SP16', label: 'SP16' },
      { value: 'SP20', label: 'SP20' },
    ],
    catalogSummary: true,
  },
  {
    key: 'contactCount',
    label: 'Contacts',
    type: 'number',
    unit: '',
    group: 'Product',
    catalogSummary: true,
  },
  {
    key: 'housing',
    label: 'Housing / mounting',
    type: 'select',
    group: 'Product',
    options: [
      { value: 'cable-plug', label: 'Straight cable plug' },
      { value: 'panel-socket', label: 'Round panel socket with retaining nut' },
    ],
    catalogSummary: true,
  },
  {
    key: 'contactSex',
    label: 'Contact sex',
    type: 'select',
    group: 'Product',
    options: [
      { value: 'male', label: 'Male pins' },
      { value: 'female', label: 'Female sockets' },
    ],
    catalogSummary: true,
  },
  {
    key: 'contactDiameter',
    label: 'Nominal mating contact diameter',
    type: 'number',
    unit: 'mm',
    group: 'Interface',
  },
];
