import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from '../underwater-thruster/lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'metal-servo-bracket',
    name: 'Metal multifunctional servo bracket',
    category: 'STRUCTURAL PARTS',
    subgroup: 'BRACKETS & MOUNTS',
    icon: 'bracket',
    description:
      'A purchased metal U bracket with original mounting holes and source contours, normalized for independent placement around a servo.',
    keywords: ['servo', 'bracket', 'mount', 'metal', 'U bracket', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
