import type { PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import manufactured from '../manufactured-detail/part';
import profile from './product.json';
import { defaults, parameters } from './configurator';

const parameterKeys = new Set(parameters.map((field) => field.key));

const part: PartDefinition = {
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
  identityParameters: (p) => manufactured.identityParameters!({ recipe: p.recipe }),
  validate(p, state) {
    if (Object.keys(p).some((key) => !parameterKeys.has(key)))
      return [
        'A configured supplier component accepts only its installation recipe and mesh controls.',
      ];
    return manufactured.validate(p, state);
  },
  initializeGeometry: manufactured.initializeGeometry,
  buildGeometry: manufactured.buildGeometry,
  buildExportGeometry: manufactured.buildExportGeometry,
  python: manufactured.python,
  dimensions: manufactured.dimensions,
  notes:
    'An installation envelope does not establish supplier-certified mounting geometry, functional internals, ratings or availability. Attach actual procurement records and verify interfaces before design release.',
};
export default part;
