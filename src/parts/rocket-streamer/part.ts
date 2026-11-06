import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, n, num } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'rocket-streamer',
  name: 'Rocket recovery streamer',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'wing',
  complexity: 'Unfolded strip reference',
  description:
    'One flat, unfolded recovery streamer strip with editable length, width and reference thickness for a purchased hobby rocket item.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'streamer',
    'recovery',
    'ribbon',
    'strip',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['length', 'width', 'thickness'],
  validate(p) {
    const errors: string[] = [];
    for (const field of parameters) {
      const value = p[field.key];
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < field.min! ||
        value > field.max!
      )
        errors.push(`${field.label} is outside its supported finite range.`);
    }
    if (errors.length) return errors;
    if (n(p, 'width') > n(p, 'length')) errors.push('Streamer length must be at least its width.');
    if (n(p, 'thickness') >= n(p, 'width') / 10)
      errors.push('Reference sheet thickness must be less than one tenth of the strip width.');
    return errors;
  },
  buildGeometry: (p) =>
    new Group().add(box(n(p, 'length'), n(p, 'width'), n(p, 'thickness'), 0xdf693c)),
  python: (p) =>
    `shape = Part.makeBox(${num(n(p, 'length'))}, ${num(n(p, 'width'))}, ${num(n(p, 'thickness'))}, App.Vector(${num(-n(p, 'length') / 2)}, ${num(-n(p, 'width') / 2)}, ${num(-n(p, 'thickness') / 2)}))`,
  dimensions: (p) => [n(p, 'length'), n(p, 'width'), n(p, 'thickness')],
  notes:
    'One unfolded rectangular reference sheet centered on XYZ; X is length, Y width and Z thickness. All presets are authored envelopes rather than measured supplier products. No folded packing, flutter, drag coefficient, heat resistance, seam, eyelet or attachment is modeled. Select actual material, manufacturer and retention separately; this flat shape does not predict descent performance.',
  sources: [
    {
      label: 'OpenRocket recovery and mass component types',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components',
    },
  ],
};

export default part;
