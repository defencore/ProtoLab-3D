import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from '../../core/hardware/nuts';

export default {
  ...nutDefinition('square-nut', 'Square nut', 'DIN 557 / DIN 562', 'square', {
    bore: 6,
    acrossFlats: 10,
    height: 5,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
