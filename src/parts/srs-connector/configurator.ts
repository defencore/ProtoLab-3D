import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'jst-sqxw-i', leadLength: 25, wireDiameter: 1.4 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Connector model / key',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Fixed connector housings. JST keys follow catalog illustrations; Amphenol and TE entries represent families.',
  },
  {
    key: 'leadLength',
    label: 'Exposed pigtail length',
    type: 'number',
    group: 'Harness layout',
    unit: 'mm',
    min: 0,
    max: 150,
    step: 1,
    description:
      'Straight illustrative leads measured from the rear face. Zero hides exposed leads.',
  },
  {
    key: 'wireDiameter',
    label: 'Insulated wire diameter',
    type: 'number',
    group: 'Harness layout',
    unit: 'mm',
    min: 1,
    max: 1.6,
    step: 0.1,
    description:
      'JST insulation range is 1.0–1.6 mm; Amphenol insulation diameter is a layout assumption.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'circuits',
    label: 'Contact count',
    type: 'number',
    group: 'Connector',
    min: 2,
    max: 3,
    step: 1,
    catalogSummary: true,
  },
  ...(['manufacturer', 'orientation', 'interface', 'key'] as const).map((key) => ({
    key,
    label: {
      manufacturer: 'Manufacturer',
      orientation: 'Wire exit',
      interface: 'Mating interface',
      key: 'Mechanical key',
    }[key],
    type: 'select' as const,
    group: 'Connector',
    options: [...new Set(models.map((m) => m[key]))].map((value) => ({ value, label: value })),
  })),
  ...(['width', 'length'] as const).map((key) => ({
    key,
    label: key === 'width' ? 'Published width' : 'Published length',
    type: 'number' as const,
    group: 'Dimensions',
    unit: 'mm',
    min: 0,
    max: 50,
    step: 0.1,
    catalogSummary: true,
  })),
];
