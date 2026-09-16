import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { form: 'gear', diameter: 70, length: 80, shaft: 15, port: 12 };
export const parameters: ParameterDefinition[] = [
  {
    key: 'form',
    label: 'Unit family',
    description:
      'External packaging model. Vane pump and hydraulic motor use the same round housing envelope; internal rotors are not modeled.',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'gear', label: 'Gear pump' },
      { value: 'vane', label: 'Vane pump' },
      { value: 'motor', label: 'Hydraulic motor' },
    ],
  },
  {
    key: 'diameter',
    label: 'Housing diameter / width',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'length',
    label: 'Housing length',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'shaft',
    label: 'Shaft diameter',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'port',
    label: 'Port bore',
    type: 'number',
    group: 'Dimensions',
    min: 0.1,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
];
