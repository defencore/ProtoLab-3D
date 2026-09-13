import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from './lib/core/nuts';

export default {
  ...nutDefinition('high-nut', 'High hex nut', 'DIN 6330', 'hex', {
    bore: 6,
    acrossFlats: 10,
    height: 9,
  }),
  presets: modulePresets,
};
