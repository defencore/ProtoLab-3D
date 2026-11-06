import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { article } from './lib/model';
export const defaults: Parameters = { model: article.id, panelThickness: 2.2 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'RF pigtail',
    type: 'select',
    group: 'Product',
    options: [{ value: article.id, label: 'Amphenol 095-902-545-100 · SMA female / AMC · 100 mm' }],
  },
  {
    ...numberParameter(
      'panelThickness',
      'Host panel thickness',
      't',
      'Installation',
      0.8,
      2.3,
      0.1,
    ),
    description:
      'Positions the approximate inner washer and nut. This range is an installation study, not a verified thickness rating for the purchased cable assembly.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];

export const catalogFilterFields: ParameterDefinition[] = [
  ...(
    [
      ['manufacturer', 'Manufacturer', 'Amphenol RF'],
      ['interface', 'Interface', 'SMA female / AMC (U.FL compatible)'],
      ['mounting', 'Mounting', 'Bulkhead front mount'],
    ] as const
  ).map(([key, label, value]) => ({
    key,
    label,
    type: 'select' as const,
    group: 'Product',
    options: [{ value, label: value }],
  })),
  {
    key: 'cableLength',
    label: 'Purchased cable length',
    type: 'number',
    group: 'Product',
    unit: 'mm',
    min: 0,
    max: 1000,
    catalogSummary: true,
  },
];
