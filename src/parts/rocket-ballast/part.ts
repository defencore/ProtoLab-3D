import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { cylinder, ring, n, num, annulusPython } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';

export function estimatedMass(p: Parameters): number {
  return (
    ((Math.PI / 4) *
      (n(p, 'diameter') ** 2 - n(p, 'bore') ** 2) *
      n(p, 'length') *
      n(p, 'density')) /
    1000
  );
}

const part: PartDefinition = {
  id: 'rocket-ballast',
  name: 'Rocket ballast mass',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'box',
  complexity: 'Physical mass-component example',
  description:
    'A cylindrical ballast slug with optional axial clearance bore and a density-based mass estimate for component layout.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'mass component',
    'ballast',
    'nose weight',
    'balance weight',
    'hobby rocket',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['diameter', 'length', 'bore'],
  validate(p) {
    if (n(p, 'diameter') - n(p, 'bore') < 1)
      return ['Keep at least 0.5 mm radial material around the ballast bore.'];
    return [];
  },
  buildGeometry(p) {
    return new Group().add(
      n(p, 'bore') === 0
        ? cylinder(n(p, 'diameter') / 2, n(p, 'length'), 0x8e9298)
        : ring(n(p, 'diameter') / 2, n(p, 'bore') / 2, n(p, 'length'), 0x8e9298),
    );
  },
  python(p) {
    const r = n(p, 'diameter') / 2,
      l = n(p, 'length');
    return n(p, 'bore') === 0
      ? `shape = Part.makeCylinder(${num(r)}, ${num(l)}, App.Vector(0, 0, ${num(-l / 2)}))`
      : `shape = ${annulusPython(r, n(p, 'bore') / 2, l)}`;
  },
  dimensions: (p) => [n(p, 'diameter'), n(p, 'diameter'), n(p, 'length')],
  assessment: (p) => [
    `Estimated mass ${estimatedMass(p).toFixed(2)} g at the entered density ${p.density} g/cm3. Weigh the finished component for the actual mass.`,
    'This creates one physical ballast detail; it does not set a rocket center of gravity or perform an OpenRocket stability calculation.',
  ],
  notes:
    'One solid or bored cylindrical slug, Z along the axis, origin at the midpoint. Density is an editable assumption and affects the displayed mass estimate only. All presets are authored examples without a supplier or material certificate. Define secure retention and actual material and record measured mass in the project.',
  sources: [
    {
      label: 'OpenRocket mass components',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components',
    },
  ],
};
export default part;
