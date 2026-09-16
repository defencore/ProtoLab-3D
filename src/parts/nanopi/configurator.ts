import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'nanopi-neo-air' };
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
        value: 'FriendlyELEC',
        label: 'FriendlyELEC',
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
        value: 'USB-C power + 2 USB-A',
        label: 'USB-C power + 2 USB-A',
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
        value: '10-pin GPIO',
        label: '10-pin GPIO',
      },
      {
        value: '24-pin + 12-pin footprints',
        label: '24-pin + 12-pin footprints',
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
        value: 'CSI / Wi-Fi / microSD',
        label: 'CSI / Wi-Fi / microSD',
      },
      {
        value: 'Dual GbE / microSD',
        label: 'Dual GbE / microSD',
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
