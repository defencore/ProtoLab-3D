import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { cylinder, n, num } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'rocket-shock-cord',
  name: 'Rocket recovery shock cord',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'spring',
  complexity: 'Straight circular cord reference',
  description:
    'One purchased recovery cord length shown as a straight circular strand for harness planning and specification.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'shock cord',
    'recovery',
    'harness',
    'tether',
    'lanyard',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['length', 'diameter'],
  validate(p) {
    return parameters
      .filter((field) => {
        const value = p[field.key];
        return (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!
        );
      })
      .map((field) => `${field.label} is outside its supported finite range.`);
  },
  buildGeometry: (p) => new Group().add(cylinder(n(p, 'diameter') / 2, n(p, 'length'), 0xc4ad72)),
  python: (p) =>
    `shape = Part.makeCylinder(${num(n(p, 'diameter') / 2)}, ${num(n(p, 'length'))}, App.Vector(0, 0, ${num(-n(p, 'length') / 2)}))`,
  dimensions: (p) => [n(p, 'diameter'), n(p, 'diameter'), n(p, 'length')],
  notes:
    'One straight circular cord reference centered on Z, with endpoints at +/-length/2. All presets are author examples, without supplier identity, material or strength rating. No braid, stretch, elastic response, knots, sewn loops, end allowance, packed state or actual routing is modeled. Length is straight model length, not a qualified cut-length instruction. Define actual harness termination and verify the complete recovery load path separately.',
  sources: [
    {
      label: 'OpenRocket recovery and mass component types',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components',
    },
  ],
};

export default part;
