import type { ParameterDefinition, Parameters } from '../../core/types';
import presets from './presets.json';

export const defaults: Parameters = { model: 'finsrov' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Assembly design',
    group: 'Project',
    type: 'select',
    options: presets.map((preset) => ({ value: preset.parameters.model, label: preset.name })),
  },
];
export const catalogSelection = [];
