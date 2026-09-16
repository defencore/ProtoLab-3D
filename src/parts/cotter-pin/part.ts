import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector2, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { BoundaryMesh } from '../../core/mechanical';
import { modelBounds } from './lib/core/hardware';
const presets = modulePresets;

type Station = { point: Vector2; tangent: Vector2 };

function leg(p: Parameters, state: string, length: number, side: number): Station[] {
  const gap = n(p, 'splitGap') / 2;
  const stations: Station[] = [{ point: new Vector2(side * gap, 0), tangent: new Vector2(0, 1) }];
  if (state !== 'bent') {
    stations.push({ point: new Vector2(side * gap, length), tangent: new Vector2(0, 1) });
    return stations;
  }
  const start = (n(p, 'length') * n(p, 'bendPosition')) / 100;
  const radius = n(p, 'bendRadius');
  const angle = (n(p, 'bendAngle') * Math.PI) / 180;
  const steps = Math.max(1, Math.ceil(n(p, 'bendAngle') / 5));
  for (let i = 0; i <= steps; i++) {
    const a = (angle * i) / steps;
    stations.push({
      point: new Vector2(side * (gap + radius * (1 - Math.cos(a))), start + radius * Math.sin(a)),
      tangent: new Vector2(side * Math.sin(a), Math.cos(a)),
    });
  }
  const last = stations.at(-1)!;
  stations.push({
    point: last.point.clone().addScaledVector(last.tangent, length - start - radius * angle),
    tangent: last.tangent.clone(),
  });
  return stations;
}

function cubic(a: Vector2, b: Vector2, c: Vector2, d: Vector2, t: number): Station {
  const s = 1 - t;
  return {
    point: a
      .clone()
      .multiplyScalar(s ** 3)
      .addScaledVector(b, 3 * s * s * t)
      .addScaledVector(c, 3 * s * t * t)
      .addScaledVector(d, t ** 3),
    tangent: b
      .clone()
      .sub(a)
      .multiplyScalar(3 * s * s)
      .addScaledVector(c.clone().sub(b), 6 * s * t)
      .addScaledVector(d.clone().sub(c), 3 * t * t)
      .normalize(),
  };
}

/** A single folded half-round wire keeps the eye and both legs in one solid. */
function sections(p: Parameters, state: string): Vector3[][] {
  const radius = (n(p, 'shankDiameter') - n(p, 'splitGap')) / 2;
  const gap = n(p, 'splitGap') / 2;
  const eyeRadius = n(p, 'eyeWidth') / 2 - radius;
  const centerZ = -n(p, 'eyeLength') + n(p, 'eyeWidth') / 2;
  const start = new Vector2(gap, 0);
  const c1 = new Vector2(gap, centerZ * 0.48);
  const c2 = new Vector2(eyeRadius, centerZ * 0.52);
  const end = new Vector2(eyeRadius, centerZ);
  const transition = Array.from({ length: 17 }, (_, i) => cubic(start, c1, c2, end, i / 16));
  const eye: Station[] = [...transition];
  for (let i = 1; i <= 48; i++) {
    const angle = (Math.PI * i) / 48;
    eye.push({
      point: new Vector2(eyeRadius * Math.cos(angle), centerZ - eyeRadius * Math.sin(angle)),
      tangent: new Vector2(-Math.sin(angle), -Math.cos(angle)),
    });
  }
  eye.push(
    ...transition
      .slice(0, -1)
      .reverse()
      .map(({ point, tangent }) => ({
        point: new Vector2(-point.x, point.y),
        tangent: new Vector2(tangent.x, -tangent.y),
      })),
  );
  const shortLeg = leg(p, state, n(p, 'length'), 1)
    .reverse()
    .map(({ point, tangent }) => ({ point, tangent: tangent.negate() }));
  const longLeg = leg(p, state, n(p, 'length') + n(p, 'tailExtension'), -1);
  const path = [...shortLeg, ...eye.slice(1), ...longLeg.slice(1)];
  return path.map(({ point, tangent }) => {
    const normal = new Vector2(-tangent.y, tangent.x);
    return Array.from({ length: 17 }, (_, i) => {
      const angle = Math.PI / 2 - (Math.PI * i) / 16;
      const displacement = radius * Math.cos(angle);
      return new Vector3(
        point.x + normal.x * displacement,
        radius * Math.sin(angle),
        point.y + normal.y * displacement,
      );
    });
  });
}

const defaults = {
  diameter: 4,
  length: 32,
  shankDiameter: 3.7,
  eyeLength: 8,
  eyeWidth: 7.4,
  tailExtension: 2,
  splitGap: 0.0555,
  bendAngle: 65,
  bendPosition: 65,
  bendRadius: 2.59,
};

