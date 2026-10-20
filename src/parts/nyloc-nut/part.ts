import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from '../../core/hardware/nuts';

export default {
  ...nutDefinition('nyloc-nut', 'Nylon-insert locknut', 'DIN 985 / DIN 982', 'nyloc', {
    bore: 6,
    acrossFlats: 10,
    height: 6,
    bodyHeight: 4,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
