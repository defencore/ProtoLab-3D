import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import { prism, component, pythonShape } from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

function shape(p: Parameters) {
  const width = n(p, 'width'),
    height = n(p, 'height'),
    opening = n(p, 'opening');
  return prism(
    [
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, height],
      [opening / 2, height],
      [0, n(p, 'floor')],
      [-opening / 2, height],
      [-width / 2, height],
    ],
    n(p, 'depth'),
    -n(p, 'depth') / 2,
    'y',
  );
}

const part: PartDefinition = {
  id: 'rocket-prep-cradle',
  name: 'Rocket preparation V cradle',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'bracket',
  complexity: 'Single ground support prototype',
  description:
    'One flat-bottom V support for resting a hobby rocket body horizontally during bench preparation or display.',
  keywords: [
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'prep',
    'cradle',
    'stand',
    'V block',
    'display',
    'bench',
    '\u043f\u0456\u0434\u0441\u0442\u0430\u0432\u043a\u0430',
    '\u0440\u0430\u043a\u0435\u0442\u0430',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['width', 'depth', 'height', 'opening', 'floor'],
  catalogSelection: [],
  product: product as ProductProfile,
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
    if (n(p, 'opening') > n(p, 'width') - 6)
      errors.push('Leave at least 3 mm of material outside each upper V edge.');
    if (n(p, 'floor') > n(p, 'height') - 5)
      errors.push('The V apex must remain at least 5 mm below the top face.');
    return errors;
  },
  buildGeometry: (p) => new Group().add(component(shape(p), 'Preparation V cradle', 0x447b9d)),
  python: (p) => `shape = ${pythonShape(shape(p))}`,
  dimensions: (p) => [n(p, 'width'), n(p, 'depth'), n(p, 'height')],
  notes:
    'One physical cradle only; add separate occurrences to a project when two supports are needed. X is transverse, Y follows the resting rocket axis and Z starts at the flat bench face. The V opening and depth define the contact angle; no particular body diameter, padding, strap, anti-slip foot or load rating is implied. This is a ground preparation and display support. Presets are authored prototypes, not supplier products.',
  assessment: (p) => [
    `V included angle: ${((2 * Math.atan(n(p, 'opening') / (2 * (n(p, 'height') - n(p, 'floor')))) * 180) / Math.PI).toFixed(1)} degrees.`,
    `Continuous material under V apex: ${p.floor} mm. Provide padding and independently restrain the supported body against rolling, sliding and tipping.`,
  ],
};
export default part;
