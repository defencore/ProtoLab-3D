import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { model: 'pwm-switch-17x13' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Module model',
    type: 'select',
    group: 'Model',
    options: [
      { value: 'pwm-switch-17x13', label: 'PWM electronic switch' },
      { value: 'user-mosfet-26x16', label: 'User PWM MOSFET · 26 × 16 × 6 mm reference' },
    ],
  },
];
