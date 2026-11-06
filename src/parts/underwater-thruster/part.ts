import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from './lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'underwater-thruster',
    name: '4S underwater thruster',
    category: 'MOTORS & ACTUATORS',
    subgroup: 'BRUSHLESS MOTORS',
    icon: 'gear',
    description:
      'A complete purchased underwater thruster with built-in ESC. Two native source forms share one product axis and can be installed repeatedly at independent positions.',
    keywords: ['underwater', 'thruster', 'motor', '4S', 'ESC', 'CW', 'CCW', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
