import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'pwm-switch-17x13' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module model',
    type: 'select',
    group: 'Model',
    options: [{ value: 'pwm-switch-17x13', label: 'PWM electronic switch' }],
  },
];
