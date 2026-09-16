import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from './lib/core/nuts';

const part = nutDefinition('hex-nut', 'Hexagon nut', 'DIN 934', 'hex', {
  bore: 6,
  acrossFlats: 10,
  height: 5,
});
part.presets = modulePresets;
export default { ...part, presets: modulePresets };
