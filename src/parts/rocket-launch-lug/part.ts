import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { ring, n, annulusPython } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'rocket-launch-lug',
  name: 'Rocket launch lug',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'rail',
  complexity: 'Open rod-guide sleeve',
  description:
    'One open sleeve for a model rocket launch rod, with editable guide clearance and wall.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'launch lug',
    'launch rod',
    'rod guide',
    'hobby rocket',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['bore', 'outerDiameter', 'length'],
  validate(p) {
    if (n(p, 'outerDiameter') - n(p, 'bore') < 0.5)
      return ['Leave at least 0.25 mm radial material around the rod clearance bore.'];
    return [];
  },
  buildGeometry: (p) =>
    new Group().add(ring(n(p, 'outerDiameter') / 2, n(p, 'bore') / 2, n(p, 'length'), 0xb0bbc6)),
  python: (p) =>
    `shape = ${annulusPython(n(p, 'outerDiameter') / 2, n(p, 'bore') / 2, n(p, 'length'))}`,
  dimensions: (p) => [n(p, 'outerDiameter'), n(p, 'outerDiameter'), n(p, 'length')],
  notes:
    'One straight open sleeve, Z along the launch rod, origin at the sleeve midpoint. Presets are authored metric examples. No rod, mounting pad or airframe attachment is included. Measure rod diameter, straightness and running clearance, and define the actual attachment and material before release.',
  sources: [
    {
      label: 'OpenRocket body components and launch guides',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#body-components-and-fin-sets',
    },
  ],
};
export default part;
