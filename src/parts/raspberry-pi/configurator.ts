import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'raspberry-pi-5', detail: 'lightweight' };
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
  {
    key: 'detail',
    label: 'Model detail',
    type: 'select',
    group: 'CAD performance',
    options: [
      { value: 'lightweight', label: 'Lightweight · recommended' },
      { value: 'full', label: 'Full detail · heavy' },
    ],
    description:
      'Lightweight keeps mounting geometry and port envelopes while removing individual contacts and tiny components. Pi 5 full detail exports 2,689 source solids.',
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
        value: 'Raspberry Pi',
        label: 'Raspberry Pi',
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
        value: '2 Micro USB',
        label: '2 Micro USB',
      },
      {
        value: 'None',
        label: 'None',
      },
      {
        value: 'USB-C power + 4 USB-A',
        label: 'USB-C power + 4 USB-A',
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
        value: '2 \u00d7 100-pin board-to-board',
        label: '2 \u00d7 100-pin board-to-board',
      },
      {
        value: '40-pin header',
        label: '40-pin header',
      },
      {
        value: '40-pin unpopulated',
        label: '40-pin unpopulated',
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
        value: 'Carrier required',
        label: 'Carrier required',
      },
      {
        value: 'Mini HDMI / CSI / Wi-Fi',
        label: 'Mini HDMI / CSI / Wi-Fi',
      },
      {
        value: 'PCIe / MIPI / GbE',
        label: 'PCIe / MIPI / GbE',
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
    key: 'mountX',
    label: 'Mounting pitch X',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 100,
    step: 0.1,
    catalogSummary: false,
  },
  {
    key: 'mountY',
    label: 'Mounting pitch Y',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 100,
    step: 0.1,
    catalogSummary: false,
  },
  {
    key: 'hole',
    label: 'Mounting bore',
    unit: 'mm',
    type: 'number',
    group: 'Dimensions & ratings',
    min: 0,
    max: 10,
    step: 0.1,
    catalogSummary: false,
  },
];