const part: PartDefinition = {
  id: 'cotter-pin',
  name: 'Split cotter pin',
  category: 'FASTENERS & THREADS',
  subgroup: 'PINS & DOWELS',
  icon: 'bolt',
  complexity: 'Folded half-round wire',
  standard: 'DIN 94 / ISO 1234 reference',
  description:
    'A loop-headed split cotter pin with unequal half-round legs and a bent installation state.',
  keywords: ['cotter', 'split pin', 'retaining pin', 'DIN 94', 'ISO 1234', 'bent legs'],
  defaults,
  parameters: [
    {
      ...numberParameter('diameter', 'Nominal hole diameter', 'd', 'Supplier size', 0.6, 20),
      description: 'Catalog size; the actual pin shank is slightly smaller.',
    },
    {
      ...numberParameter('length', 'Short leg length', 'l', 'Supplier size', 4, 300),
      description: 'Length from the end of the eye to the short leg tip, before bending.',
    },
    numberParameter('shankDiameter', 'Shank diameter', 'd₁', 'Shank & eye', 0.4, 19.3),
    numberParameter('eyeLength', 'Eye length', 'b', 'Shank & eye', 1.5, 50),
    numberParameter('eyeWidth', 'Eye width', 'c', 'Shank & eye', 0.9, 40),
    numberParameter('tailExtension', 'Long leg extension', 'a', 'Shank & eye', 0.3, 10),
    {
      ...numberParameter('splitGap', 'Leg separation', 'g', 'Shank & eye', 0.005, 1, 0.005),
      description: 'A small prototype clearance keeps the two flat leg surfaces separate.',
    },
    {
      ...numberParameter('bendAngle', 'Leg bend angle', 'β', 'Installation', 5, 100, 1),
      visibleWhen: (_, state) => state === undefined || state === 'bent',
      unit: '°',
    },
    {
      ...numberParameter(
        'bendPosition',
        'Bend position along short leg',
        'p',
        'Installation',
        15,
        90,
        1,
      ),
      visibleWhen: (_, state) => state === undefined || state === 'bent',
      unit: '%',
    },
    {
      ...numberParameter('bendRadius', 'Bend radius at flat surface', 'R', 'Installation', 0.1, 30),
      visibleWhen: (_, state) => state === undefined || state === 'bent',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['diameter', 'length'],
  updateParameters(p, changedKey) {
    if (changedKey !== 'diameter') return p;
    const stock = presets.find((preset) => preset.parameters.diameter === p.diameter);
    if (!stock) return p;
    return {
      ...p,
      ...Object.fromEntries(
        ['shankDiameter', 'eyeLength', 'eyeWidth', 'tailExtension', 'splitGap', 'bendRadius'].map(
          (key) => [key, stock.parameters[key as keyof typeof stock.parameters]],
        ),
      ),
    };
  },
  states: [
    { id: 'straight', label: 'Straight', description: 'Closed legs before insertion.' },
    {
      id: 'bent',
      label: 'Bent legs',
      description: 'Legs spread out after insertion; geometric installation preview.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (n(p, 'shankDiameter') >= n(p, 'diameter'))
      errors.push('The actual shank diameter must be smaller than its nominal hole diameter.');
    if (n(p, 'splitGap') >= n(p, 'shankDiameter') * 0.1)
      errors.push('Leg separation must be less than 10% of the shank diameter.');
    if (n(p, 'eyeWidth') < n(p, 'shankDiameter') * 1.8)
      errors.push('Eye width must be at least 1.8 times the shank diameter.');
    if (n(p, 'eyeLength') < n(p, 'eyeWidth'))
      errors.push('Eye length must be at least its width to keep the neck transitions clear.');
    if (
      state === 'bent' &&
      (n(p, 'bendRadius') * n(p, 'bendAngle') * Math.PI) / 180 >=
        n(p, 'length') * (1 - n(p, 'bendPosition') / 100)
    )
      errors.push('The bend arc must fit within the free part of the shorter leg.');
    return errors;
  },
  buildGeometry(p, state) {
    const rings = sections(p, state);
    const mesh = new BoundaryMesh();
    for (let i = 1; i < rings.length; i++) mesh.bridge(rings[i - 1], rings[i]);
    const capNormal = (ring: Vector3[]) =>
      ring[1].clone().sub(ring[0]).cross(ring[2].clone().sub(ring[0])).normalize();
    mesh.face(rings[0], [], capNormal(rings[0]).negate());
    mesh.face(rings.at(-1)!, [], capNormal(rings.at(-1)!));
    const group = new Group();
    group.add(mesh.build());
    return group;
  },
  python(p, state) {
    const wires = sections(p, state).map(
      (ring) =>
        `Part.makePolygon([${[...ring, ring[0]].map((point) => `App.Vector(${num(point.x)}, ${num(point.y)}, ${num(point.z)})`).join(',')}])`,
    );
    return `sections = [${wires.join(',\n')}]\nshape = Part.makeLoft(sections, True, True).removeSplitter()`;
  },
  dimensions(p, state) {
    return modelBounds(part.buildGeometry(p, state));
  },
  notes:
    'Supplier presets use the linked DIN 94 drawing: maximum shank and eye widths, approximate eye length, and minimum unequal-leg projection. The eye has a continuous half-round cross section. Eye transitions, small leg clearance, square-cut tips and installation bends are prototype geometry. Bending preserves each flat-surface path length; it does not simulate material deformation. Curved surfaces use polygonal sections.',
  sources: [
    {
      label: 'Gvyntok · DIN 94 dimensional drawing',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/080-010-001.pdf',
    },
    {
      label: 'Gvyntok · all DIN 94 split cotter pins',
      url: 'https://gvyntok.com/product-category/shplinty-i-strubtsiny/shplint-pryamoj-din-94/',
    },
  ],
};

export default { ...part, presets: modulePresets };
