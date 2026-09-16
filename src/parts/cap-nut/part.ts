import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from './lib/core/nuts';

export default {
  ...nutDefinition('cap-nut', 'Cap nut', 'DIN 1587', 'cap', {
    bore: 6,
    acrossFlats: 10,
    height: 12,
    bodyHeight: 5,
  }),
  presets: modulePresets,
};
