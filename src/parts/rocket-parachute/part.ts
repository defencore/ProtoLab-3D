import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import { component, pythonShape, type Shape } from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';

export function canopyShape(p: Parameters): Shape {
  const radius = n(p, 'diameter') / 2;
  const vent = n(p, 'ventDiameter') / 2;
  const angle = Math.acos(vent / radius);
  const outer: [number, number][] = Array.from({ length: 65 }, (_, index) => {
    const theta = (index * angle) / 64;
    return [index === 64 ? vent : radius * Math.cos(theta), n(p, 'rise') * Math.sin(theta)];
  });
  return {
    kind: 'revolve',
    segments: 128,
    profile: [
      ...outer,
      ...outer.map(([r, z]): [number, number] => [r, z - n(p, 'thickness')]).reverse(),
    ],
  };
}

const part: PartDefinition = {
  id: 'rocket-parachute',
  name: 'Rocket parachute canopy',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'wing',
  complexity: 'Open canopy reference envelope',
  description:
    'One open dome canopy with an optional central vent and finite reference fabric thickness for a purchased hobby rocket recovery item.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'parachute',
    'canopy',
    'recovery',
    'drogue',
    'main chute',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['diameter', 'rise', 'ventDiameter'],
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
    if (n(p, 'ventDiameter') >= n(p, 'diameter') * 0.8)
      errors.push('The central vent must be smaller than 80% of the canopy diameter.');
    if (n(p, 'thickness') >= n(p, 'rise') / 4)
      errors.push('Reference fabric thickness must be less than one quarter of the apex rise.');
    return errors;
  },
  buildGeometry: (p) =>
    new Group().add(
      component(canopyShape(p), 'Parachute canopy envelope', 0xe77d38, [0, 0, 0], 0, {
        edgeTolerance: 1e-6,
      }),
    ),
  python: (p) => `shape = ${pythonShape(canopyShape(p))}`,
  dimensions: (p) => [
    n(p, 'diameter'),
    n(p, 'diameter'),
    n(p, 'rise') * Math.sqrt(1 - (n(p, 'ventDiameter') / n(p, 'diameter')) ** 2) +
      n(p, 'thickness'),
  ],
  assessment: () => [
    'One canopy procurement item. Select actual manufacturer, designation, fabric, seams, risers and suspension-line arrangement before procurement.',
    'Diameter and rise describe an authored open display envelope. They do not determine drag coefficient, descent speed, inflation load or packing volume.',
  ],
  notes:
    'A 64-segment hemispheroidal meridian revolved about Z. The outer profile is r=R cos(theta), z=H sin(theta); the inner profile is shifted down by the axial reference thickness, which is not a constant normal textile thickness. The rim is open, with a closed finite-thickness edge; a zero vent closes the crown. No suspension lines, seams, gore pattern, harness, packed state, inflation simulation or load rating are modeled. All dimensions are author examples, not supplier measurements. Z=0 is the outer rim and the lower edge is at -thickness.',
  sources: [
    {
      label: 'OpenRocket recovery and mass component types',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components',
    },
  ],
};

export default part;
