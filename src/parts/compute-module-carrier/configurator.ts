import type { ParameterDefinition, Parameters } from '../../core/types';
import { models } from './lib/model';

export const defaults: Parameters = { model: 'waveshare-cm5-io-base-a' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Carrier board model',
    type: 'select',
    group: 'Board',
    options: models.map((model) => ({ value: model.id, label: model.name })),
    description: 'Fixed purchased CM5 carrier boards. The compute module is a separate product.',
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Board selection',
    options: ['Raspberry Pi', 'Waveshare'].map((value) => ({ value, label: value })),
  },
  {
    key: 'module',
    label: 'Compute module',
    type: 'select',
    group: 'Board selection',
    options: [{ value: 'CM5', label: 'Raspberry Pi Compute Module 5' }],
    catalogSummary: true,
  },
  {
    key: 'pcie',
    label: 'PCIe connection',
    type: 'select',
    group: 'Board selection',
    options: ['M.2 M-key', '16-pin FFC'].map((value) => ({ value, label: value })),
    catalogSummary: true,
  },
  ...(
    [
      ['width', 'PCB width (X)', 'mm'],
      ['length', 'PCB length (Y)', 'mm'],
      ['usb3', 'USB 3 Type-A ports', ''],
      ['ethernet', 'Ethernet RJ45 ports', ''],
      ['hdmi', 'Fitted HDMI sockets', ''],
    ] as const
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    group: 'Board dimensions & interfaces',
    min: 0,
    step: unit ? 0.1 : 1,
    catalogSummary: key === 'width' || key === 'length',
  })),
];
