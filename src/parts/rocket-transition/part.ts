import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { component, pythonShape, type Shape } from '../../core/assembly/boundary/shapes';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection } from './configurator';
import product from './product.json';
import presets from './presets.json';

export function transitionShape(p: Parameters): Shape {
  const fore = n(p, 'foreDiameter') / 2,
    aft = n(p, 'aftDiameter') / 2,
    half = n(p, 'length') / 2,
    wall = n(p, 'wall');
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [aft, -half],
      [fore, half],
      [fore - wall, half],
      [aft - wall, -half],
    ],
  };
}

const part: PartDefinition = {
  id: 'rocket-transition',
  name: 'Rocket conical transition and boattail',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'wing',
  complexity: 'Hollow conical reducer',
  description:
    'Open-ended conical shell joining different airframe diameters, with independent forward and aft interfaces for a transition or boattail.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'transition',
    'boattail',
    'boat tail',
    'reducer',
    'conical shell',
    'airframe',
  ],
  defaults,
  parameters,
  catalogSelection,
  presetMatchKeys: ['foreDiameter', 'aftDiameter', 'length', 'wall'],
  product: product as ProductProfile,
  presets: presets as Preset[],
  validate(p) {
    const errors = parameters
      .filter(
        (f) =>
          typeof p[f.key] !== 'number' ||
          !Number.isFinite(p[f.key]) ||
          +p[f.key] < f.min! ||
          +p[f.key] > f.max!,
      )
      .map((f) => `${f.label} is outside its supported finite range.`);
    if (errors.length) return errors;
    if (Math.abs(n(p, 'foreDiameter') - n(p, 'aftDiameter')) < 0.1)
      errors.push(
        'Forward and aft diameters must differ by at least 0.1 mm; use a body tube for equal diameters.',
      );
    if (2 * n(p, 'wall') >= Math.min(n(p, 'foreDiameter'), n(p, 'aftDiameter')))
      errors.push('Radial wall thickness must leave both ends open.');
    return errors;
  },
  buildGeometry: (p) =>
    new Group().add(component(transitionShape(p), 'Conical transition', 0xb0bbc6)),
  python: (p) => `shape = ${pythonShape(transitionShape(p))}`,
  dimensions: (p) => {
    const diameter = Math.max(n(p, 'foreDiameter'), n(p, 'aftDiameter'));
    return [diameter, diameter, n(p, 'length')];
  },
  assessment: (p) => [
    `Forward interface at Z=${n(p, 'length') / 2}: OD ${p.foreDiameter}, bore ${n(p, 'foreDiameter') - 2 * n(p, 'wall')} mm. Aft interface at Z=${-n(p, 'length') / 2}: OD ${p.aftDiameter}, bore ${n(p, 'aftDiameter') - 2 * n(p, 'wall')} mm.`,
    `Cone half-angle ${((Math.atan(Math.abs(n(p, 'foreDiameter') - n(p, 'aftDiameter')) / (2 * n(p, 'length'))) * 180) / Math.PI).toFixed(2)} degrees. Wall input is radial rather than surface-normal thickness.`,
  ],
  notes:
    'One open-ended hollow conical solid; Z points forward and the origin is the axial midpoint. The wall is a constant radial difference between outer and inner cones, not constant surface-normal thickness. No shoulder, fastening, end cap or attachment is included. Presets are authored examples without supplier identity, aerodynamic data or automatic tube-fit claims. This is a geometric counterpart to the OpenRocket transition family, not OpenRocket file interchange or simulation.',
  sources: [
    {
      label: 'OpenRocket transition component family',
      url: 'https://wiki.openrocket.info/Body_Components_Basics',
    },
    {
      label: 'OpenRocket component selection guide',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html',
    },
  ],
};

export default part;
