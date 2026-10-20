import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { washerDefinition } from '../../core/hardware/washers';
export default {
  ...washerDefinition('toothed-washer', 'External tooth lock washer', 'toothed', {
    bore: 6.4,
    outerDiameter: 11,
    thickness: 0.7,
    teeth: 12,
    toothDepth: 1,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
