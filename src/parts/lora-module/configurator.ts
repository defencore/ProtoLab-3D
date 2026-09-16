import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'ai-thinker-ra02' };
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
    options: [
      {
        value: 'Ai-Thinker',
        label: 'Ai-Thinker',
      },
      {
        value: 'Ebyte',
        label: 'Ebyte',
      },
      {
        value: 'Waveshare',
        label: 'Waveshare',
      },
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    type: 'select',
    group: 'Hardware',
    options: [
      {
        value: 'Bare PCB',
        label: 'Bare PCB',
      },
    ],
  },
  {
    key: 'usb',
    label: 'USB connector',
    type: 'select',
    group: 'Hardware',
    options: [
      {
        value: 'None',
        label: 'None',
      },
    ],
  },
  {
    key: 'connection',
    label: 'Physical connection',
    type: 'select',
    group: 'Hardware',
    options: [
      {
        value: '16 castellated pads + U.FL',
        label: '16 castellated pads + U.FL',
      },
      {
        value: 'Castellated pads + ANT pad',
        label: 'Castellated pads + ANT pad',
      },
      {
        value: 'Castellated pads + antenna socket',
        label: 'Castellated pads + antenna socket',
      },
    ],
  },
  {
    key: 'interface',
    label: 'Interface',
    type: 'select',
    group: 'Hardware',
    options: [
      {
        value: 'SPI',
        label: 'SPI',
      },
    ],
  },
  {
    key: 'chip',
    label: 'Radio chip',
    type: 'select',
    group: 'Hardware',
    options: [
      {
        value: 'SX1262',
        label: 'SX1262',
      },
      {
        value: 'SX1278',
        label: 'SX1278',
      },
    ],
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
