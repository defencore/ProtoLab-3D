import type { Parameters, ParameterDefinition } from '../../core/types';
export const motorModels = [
  { value: 'surpass-2845-3100kv', label: 'Surpass Hobby 2845 · 3100KV' },
  ...[3200, 3500, 3700, 4400, 4700, 5100, 5700].map((kv) => ({
    value: `surpass-2838-${kv}kv`,
    label: `Surpass Hobby 2838 · ${kv}KV`,
  })),
];
export const defaults: Parameters = { motor: 'surpass-2845-3100kv', outputAngle: 0 };
export const parameters: ParameterDefinition[] = [
  { key: 'motor', label: 'BLDC motor', type: 'select', group: 'Drive', options: motorModels },
  {
    key: 'outputAngle',
    label: 'Output shaft angle',
    type: 'number',
    group: 'Motion',
    unit: '°',
    min: -20,
    max: 20,
    step: 1,
    filterable: false,
    description:
      'The TR8×4 nut drives both fork slots; the 1:1 gears counter-rotate. The carrier and motor stay fixed.',
  },
];
