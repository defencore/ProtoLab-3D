import presetData from './presets.json';
import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { component: 'contact' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Detail to manufacture',
    type: 'select',
    group: 'Component',
    options: presetData.map((preset) => ({
      value: preset.parameters.component,
      label: preset.name,
    })),
  },
];
