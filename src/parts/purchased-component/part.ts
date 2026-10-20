import type { PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import manufactured from '../manufactured-detail/part';
import profile from './product.json';
import { defaults, parameters } from './configurator';
const part: PartDefinition = {
  ...manufactured,
  id: 'purchased-component',
  product: profile as ProductProfile,
  name: 'Configured supplier component',
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'box',
  description:
    'One complete configured supplier unit with installation geometry and explicit procurement identity.',
  complexity: 'Supplier configuration',
  keywords: ['supplier', 'purchased', 'installation', 'catalog'],
  defaults,
  parameters,
  presets: [],
  notes:
    'An installation envelope does not establish supplier-certified mounting geometry, functional internals, ratings or availability. Attach actual procurement records and verify interfaces before design release.',
};
export default part;
