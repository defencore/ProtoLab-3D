import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
import { wingMiniDefaults, wingMiniModel } from './lib/wing-mini';
export const defaults: Parameters = { model: 'speedybee-f405-v4', ...wingMiniDefaults };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Controller model',
    type: 'select',
    group: 'Model',
    options: [
      ...models.map((m) => ({ value: m.id, label: m.name })),
      { value: wingMiniModel, label: 'SpeedyBee F405 WING MINI' },
    ],
    description:
      'Fixed hardware. Separate selections represent different dimensions or physical connections.',
  },
  ...(['wingHolePitchX', 'wingHolePitchY'] as const).map((key) => ({
    key,
    label: key === 'wingHolePitchX' ? 'Reference hole pitch X' : 'Reference hole pitch Y',
    type: 'number' as const,
    group: 'Installation reference',
    unit: 'mm',
    min: key === 'wingHolePitchX' ? 17 : 20,
    max: key === 'wingHolePitchX' ? 18.3 : 22,
    step: 0.1,
    optionalWhenHidden: true,
    filterable: false,
    visibleWhen: (p: Parameters) => p.model === wingMiniModel,
    description:
      'Undimensioned installation reference retained from the assembly. Measure the actual boards; this is not a supplier drilling dimension.',
  })),
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
const select = (key: string, label: string, options: string[]): ParameterDefinition => ({
  key,
  label,
  type: 'select',
  group: 'Hardware',
  options: options.map((value) => ({ value, label: value })),
});
const number = (
  key: string,
  label: string,
  unit: string,
  max: number,
  summary = false,
): ParameterDefinition => ({
  key,
  label,
  unit,
  type: 'number',
  group: 'Dimensions & connections',
  min: 0,
  max,
  step: 0.1,
  catalogSummary: summary,
});
export const catalogFilterFields: ParameterDefinition[] = [
  select('manufacturer', 'Manufacturer', [...new Set(models.map((m) => m.manufacturer))]),
  select('kind', 'Construction', ['Whoop AIO', 'Stack FC', 'Wing FC stack', 'Cased autopilot']),
  select('mount', 'Mounting format', [
    'Whoop 26 mm',
    '20 × 20 mm',
    '30.5 × 30.5 mm',
    'Case',
    'Reference pitch; measure boards',
  ]),
  select('usb', 'USB connector', ['Micro USB', 'USB-C']),
  select('motorConnection', 'Motor / PWM connection', [
    'Solder pads',
    '4 motor sockets',
    '8-pin ESC socket',
    'GH PWM breakout',
    'End-facing PWM headers',
    'Top-facing PWM headers',
    'PWM headers and solder pads',
  ]),
  number('width', 'Width (X)', 'mm', 200, true),
  number('length', 'Length (Y)', 'mm', 200, true),
  number('height', 'Overall height', 'mm', 100, true),
  number('mountX', 'Mounting pitch X', 'mm', 100),
  number('mountY', 'Mounting pitch Y', 'mm', 100),
  number('hole', 'Bare PCB mounting bore', 'mm', 10),
  number('weight', 'Published mass', 'g', 500),
  number('outputs', 'Motor / PWM signal outputs', '', 32),
  number('cellsMin', 'Minimum LiPo cells (direct input)', 'S', 16),
  number('cellsMax', 'Maximum LiPo cells (direct input)', 'S', 16),
  { key: 'onboardESC', label: 'Integrated motor ESCs', type: 'boolean', group: 'Hardware' },
  { key: 'hdSocket', label: 'Dedicated HD VTX socket', type: 'boolean', group: 'Hardware' },
  { key: 'can', label: 'External CAN sockets', type: 'boolean', group: 'Hardware' },
];
