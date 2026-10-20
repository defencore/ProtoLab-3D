import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from '../../core/hardware/nuts';

export default {
  ...nutDefinition('metal-lock-nut', 'All-metal locknut', 'DIN 980', 'hex', {
    bore: 6,
    acrossFlats: 10,
    height: 6,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
