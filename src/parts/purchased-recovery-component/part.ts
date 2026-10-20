import type { PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../recovery-detail/part';
import profile from './product.json';
import { defaults, parameters } from './configurator';
const part: PartDefinition = {
  ...detail,
  id: 'purchased-recovery-component',
  product: profile as ProductProfile,
  name: 'Configured recovery supplier unit',
  icon: 'box',
  description: 'Opaque purchased product with its authored installation geometry.',
  complexity: 'Supplier configuration',
  keywords: ['supplier', 'recovery', 'purchase'],
  defaults,
  parameters,
  presets: [],
  notes:
    'Select the actual supplier product and verify supplied interfaces and ratings before project release. Internal visual shapes remain one purchase unit.',
};
export default part;
