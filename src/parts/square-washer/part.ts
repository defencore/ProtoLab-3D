import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { washerDefinition } from '../../core/hardware/washers';
export default {
  ...washerDefinition('square-washer', 'Square washer', 'square', {
    bore: 11,
    outerDiameter: 30,
    thickness: 3,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
