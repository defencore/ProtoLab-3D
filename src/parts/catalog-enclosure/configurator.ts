import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { defaultModel, enclosureModels, envelopeLabel } from './lib/catalog';

export const defaults: Parameters = { model: defaultModel.id };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Enclosure model',
    type: 'select',
    group: 'Model',
    options: enclosureModels.map((model) => ({
      value: model.id,
      label: `${model.designation} · ${envelopeLabel(model)}`,
    })),
    description: 'Select a catalog article to change the fixed outside dimensions.',
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];

const options = (key: 'material' | 'materialFamily' | 'mounting' | 'ipRating' | 'lid') =>
  [
    ...new Set(
      enclosureModels.flatMap((model) => {
        const offered =
          key === 'material' ? model.materialOptions : key === 'lid' ? model.lidOptions : undefined;
        return (offered?.length ? offered : [model[key]]).filter(
          (value): value is string => !!value,
        );
      }),
    ),
  ]
    .sort((a, b) => a!.localeCompare(b!))
    .map((value) => ({ value: value!, label: value! }));

export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'enclosureType',
    label: 'Enclosure type',
    type: 'select',
    group: 'Type & construction',
    catalogSummary: true,
    options: [
      ...new Map(
        enclosureModels.map((model) => [
          model.category,
          { value: model.category, label: model.categoryLabel },
        ]),
      ).values(),
    ],
  },
  ...[
    { key: 'length', label: 'Outside A (X)', symbol: 'A' },
    { key: 'width', label: 'Outside B (Y)', symbol: 'B' },
    { key: 'height', label: 'Outside C (Z)', symbol: 'C' },
  ].map((field): ParameterDefinition => ({
    ...field,
    type: 'number',
    unit: 'mm',
    group: 'Outside dimensions',
    min: 0,
    step: 0.1,
    catalogSummary: true,
    description:
      field.key === 'height'
        ? 'Outside A/B/C follow the supplier drawing. Check the drawing for usable interior space.'
        : undefined,
  })),
  {
    key: 'material',
    label: 'Material options',
    type: 'select',
    group: 'Type & construction',
    options: options('material'),
  },
  {
    key: 'materialFamily',
    label: 'Material group',
    type: 'select',
    group: 'Type & construction',
    options: options('materialFamily'),
  },
  {
    key: 'mounting',
    label: 'Mounting',
    type: 'select',
    group: 'Type & construction',
    options: options('mounting'),
  },
  {
    key: 'ipRating',
    label: 'IP protection',
    type: 'select',
    group: 'Protection & cover',
    options: options('ipRating'),
  },
  {
    key: 'lidType',
    label: 'Cover options',
    type: 'select',
    group: 'Protection & cover',
    options: options('lid'),
  },
];
