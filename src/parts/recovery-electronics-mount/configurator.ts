import presetData from './presets.json';
import type { Parameters, ParameterDefinition } from '../../core/types';

export const defaults: Parameters = { model: 'lower-platform-current' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Physical mounting detail',
    type: 'select',
    group: 'Component',
    options: presetData.map((preset) => ({ value: preset.parameters.model, label: preset.name })),
    description:
      'Fixed source designs. Locator walls belong to the lower platform; the upper disc remains flat.',
  },
];
