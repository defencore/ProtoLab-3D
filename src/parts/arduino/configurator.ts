import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'arduino-uno-r3' };
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
        value: 'Arduino',
        label: 'Arduino',
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
        value: 'Mini USB',
        label: 'Mini USB',
      },
      {
        value: 'USB-B',
        label: 'USB-B',
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
        value: '30-pin headers',
        label: '30-pin headers',
      },
      {
        value: 'Female shield headers',
        label: 'Female shield headers',
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
        value: 'UART / SPI / I2C',
        label: 'UART / SPI / I2C',
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
  {
    key: 'headerPitch',
    label: 'Header pitch',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 10,
    step: 0.1,
    catalogSummary: false,
  },
];
