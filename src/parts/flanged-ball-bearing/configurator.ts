import type { ParameterDefinition, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 100),
  numberParameter('outer', 'Body outside diameter', 'D', 'Dimensions', 3, 200),
  numberParameter('width', 'Overall width including flange', 'B', 'Dimensions', 1, 100),
  {
    ...numberParameter('flangeOuter', 'Flange outside diameter', 'Df', 'Flange reference', 3, 250),
    description: 'Independent manufacturer size reference; confirm the ordered seller execution.',
  },
  {
    ...numberParameter('flangeWidth', 'Flange thickness', 'Bf', 'Flange reference', 0.1, 50),
    description: 'Included in the overall bearing width, rather than added to it.',
  },
  {
    key: 'seals',
    label: 'Closure',
    type: 'select',
    group: 'Bearing construction',
    options: [
      { value: 'rubber', label: 'Rubber seals · 2RS' },
      { value: 'metal', label: 'Metal shields · ZZ / 2Z' },
      { value: 'open', label: 'Open' },
    ],
  },
  {
    ...numberParameter('balls', 'Illustrative ball count', 'n', 'Rolling elements', 3, 32, 1),
    unit: '',
    filterable: false,
    description: 'Representative internal construction; not a supplier-verified ball complement.',
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'bore', label: 'Bore diameter' },
  { key: 'outer', label: 'Body outside diameter' },
  { key: 'width', label: 'Overall width' },
];
