import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { washerDefinition } from './lib/core/washers';
export default {
  ...washerDefinition('conical-washer', 'Conical spring washer', 'conical', {
    bore: 6.4,
    outerDiameter: 14,
    thickness: 1.5,
    rise: 0.9,
  }),
  presets: modulePresets,
};
