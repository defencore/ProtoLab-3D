import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { ring, n, annulusPython } from '../../core/geometry';
import { parameters, defaults, catalogSelection } from './configurator';
import profile from './product.json';
import presets from './presets.json';

function dimensions(p: Parameters) {
  const od = n(p, 'outerDiameter'),
    bore = n(p, 'bore'),
    height = n(p, 'thickness');
  return { od, bore, height };
}

const part: PartDefinition = {
  id: 'rocket-centering-ring',
  name: 'Rocket centering ring',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'box',
  product: profile as ProductProfile,
  description:
    'A single annular plate for locating one tube concentrically inside a larger hobby rocket airframe.',
  complexity: '3 dimensions · prototype examples',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'hobby rocket',
    'centering ring',
    'engine block',
    'thrust ring',
    'motor stop ring',
    'annulus',
    'tube support',
    'airframe',
  ],
  parameters,
  defaults,
  catalogSelection,
  presetMatchKeys: ['outerDiameter', 'bore', 'thickness'],
  presets: presets as Preset[],
  validate(p, state) {
    if (state !== 'default') return ['Select the physical detail.'];
    if (n(p, 'bore') >= n(p, 'outerDiameter'))
      return ['The bore must be smaller than the outside diameter.'];
    return [];
  },
  buildGeometry(p) {
    const { od, bore, height } = dimensions(p);
    return new Group().add(ring(od / 2, bore / 2, height, 0xb0bbc6));
  },
  python(p) {
    const { od, bore, height } = dimensions(p);
    return `shape = ${annulusPython(od / 2, bore / 2, height)}`;
  },
  dimensions(p) {
    const { od, height } = dimensions(p);
    return [od, od, height];
  },
  notes:
    'One annular detail. The engine-block example reuses this ring geometry as an axial stop; no thrust capacity is implied. Dimensions are author examples. Confirm both mating tube dimensions, material, fits and the structural attachment in the project.',
  sources: [
    {
      label: 'OpenRocket inner components and engine block',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#inner-components',
    },
  ],
};
export default part;
