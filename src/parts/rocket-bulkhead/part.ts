import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { cylinder, ring, n, num, annulusPython } from '../../core/geometry';
import { parameters, defaults, catalogSelection } from './configurator';
import profile from './product.json';
import presets from './presets.json';

function dimensions(p: Parameters) {
  const od = n(p, 'diameter'),
    bore = n(p, 'holeDiameter'),
    height = n(p, 'thickness');
  return { od, bore, height };
}

const part: PartDefinition = {
  id: 'rocket-bulkhead',
  name: 'Rocket bulkhead',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'box',
  product: profile as ProductProfile,
  description:
    'A circular hobby rocket bay plate with an optional central clearance hole for layout and assembly planning.',
  complexity: '3 dimensions · prototype examples',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'hobby rocket',
    'bulkhead',
    'bay plate',
    'end plate',
    'avionics bay',
  ],
  parameters,
  defaults,
  catalogSelection,
  presetMatchKeys: ['diameter', 'holeDiameter', 'thickness'],
  presets: presets as Preset[],
  validate(p, state) {
    if (state !== 'default') return ['Select the physical detail.'];
    if (n(p, 'holeDiameter') >= n(p, 'diameter'))
      return ['The clearance hole must be smaller than the outside diameter.'];
    return [];
  },
  buildGeometry(p) {
    const { od, bore, height } = dimensions(p);
    return new Group().add(
      bore === 0 ? cylinder(od / 2, height, 0xb0bbc6) : ring(od / 2, bore / 2, height, 0xb0bbc6),
    );
  },
  python(p) {
    const { od, bore, height } = dimensions(p);
    return bore === 0
      ? `shape = Part.makeCylinder(${num(od / 2)}, ${num(height)}, App.Vector(0, 0, ${num(-height / 2)}))`
      : `shape = ${annulusPython(od / 2, bore / 2, height)}`;
  },
  dimensions(p) {
    const { od, height } = dimensions(p);
    return [od, od, height];
  },
  notes:
    'Prototype circular bay plate; dimensions are author examples. Define material, thickness, fits, attachment and any required sealing or structural qualification in the project.',
};
export default part;
