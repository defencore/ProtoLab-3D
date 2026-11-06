import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { ring, n, annulusPython } from '../../core/geometry';
import { parameters, defaults, catalogSelection } from './configurator';
import profile from './product.json';
import presets from './presets.json';

function dimensions(p: Parameters) {
  const od = n(p, 'outerDiameter'),
    bore = od - 2 * n(p, 'wall'),
    height = n(p, 'length');
  return { od, bore, height };
}

const part: PartDefinition = {
  id: 'rocket-coupler',
  name: 'Rocket tube coupler',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'box',
  product: profile as ProductProfile,
  description:
    'An open sleeve for joining adjacent hobby rocket body sections or laying out an avionics bay.',
  complexity: '3 dimensions · prototype examples',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'hobby rocket',
    'coupler',
    'sleeve',
    'tube joint',
    'avionics bay',
  ],
  parameters,
  defaults,
  catalogSelection,
  presetMatchKeys: ['outerDiameter', 'wall', 'length'],
  presets: presets as Preset[],
  validate(p, state) {
    if (state !== 'default') return ['Select the physical detail.'];
    if (2 * n(p, 'wall') >= n(p, 'outerDiameter'))
      return ['Twice the wall thickness must be smaller than the outside diameter.'];
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
    'Prototype coupling sleeve; example clearances and dimensions are authored assumptions. Verify the actual mating tube bore and the selected retention or bonding method.',
};
export default part;
