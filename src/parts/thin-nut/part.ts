import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from './lib/core/nuts';

export default {
  ...nutDefinition('thin-nut', 'Thin hexagon nut', 'DIN 439', 'hex', {
    bore: 6,
    acrossFlats: 10,
    height: 3.2,
  }),
  presets: modulePresets,
};
