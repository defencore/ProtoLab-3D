import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from '../underwater-thruster/lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'metal-servo-horn',
    name: 'Metal round servo horn',
    category: 'MOTORS & ACTUATORS',
    subgroup: 'SERVO ACCESSORIES',
    icon: 'bracket',
    description:
      'A purchased round metal servo horn retaining the original spline socket and linkage hole geometry. The native model is reused with independent shaft positions.',
    keywords: ['servo', 'horn', 'round', 'metal', 'spline', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
