import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from '../underwater-thruster/lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'ms5837-depth-sensor',
    name: 'MS5837-30BA M10 depth sensor',
    category: 'ELECTRONICS & VISION',
    subgroup: 'SENSORS & SWITCHES',
    icon: 'circuit',
    description:
      'A fixed stainless M10 MS5837-30BA depth sensor installation model from the original bill of materials. The ordered 10 m execution includes an adapter board absent from the external CAD.',
    keywords: ['MS5837', 'MS5837-30BA', 'depth', 'pressure', 'M10', '10m', 'sensor', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
