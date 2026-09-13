import * as THREE from 'three';
import { material, n, num, numberParameter } from '../../../../core/geometry';
import type { ParameterDefinition, Parameters } from '../../../../core/types';
import {
  shaftBoreOutline,
  shaftBoreParameters,
  shaftBorePython,
  shaftBoreRadius,
  shaftBoreValues,
  validateShaftBore,
  type ShaftBore,
} from './shaft-bore';

export const gearSources = [
  {
    label: 'KHK · gear dimensions and normal / transverse modules',
    url: 'https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/',
  },
];

export interface GearValues {
  module: number;
  teeth: number;
  angle: number;
  pitchRadius: number;
  baseRadius: number;
  rootRadius: number;
  tipRadius: number;
  halfThickness: number;
  width: number;
  bore: number;
  boreProfile: ShaftBore;
  hubRadius: number;
  length: number;
  beta: number;
}

interface ProfileSegment {
  kind: 'line' | 'arc' | 'spline';
  points: [number, number][];
}

export interface GearProfile {
  points: THREE.Vector2[];
  segments: ProfileSegment[];
}

export interface GearLayer {
  z: number;
  angle: number;
  scale: number;
}

export function gearValues(p: Parameters, helical = false): GearValues {
  const module = n(p, 'module');
  const teeth = n(p, 'teeth');
  const beta = helical ? (n(p, 'helixAngle') * Math.PI) / 180 : 0;
  const angle = Math.atan(Math.tan((n(p, 'pressureAngle') * Math.PI) / 180) / Math.cos(beta));
  const pitchRadius = (module * teeth) / (2 * Math.cos(beta));
  const width = n(p, 'faceWidth');
  return {
    module,
    teeth,
    angle,
    beta,
    pitchRadius,
    baseRadius: pitchRadius * Math.cos(angle),
    rootRadius: pitchRadius - 1.25 * module,
    tipRadius: pitchRadius + module,
    halfThickness: Math.PI / (2 * teeth) - n(p, 'backlash') / (4 * pitchRadius),
    width,
    bore: n(p, 'bore') / 2,
    boreProfile: shaftBoreValues(p),
    hubRadius: p.hub ? n(p, 'hubDiameter') / 2 : 0,
    length: p.hub ? n(p, 'hubLength') : width,
  };
}

export function gearParameters(normal = false, hub = true): ParameterDefinition[] {
  const fields: ParameterDefinition[] = [
    {
      ...numberParameter(
        'module',
        normal ? 'Normal module' : 'Module',
        normal ? 'mn' : 'm',
        'Teeth',
        0.2,
        8,
        0.1,
      ),
      description: normal
        ? 'Measured in the plane normal to the tooth. Use equal normal module and pressure angle for a mating pair.'
        : 'Pitch diameter = module × number of teeth.',
    },
    { ...numberParameter('teeth', 'Number of teeth', 'z', 'Teeth', 12, 120, 1), unit: '' },
    {
      ...numberParameter(
        'pressureAngle',
        normal ? 'Normal pressure angle' : 'Pressure angle',
        'α',
        'Teeth',
        14.5,
        30,
        0.5,
      ),
      unit: '°',
    },
    {
      ...numberParameter('backlash', 'Pair backlash allowance', 'j', 'Teeth', 0, 2, 0.01),
      description:
        'Each gear tooth is thinned by half this tangential allowance at the transverse pitch circle. Use the same value on its mating gear.',
    },
    numberParameter('faceWidth', 'Axial face width', 'b', 'Body', 1, 80, 0.5),
    {
      ...numberParameter('bore', 'Shaft bore', 'd', 'Body', 0, 150),
      description:
        'Diameter for round / D / keyed holes; across flats for hex / square; inscribed diameter for custom polygons. Enter 0 for a solid blank.',
    },
    ...shaftBoreParameters(),
  ];
  if (hub)
    fields.push(
      { key: 'hub', label: 'Extended hub', type: 'boolean', group: 'Hub' },
      {
        ...numberParameter('hubDiameter', 'Hub diameter', 'Dh', 'Hub', 1, 200),
        visibleWhen: (p) => Boolean(p.hub),
      },
      {
        ...numberParameter('hubLength', 'Overall hub length', 'Lh', 'Hub', 1, 150),
        visibleWhen: (p) => Boolean(p.hub),
        description: 'The hub projects equally from both sides. Includes the gear face width.',
      },
    );
  return fields;
}

function involuteAngle(radius: number, baseRadius: number): number {
  const t = Math.sqrt(Math.max(0, (radius / baseRadius) ** 2 - 1));
  return t - Math.atan(t);
}

