import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'ai-thinker-ra02' };
const options = (values: string[]) =>
  [...new Set(values)].sort().map((value) => ({ value, label: value }));
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Board / module model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Fixed supplier hardware; select a different model to change dimensions or connections.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.manufacturer)),
  },
  {
    key: 'construction',
    label: 'Construction',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.construction)),
  },
  {
    key: 'usb',
    label: 'USB connector',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.attributes.usb)),
  },
  {
    key: 'connection',
    label: 'Physical connection',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.attributes.connection)),
  },
  {
    key: 'interface',
    label: 'Interface',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.attributes.interface)),
  },
  {
    key: 'chip',
    label: 'Radio chip',
    type: 'select',
    group: 'Hardware',
    options: options(models.map((m) => m.attributes.chip)),
  },
  {
    key: 'width',
    label: 'PCB / body width (X)',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 200,
    step: 0.1,
    catalogSummary: true,
  },
  {
    key: 'length',
    label: 'PCB / body length (Y)',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 200,
    step: 0.1,
    catalogSummary: true,
  },
];
