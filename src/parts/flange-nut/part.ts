import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { nutDefinition } from '../../core/hardware/nuts';

export default {
  ...nutDefinition('flange-nut', 'Flange nut', 'DIN 6923', 'flange', {
    bore: 6,
    acrossFlats: 10,
    height: 6,
    flangeDiameter: 14.2,
    flangeThickness: 1.2,
  }),
  product: productData as ProductProfile,
  presets: modulePresets,
};