/** Sample the actual involute above the base circle; use radial root relief below it. */
export function involuteProfile(v: GearValues): GearProfile {
  const segments: ProfileSegment[] = [];
  const points: THREE.Vector2[] = [];
  const pitchInvolute = Math.tan(v.angle) - v.angle;
  const startRadius = Math.max(v.rootRadius, v.baseRadius);
  const flankHalfAngle = (radius: number) =>
    v.halfThickness + pitchInvolute - involuteAngle(radius, v.baseRadius);
  const rootHalfAngle = flankHalfAngle(startRadius);
  const tipHalfAngle = flankHalfAngle(v.tipRadius);
  const polar = (radius: number, angle: number): [number, number] => [
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  ];
  const append = (kind: ProfileSegment['kind'], samples: [number, number][]) => {
    if (Math.hypot(samples[0][0] - samples.at(-1)![0], samples[0][1] - samples.at(-1)![1]) < 1e-9)
      return;
    segments.push({ kind, points: samples });
    for (const point of samples.slice(0, -1)) points.push(new THREE.Vector2(...point));
  };
  for (let tooth = 0; tooth < v.teeth; tooth++) {
    const center = (tooth * 2 * Math.PI) / v.teeth;
    const leftRoot = polar(v.rootRadius, center - rootHalfAngle);
    const leftStart = polar(startRadius, center - rootHalfAngle);
    if (v.rootRadius < startRadius) append('line', [leftRoot, leftStart]);
    const flank = Array.from({ length: 11 }, (_, i) => {
      const t0 = Math.sqrt(Math.max(0, (startRadius / v.baseRadius) ** 2 - 1));
      const t1 = Math.sqrt((v.tipRadius / v.baseRadius) ** 2 - 1);
      const t = t0 + ((t1 - t0) * i) / 10;
      const radius = v.baseRadius * Math.sqrt(1 + t * t);
      return polar(radius, center - flankHalfAngle(radius));
    });
    append('spline', flank);
    append(
      'arc',
      Array.from({ length: 5 }, (_, i) =>
        polar(v.tipRadius, center - tipHalfAngle + (2 * tipHalfAngle * i) / 4),
      ),
    );
    append(
      'spline',
      [...flank].reverse().map(([x, y]) => {
        const radius = Math.hypot(x, y);
        return polar(radius, center + flankHalfAngle(radius));
      }),
    );
    if (v.rootRadius < startRadius)
      append('line', [
        polar(startRadius, center + rootHalfAngle),
        polar(v.rootRadius, center + rootHalfAngle),
      ]);
    const nextLeft = center + (2 * Math.PI) / v.teeth - rootHalfAngle;
    append(
      'arc',
      Array.from({ length: 5 }, (_, i) =>
        polar(v.rootRadius, center + rootHalfAngle + ((nextLeft - center - rootHalfAngle) * i) / 4),
      ),
    );
  }
  return { points, segments };
}

export function validateGear(p: Parameters, helical = false, minimumScale = 1): string[] {
  const v = gearValues(p, helical);
  const errors: string[] = validateShaftBore(v.boreProfile);
  const normalAngle = (n(p, 'pressureAngle') * Math.PI) / 180;
  const minimumTeeth = Math.ceil((2 * Math.cos(v.beta) ** 3) / Math.sin(normalAngle) ** 2);
  if (!Number.isInteger(v.teeth)) errors.push('Number of teeth must be an integer.');
  if (v.teeth < minimumTeeth)
    errors.push(
      `Use at least ${minimumTeeth} teeth at this pressure / helix angle. This unshifted profile does not model cutter undercut.`,
    );
  if (n(p, 'backlash') >= (Math.PI * v.module) / 3)
    errors.push('Backlash allowance must be less than one third of the circular pitch.');
  if (
    v.halfThickness + Math.tan(v.angle) - v.angle - involuteAngle(v.tipRadius, v.baseRadius) <=
    0.002
  )
    errors.push(
      'These parameters produce pointed or overlapping tooth tips. Reduce backlash or pressure angle.',
    );
  const boreRadius = shaftBoreRadius(v.boreProfile);
  if (boreRadius + Math.max(0.3, v.module * 0.5) >= v.rootRadius * minimumScale)
    errors.push('The shaft bore leaves too little material below the tooth roots.');
  if (p.hub) {
    if (v.hubRadius <= boreRadius + 0.3)
      errors.push('The hub diameter must leave at least 0.3 mm of wall around the bore.');
    if (v.hubRadius >= v.rootRadius * minimumScale)
      errors.push('The hub must fit inside the tooth root diameter.');
    if (v.length <= v.width) errors.push('The overall hub length must exceed the gear face width.');
  }
  return errors;
}

function circle(radius: number): THREE.Vector2[] {
  return Array.from(
    { length: 96 },
    (_, i) =>
      new THREE.Vector2(
        radius * Math.cos((2 * Math.PI * i) / 96),
        radius * Math.sin((2 * Math.PI * i) / 96),
      ),
  );
}

function layerPoints(profile: GearProfile, layer: GearLayer): THREE.Vector2[] {
  return profile.points.map((point) =>
    point.clone().multiplyScalar(layer.scale).rotateAround(new THREE.Vector2(), layer.angle),
  );
}

