import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import {
  box,
  cylinder,
  subtract,
  component,
  pythonShape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

function shape(p: Parameters) {
  const width = n(p, 'width'),
    length = n(p, 'length'),
    thickness = n(p, 'thickness');
  return subtract(
    box([width, length, thickness], [-width / 2, -length / 2, 0]),
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((y) =>
        cylinder(n(p, 'holeDiameter') / 2, thickness + 2, [
          (x * n(p, 'pitchX')) / 2,
          (y * n(p, 'pitchY')) / 2,
          -1,
        ]),
      ),
    ),
  );
}

const part: PartDefinition = {
  id: 'rocket-avionics-sled',
  name: 'Rocket avionics mounting sled',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'circuit',
  complexity: 'Four-hole prototype plate',
  description:
    'Single flat mounting plate with a configurable four-hole pattern for removable hobby rocket electronics layouts.',
  keywords: [
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'avionics',
    'sled',
    'electronics bay',
    'mounting plate',
    '\u0440\u0430\u043a\u0435\u0442\u0430',
    '\u0435\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u0456\u043a\u0430',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['width', 'length', 'thickness', 'pitchX', 'pitchY', 'holeDiameter'],
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
    if ((n(p, 'width') - n(p, 'pitchX') - n(p, 'holeDiameter')) / 2 < 2)
      errors.push('Leave at least 2 mm of material between each mounting hole and the side edge.');
    if ((n(p, 'length') - n(p, 'pitchY') - n(p, 'holeDiameter')) / 2 < 2)
      errors.push('Leave at least 2 mm of material between each mounting hole and the end edge.');
    if (Math.min(n(p, 'pitchX'), n(p, 'pitchY')) < n(p, 'holeDiameter') + 2)
      errors.push('Leave at least 2 mm of material between adjacent mounting holes.');
    return errors;
  },
  buildGeometry: (p) => new Group().add(component(shape(p), 'Avionics mounting sled', 0xd3b77d)),
  python: (p) => `shape = ${pythonShape(shape(p))}`,
  dimensions: (p) => [n(p, 'width'), n(p, 'length'), n(p, 'thickness')],
  notes:
    'One physical plate only. Origin is at the plate center in XY and on its lower face in Z. All presets are authored prototype dimensions, not manufacturer board patterns. No board, battery, standoff, strap, bay tube or fastener is included. Select a measured board pattern and check the complete plate diagonal against the actual bay bore. Material, insulation, access and retention require project definition.',
  assessment: (p) => [
    `Plate transverse diagonal: ${Math.hypot(n(p, 'width'), n(p, 'thickness')).toFixed(2)} mm; provide additional bay clearance and allowance for mounted equipment.`,
    `Four ${p.holeDiameter} mm through holes on a ${p.pitchX} x ${p.pitchY} mm rectangular pattern. Hole pattern is a project input, not a verified electronics footprint.`,
  ],
};
export default part;
