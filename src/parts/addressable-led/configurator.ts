import type { ParameterDefinition, Parameters } from '../../core/types';
import models from './lib/models.json';

export const defaults: Parameters = { model: 'ws2812-8-stick' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'LED module',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(
    [
      ['manufacturer', 'Manufacturer', ['Generic']],
      ['controller', 'LED controller', ['WS2812B']],
      ['layout', 'Pixel arrangement', [...new Set(models.map((model) => model.layout))]],
      ['connection', 'Connection', ['Solder pads']],
    ] as const
  ).map(([key, label, values]) => ({
    key,
    label,
    type: 'select' as const,
    group: 'LED module selection',
    options: values.map((value) => ({ value, label: value })),
    catalogSummary: key === 'layout',
  })),
  ...(
    [
      ['leds', 'Pixel count', ''],
      ['length', 'Board length', 'mm'],
      ['width', 'Board width', 'mm'],
      ['height', 'Published module height', 'mm'],
      ['outerDiameter', 'Outside diameter', 'mm'],
    ] as const
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    step: key === 'leds' ? 1 : 0.01,
    catalogSummary: key === 'leds',
  })),
];
