import type { ProductProfile } from '../../core/product-types';
import type { Preset } from '../../core/types';
import { purchasedProduct } from '../underwater-thruster/lib/purchased-product';
import product from './product.json';
import presets from './presets.json';
import catalog from './lib/catalog.json';
import native from './lib/native.json';

const part = purchasedProduct(
  {
    id: 'qfs2025-servo',
    name: 'LIEYING QFS2025 waterproof servo',
    category: 'MOTORS & ACTUATORS',
    subgroup: 'SERVOS',
    icon: 'gear',
    description:
      'A fixed LIEYING QFS2025 waterproof servo from the original bill of materials, with its complete native case, output shaft and mounting geometry.',
    keywords: ['servo', 'LIEYING', 'QFS2025', 'waterproof', '20 kg', '180 degree', 'FinsROV'],
  },
  product as ProductProfile,
  catalog,
  native,
  presets as Preset[],
);
export default part;