/** One closed shell, including the bore and optional hub shoulders, for usable STL export. */
export function gearGeometry(v: GearValues, layers: GearLayer[]): THREE.Group {
  const profile = involuteProfile(v);
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  const wall = (a: THREE.Vector2[], za: number, b: THREE.Vector2[], zb: number, inward = false) => {
    for (let i = 0; i < a.length; i++) {
      const next = (i + 1) % a.length;
      const p = new THREE.Vector3(a[i].x, a[i].y, za);
      const q = new THREE.Vector3(a[next].x, a[next].y, za);
      const r = new THREE.Vector3(b[i].x, b[i].y, zb);
      const s = new THREE.Vector3(b[next].x, b[next].y, zb);
      if (inward) {
        triangle(p, r, q);
        triangle(q, r, s);
      } else {
        triangle(p, q, r);
        triangle(q, s, r);
      }
    }
  };
  const bore = shaftBoreOutline(v.boreProfile);
  const cap = (outer: THREE.Vector2[], hole: THREE.Vector2[], z: number, top: boolean) => {
    const holes = hole.length ? [[...hole].reverse()] : [];
    const vertices = [...outer, ...holes.flat()];
    const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
    for (const indices of triangles) {
      const [a, b, c] = indices.map((i) => new THREE.Vector3(vertices[i].x, vertices[i].y, z));
      if (top) triangle(a, b, c);
      else triangle(a, c, b);
    }
  };
  for (let i = 1; i < layers.length; i++)
    wall(
      layerPoints(profile, layers[i - 1]),
      layers[i - 1].z,
      layerPoints(profile, layers[i]),
      layers[i].z,
    );
  for (const [layer, top] of [
    [layers[0], false],
    [layers.at(-1)!, true],
  ] as const) {
    cap(layerPoints(profile, layer), v.hubRadius ? circle(v.hubRadius) : bore, layer.z, top);
    if (v.hubRadius) {
      const end = ((top ? 1 : -1) * v.length) / 2;
      wall(
        circle(v.hubRadius),
        Math.min(end, layer.z),
        circle(v.hubRadius),
        Math.max(end, layer.z),
      );
      cap(circle(v.hubRadius), bore, end, top);
    }
  }
  if (bore.length) wall(bore, -v.length / 2, bore, v.length / 2, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material()));
  return group;
}

export function gearDimensions(v: GearValues, layers: GearLayer[]): [number, number, number] {
  const profile = involuteProfile(v);
  const bounds = new THREE.Box2();
  for (const layer of layers)
    for (const point of layerPoints(profile, layer)) bounds.expandByPoint(point);
  const size = bounds.getSize(new THREE.Vector2());
  return [size.x, size.y, v.length];
}

export function gearPython(v: GearValues, layers: GearLayer[]): string {
  const profile = involuteProfile(v);
  // CAD interpolates the same involute samples and keeps circular tips / roots analytic.
  const segments = profile.segments.map(({ kind, points }) => [
    kind,
    points.map(([x, y]) => [Number(num(x)), Number(num(y))]),
  ]);
  const data = JSON.stringify(segments);
  return `profile_segments = ${data}
def gear_wire(scale, angle, z):
    edges = []
    for kind, coordinates in profile_segments:
        points = [App.Vector(scale * (x * math.cos(angle) - y * math.sin(angle)), scale * (x * math.sin(angle) + y * math.cos(angle)), z) for x, y in coordinates]
        if kind == "line":
            edges.append(Part.makeLine(points[0], points[-1]))
        elif kind == "arc":
            edges.append(Part.Arc(points[0], points[len(points) // 2], points[-1]).toShape())
        else:
            curve = Part.BSplineCurve()
            curve.interpolate(points)
            edges.append(curve.toShape())
    return Part.Wire(edges)
layers = ${JSON.stringify(layers.map(({ scale, angle, z }) => [scale, angle, z]))}
wires = [gear_wire(scale, angle, z) for scale, angle, z in layers]
${layers.length === 2 && layers[0].scale === layers[1].scale && layers[0].angle === layers[1].angle ? `shape = Part.Face(wires[0]).extrude(App.Vector(0, 0, ${num(v.width)}))` : 'shape = Part.makeLoft(wires, True, True)'}
${
  v.hubRadius
    ? `hub = Part.makeCylinder(${num(v.hubRadius)}, ${num(v.length)}, App.Vector(0, 0, ${num(-v.length / 2)}))
shape = shape.fuse(hub)`
    : ''
}
${
  v.bore > 0
    ? `${shaftBorePython(v.boreProfile, v.length + 2, -v.length / 2 - 1)}
shape = shape.cut(bore)`
    : ''
}
shape = shape.removeSplitter()`;
}

export function straightLayers(v: GearValues): GearLayer[] {
  return [
    { z: -v.width / 2, angle: 0, scale: 1 },
    { z: v.width / 2, angle: 0, scale: 1 },
  ];
}

export function helicalLayers(p: Parameters, v: GearValues): GearLayer[] {
  const twist = ((v.width * Math.tan(v.beta)) / v.pitchRadius) * (p.hand === 'left' ? -1 : 1);
  const count = Math.max(4, Math.ceil(Math.abs(twist) / (Math.PI / 36) / 2) * 2);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return {
      z: (t - 0.5) * v.width,
      angle: p.style === 'herringbone' ? (0.5 - Math.abs(t - 0.5)) * twist : (t - 0.5) * twist,
      scale: 1,
    };
  });
}
