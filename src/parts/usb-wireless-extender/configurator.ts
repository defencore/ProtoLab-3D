import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';

export const usbExtenderModel = 'speedybee-f405-wing-mini-usb';
export const defaults: Parameters = { model: usbExtenderModel };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Extender model',
    type: 'select',
    group: 'Model',
    options: [
      { value: usbExtenderModel, label: 'SpeedyBee F405 WING MINI USB / Wireless Extender' },
    ],
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Source',
    options: [{ value: 'SpeedyBee', label: 'SpeedyBee' }],
  },
  ...[
    ['width', 'Width (X)', 'mm'],
    ['length', 'Length (Y)', 'mm'],
    ['height', 'Overall height', 'mm'],
    ['mountPitch', 'Mounting pitch', 'mm'],
  ].map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Project interface',
    min: 0,
    max: 100,
    step: 0.1,
    catalogSummary: true,
  })),
];
