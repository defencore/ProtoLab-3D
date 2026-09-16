import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'xiao-nrf52840' };
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
        value: 'Adafruit',
        label: 'Adafruit',
      },
      {
        value: 'Seeed Studio',
        label: 'Seeed Studio',
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
        value: 'Micro USB',
        label: 'Micro USB',
      },
      {
        value: 'USB-C',
        label: 'USB-C',
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
        value: '14 castellated pads',
        label: '14 castellated pads',
      },
      {
        value: 'Feather pads + JST battery',
        label: 'Feather pads + JST battery',
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
        value: 'BLE / Thread / NFC',
        label: 'BLE / Thread / NFC',
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
    key: 'height',
    label: 'Published height',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 100,
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
