import type { Parameters, ParameterDefinition } from '../../core/types';
import single from '../tr8-geared-rocker-actuator/part';

/** The four channels share one selected, unchanged source-motor execution. */
export const motorModels = single.parameters
  .find((field) => field.key === 'motor')!
  .options!.map((option) => ({ ...option }));
export const motorChoices = motorModels;
export const angleKeys = ['angleA', 'angleB', 'angleC', 'angleD'] as const;
export const defaults: Parameters = {
  motor: 'surpass-2838-3700kv',
  angleA: 0,
  angleB: 0,
  angleC: 0,
  angleD: 0,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'motor',
    label: 'Four BLDC motors',
    type: 'select',
    group: 'Drive',
    options: motorModels,
    description: 'The same motor model is fitted to all four drive channels.',
  },
  ...angleKeys.map((key, index): ParameterDefinition => ({
    key,
    label: `Output ${String.fromCharCode(65 + index)} angle`,
    type: 'number',
    group: 'Motion',
    unit: '°',
    min: -20,
    max: 20,
    step: 1,
    filterable: false,
    description:
      'Independent radial output; the original source nut travels 15 mm between its stops.',
  })),
];
export const neutralParameters = (p: Parameters): Parameters => ({
  ...defaults,
  motor: p.motor ?? defaults.motor,
});
