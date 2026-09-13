import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from './lib/core/nuts';

export default {
  ...nutDefinition('nyloc-nut', 'Nylon insert lock nut', 'DIN 985 / DIN 982', 'nyloc', {
    bore: 6,
    acrossFlats: 10,
    height: 6,
    bodyHeight: 4,
  }),
  presets: modulePresets,
};
