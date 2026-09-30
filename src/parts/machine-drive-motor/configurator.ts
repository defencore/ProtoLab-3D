import type { ParameterDefinition, Parameters } from '../../core/types';
import presets from './presets.json';
export const defaults: Parameters = { model: 'bevi90l2' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Motor',
    type: 'select',
    group: 'Model',
    options: presets.map((p) => ({ value: p.parameters.model, label: p.name })),
  },
];
