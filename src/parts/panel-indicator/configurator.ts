import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { indicatorColours } from './lib/model';

export const defaults: Parameters = { model: 'lehao-ad16-16c', lensColour: 'red' };

export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Indicator model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'lehao-ad16-16c', label: 'Lehao AD16-16C panel indicator' }],
    description: 'Fixed packaging reference. Lehao-specific dimensions remain unverified.',
  },
  {
    key: 'lensColour',
    label: 'Lens colour',
    type: 'select',
    group: 'Appearance',
    filterable: false,
    options: indicatorColours.map(({ id, label }) => ({ value: id, label })),
    description:
      'Visual colour choice. Red and green appear in the Lehao retailer listing; yellow, blue and white are illustrative choices, not verified Lehao orderable variants.',
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];

export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Listed brand',
    type: 'select',
    group: 'Identity',
    options: [{ value: 'Lehao', label: 'Lehao' }],
    catalogSummary: true,
  },
  {
    key: 'series',
    label: 'Series',
    type: 'select',
    group: 'Identity',
    options: [{ value: 'AD16-16C', label: 'AD16-16C' }],
    catalogSummary: true,
  },
];
