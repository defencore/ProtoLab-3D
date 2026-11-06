import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { component, pythonShape, type Shape } from '../../core/assembly/boundary/shapes';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection } from './configurator';
import product from './product.json';
import presets from './presets.json';

/** Radius at z from the base plane; the final sample is exactly on the axis. */
export function noseRadius(profile: string, radius: number, length: number, z: number): number {
  if (z <= 0) return radius;
  if (z >= length) return 0;
  if (profile === 'conical') return radius * (1 - z / length);
  if (profile === 'elliptical') return radius * Math.sqrt(1 - (z / length) ** 2);
  const rho = (length * length + radius * radius) / (2 * radius);
  return Math.max(0, Math.sqrt(rho * rho - z * z) + radius - rho);
}

function curve(profile: string, radius: number, length: number, offset = 0): [number, number][] {
  const samples = profile === 'conical' ? 1 : 64;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const z = (length * i) / samples;
    return [noseRadius(profile, radius, length, z), offset + z];
  });
}

export function noseShape(p: Parameters): Shape {
  const profile = String(p.profile),
    radius = n(p, 'baseDiameter') / 2,
    length = n(p, 'length'),
    shoulder = n(p, 'shoulderLength'),
    neck = n(p, 'shoulderDiameter') / 2,
    wall = n(p, 'wall');
  const outer: [number, number][] =
    shoulder > 0
      ? [[neck, -shoulder], [neck, 0], ...curve(profile, radius, length)]
      : curve(profile, radius, length);
  if (p.solid)
    return {
      kind: 'revolve',
      segments: 96,
      profile: [...outer, [0, -shoulder]],
    };
  // A retained axial web joins the smaller shoulder to the nose shell.
  // The cavity is a shortened, radially reduced copy, not a normal offset.
  const web = shoulder > 0 ? wall : 0;
  const inside = curve(profile, radius - wall, length - wall - web, web).reverse();
  return {
    kind: 'revolve',
    segments: 96,
    profile:
      shoulder > 0
        ? [...outer, ...inside, [neck - wall, web], [neck - wall, -shoulder]]
        : [...outer, ...inside],
  };
}

const part: PartDefinition = {
  id: 'rocket-nose-cone',
  browseFamily: { id: 'rocket-nose-cone', label: 'Rocket nose cone', primary: true },
  name: 'Rocket nose cone',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'wing',
  complexity: 'Three profiles · optional hollow shoulder',
  description:
    'Independent conical, elliptical or tangent-ogive hobby rocket nose with editable base, length, filled construction and a measured shoulder.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'nose cone',
    'ogive',
    'ellipsoid',
    'elliptical',
    'conical',
    'shoulder',
  ],
  defaults,
  parameters,
  catalogSelection,
  presetMatchKeys: ['profile', 'baseDiameter', 'length', 'shoulderDiameter'],
  product: product as ProductProfile,
  presets: presets as Preset[],
  validate(p) {
    const errors: string[] = [];
    for (const f of parameters) {
      const v = p[f.key];
      if (
        f.type === 'number' &&
        (typeof v !== 'number' || !Number.isFinite(v) || v < f.min! || v > f.max!)
      )
        errors.push(`${f.label} is outside its supported finite range.`);
      if (f.type === 'select' && !f.options!.some((o) => o.value === v))
        errors.push('Choose a supported nose profile.');
      if (f.type === 'boolean' && typeof v !== 'boolean')
        errors.push('Choose a filled or hollow nose.');
    }
    if (errors.length) return errors;
    const radius = n(p, 'baseDiameter') / 2,
      length = n(p, 'length'),
      wall = n(p, 'wall'),
      shoulder = n(p, 'shoulderLength'),
      neck = n(p, 'shoulderDiameter') / 2;
    if (length < radius)
      errors.push('Nose length must be at least the base radius for these profiles.');
    if (shoulder > 0 && neck >= radius)
      errors.push('The shoulder diameter must be smaller than the nose base diameter.');
    if (!p.solid) {
      if (wall >= radius - 1)
        errors.push('Retain at least a 1 mm cavity radius at its widest point.');
      if (length <= 3 * wall) errors.push('Nose length must exceed three cavity end allowances.');
      if (shoulder > 0 && neck - wall < 1)
        errors.push('Retain at least a 1 mm open shoulder bore radius.');
      if (shoulder > 0 && length - 2 * wall < radius - wall)
        errors.push('Length is too short for the hollow inner tangent-ogive construction.');
      if (shoulder > 0 && noseRadius(String(p.profile), radius, length, wall) <= radius - wall)
        errors.push('The cavity base must remain inside the outer nose above the shoulder web.');
    }
    return errors;
  },
  buildGeometry: (p) => new Group().add(component(noseShape(p), 'Rocket nose cone', 0xcf683b)),
  python: (p) => `shape = ${pythonShape(noseShape(p))}`,
  dimensions: (p) => [
    n(p, 'baseDiameter'),
    n(p, 'baseDiameter'),
    n(p, 'length') + n(p, 'shoulderLength'),
  ],
  assessment: (p) => [
    `Overall length ${n(p, 'length') + n(p, 'shoulderLength')} mm; base plane Z=0, tip Z=${p.length}, shoulder base Z=${-n(p, 'shoulderLength')}.`,
    p.solid
      ? 'One filled solid; material and density are project inputs.'
      : 'Hollow construction uses a reduced and shortened inner profile, with a closed tip and retained shoulder web. The wall parameter is a radial/end construction allowance, not constant normal wall thickness.',
  ],
  notes:
    'Authored prototype geometry. Conical profiles are exact straight sections; elliptical and tangent-ogive profiles use 64 straight meridional segments in both preview and native CAD. The shoulder is one continuous body with the nose; no cap, fastener or attachment feature is included. The optional cavity is a reduced/shortened copy and is not a constant normal offset. No OpenRocket file interchange, aerodynamic result, material density or supplier fit is implied.',
  sources: [
    {
      label: 'OpenRocket nose-cone types and shoulder controls',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html',
    },
    {
      label: 'OpenRocket body-component families',
      url: 'https://wiki.openrocket.info/Body_Components_Basics',
    },
  ],
};

export default part;
