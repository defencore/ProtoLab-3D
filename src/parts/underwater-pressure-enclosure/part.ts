import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from '../underwater-thruster/lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'underwater-pressure-enclosure',
    name: 'Underwater pressure enclosure kit',
    category: 'ENCLOSURES & DEVICES',
    subgroup: 'GENERAL-PURPOSE ENCLOSURES',
    icon: 'box',
    description:
      'The native tube/flange and dome/pressure-plate portions of one purchased waterproof compartment kit. Both use their own product coordinates; order one complete kit.',
    keywords: ['underwater', 'pressure', 'waterproof', 'enclosure', 'tube', 'dome', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
