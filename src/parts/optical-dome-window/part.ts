import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import { component, pythonShape, type Shape } from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

export function domeLayout(p: Parameters) {
  const baseRadius = n(p, 'domeDiameter') / 2;
  const rise = n(p, 'height') - n(p, 'flangeThickness');
  const sphereRadius = (baseRadius * baseRadius + rise * rise) / (2 * rise);
  const centerZ = n(p, 'height') - sphereRadius;
  const insideRadius = sphereRadius - n(p, 'wall');
  const openingRadius = Math.sqrt(insideRadius * insideRadius - centerZ * centerZ);
  return { baseRadius, rise, sphereRadius, centerZ, insideRadius, openingRadius };
}

export function domeShape(p: Parameters): Shape {
  const a = domeLayout(p);
  const flange = n(p, 'flangeDiameter') / 2;
  const f = n(p, 'flangeThickness');
  const outerAngle = Math.acos((f - a.centerZ) / a.sphereRadius);
  const innerAngle = Math.acos(-a.centerZ / a.insideRadius);
  const outer: [number, number][] = Array.from({ length: 64 }, (_, index) => {
    const theta = outerAngle * (1 - (index + 1) / 64);
    return [a.sphereRadius * Math.sin(theta), a.centerZ + a.sphereRadius * Math.cos(theta)];
  });
  const inner: [number, number][] = Array.from({ length: 65 }, (_, index) => {
    const theta = (innerAngle * index) / 64;
    return [
      a.insideRadius * Math.sin(theta),
      index === 64 ? 0 : a.centerZ + a.insideRadius * Math.cos(theta),
    ];
  });
  return {
    kind: 'revolve',
    segments: 128,
    profile: [[flange, 0], [flange, f], [a.baseRadius, f], ...outer, ...inner],
  };
}

function geometry(p: Parameters, transparent: boolean): Group {
  const model = new Group().add(component(domeShape(p), 'Optical dome window', 0xa8d0e5));
  if (transparent)
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.transparent = true;
        material.opacity = 0.42;
        material.metalness = 0;
        material.roughness = 0.08;
        material.depthWrite = false;
      }
    });
  return model;
}

const part: PartDefinition = {
  id: 'optical-dome-window',
  name: 'Flanged optical dome window',
  category: 'ELECTRONICS & VISION',
  subgroup: 'CAMERAS & VISION',
  icon: 'camera',
  complexity: 'User envelope / assumed shell',
  description:
    'A transparent flanged camera window with a user-dimensioned outside envelope and an authored open-backed spherical shell.',
  keywords: [
    'optical dome',
    'lens',
    'window',
    'camera window',
    '23 mm',
    '17 mm',
    'nose cone',
    'LDRS',
    'CSI camera',
  ],
  product: product as ProductProfile,
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['flangeDiameter', 'domeDiameter', 'height'],
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
    const radius = n(p, 'domeDiameter') / 2;
    const rise = n(p, 'height') - n(p, 'flangeThickness');
    if (n(p, 'flangeDiameter') < n(p, 'domeDiameter') + 1)
      errors.push('Leave at least 0.5 mm radial flange beyond the dome base.');
    if (rise <= n(p, 'wall') + 0.2)
      errors.push('The dome rise must exceed the assumed shell thickness by at least 0.2 mm.');
    if (rise > radius) errors.push('The spherical cap rise must not exceed the dome base radius.');
    if (errors.length) return errors;
    const a = domeLayout(p);
    if (!Number.isFinite(a.openingRadius) || a.openingRadius < 0.5)
      errors.push(
        'The assumed inner spherical surface must leave an open rear aperture of at least 1 mm diameter.',
      );
    return errors;
  },
  buildGeometry: (p) => geometry(p, true),
  buildExportGeometry: (p) => geometry(p, false),
  python: (p) => `shape = ${pythonShape(domeShape(p))}`,
  dimensions: (p) => [n(p, 'flangeDiameter'), n(p, 'flangeDiameter'), n(p, 'height')],
  assessment: (p) => [
    `User outside envelope D${p.flangeDiameter} flange / D${p.domeDiameter} cap x ${p.height} mm. Flange underside is Z=0; the optical axis points +Z.`,
    `Assumed open rear aperture D${(2 * domeLayout(p).openingRadius).toFixed(2)} mm. Flange thickness and shell thickness require measurement.`,
  ],
  notes:
    'The supplied image establishes only the 23 mm outside flange, 17 mm dome diameter and 6 mm overall height. Flange thickness, shell wall and spherical surfaces are authored fitting assumptions. Concentric spherical surfaces are sampled into 64 meridional segments in both preview and native CAD; the annular flange is integral. The rear aperture opens at Z=0. Preview transparency is illustrative. No focal length, optical power, material, refractive index, coating, distortion, sealing or impact rating is established. The image does not determine whether the original item is a protective cover or a powered optical lens.',
};

export default part;
