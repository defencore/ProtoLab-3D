import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'speedybee-f405-v4' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Controller model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Fixed hardware. Separate selections represent different dimensions or physical connections.',
  },
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
  select('kind', 'Construction', ['Whoop AIO', 'Stack FC', 'Cased autopilot']),
  select('mount', 'Mounting format', ['Whoop 26 mm', '20 × 20 mm', '30.5 × 30.5 mm', 'Case']),
  select('usb', 'USB connector', ['Micro USB', 'USB-C']),
  select('motorConnection', 'Motor / PWM connection', [
    'Solder pads',
    '4 motor sockets',
    '8-pin ESC socket',
    'GH PWM breakout',
    'End-facing PWM headers',
    'Top-facing PWM headers',
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
