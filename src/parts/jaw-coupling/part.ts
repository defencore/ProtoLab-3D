import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import { withParameterStates } from '../../core/parameter-states';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { BoundaryMesh } from '../../core/mechanical';
import { booleans, primitives, transforms, solidUnionMesh } from '../../core/solid-union';
import {
  jawCouplingBoreOptions,
  jawCouplingReference,
  lfBorePairs,
} from './lib/catalog/jaw-couplings';

const palette = { hub: 0xaeb5be, screw: 0x333b45, spider: 0xf27a21 };
const pythonColor = (color: number): string =>
  `(${[16, 8, 0].map((shift) => ((color >> shift) & 255) / 255).join(',')})`;

const defaults: Parameters = {
  design: 'hltnc-d25-l30',
  fixing: 'clamp',
  boreOption: '5-8',
  outerDiameter: 25,
  length: 30,
  boreA: 5,
  boreB: 8,
  spiderThickness: 9,
  axialClearance: 0.2,
  radialClearance: 0.15,
  jawDepth: 3.3,
  jawAngle: 36,
  slitWidth: 0.6,
  screwDiameter: 3,
  headDiameter: 4.5,
  headHeight: 2.2,
};

export function jawCouplingValues(p: Parameters) {
  const R = n(p, 'outerDiameter') / 2,
    L = n(p, 'length'),
    t = n(p, 'spiderThickness'),
    gap = n(p, 'axialClearance'),
    clear = n(p, 'radialClearance'),
    innerJaw = R - n(p, 'jawDepth'),
    baseEnd = -t / 2 - gap,
    baseHeight = (L - t) / 2 - gap,
    screw = n(p, 'screwDiameter');
  const lf = p.design === 'lf-d14-l22',
    thimble = p.fixing === 'thimble';
  return {
    R,
    L,
    jaws: lf ? 2 : 3,
    thimble,
    lf,
    t,
    gap,
    clear,
    innerJaw,
    baseEnd,
    baseHeight,
    bore: Math.max(n(p, 'boreA'), n(p, 'boreB')) / 2,
    spiderBore: Math.max(n(p, 'boreA'), n(p, 'boreB')) / 2 + clear + 0.2,
    spiderRoot: innerJaw - clear,
    screw,
    screwX: lf ? R - screw * 0.95 : R - screw * (2.9 / 3),
    screwZ: -L / 2 + baseHeight / 2,
    screwSeat: lf ? -n(p, 'slitWidth') / 2 - 0.4 : -n(p, 'slitWidth') / 2 - 1,
    grubStart: -R + 0.25,
    grubEnd: -Math.max(n(p, 'boreA'), n(p, 'boreB')) / 2 - 0.05,
    screwEnd: R * 0.35,
  };
}

/** Native Z-axis datums for two distinct shaft bores; jaw depth is not shaft insertion depth. */
export function jawCouplingLayout(p: Parameters) {
  const v = jawCouplingValues(p);
  return {
    axis: 'z' as const,
    minimum: -v.L / 2,
    maximum: v.L / 2,
    outsideDiameter: 2 * v.R,
    shaftTipGap: -2 * v.baseEnd,
    hubA: { start: -v.L / 2, end: v.baseEnd, bore: n(p, 'boreA'), grip: v.baseHeight },
    hubB: { start: -v.baseEnd, end: v.L / 2, bore: n(p, 'boreB'), grip: v.baseHeight },
    spiderBore: 2 * v.spiderBore,
  };
}

function sectorPoints(inner: number, outer: number, angle: number, span: number) {
  const points: [number, number][] = [];
  for (const [r, reverse] of [
    [outer, false],
    [inner, true],
  ] as const)
    for (let i = 0; i <= 24; i++) {
      const a = ((angle + span * ((reverse ? 24 - i : i) / 24 - 0.5)) * Math.PI) / 180;
      points.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  return points;
}

function sector(inner: number, outer: number, angle: number, span: number, z: number, h: number) {
  return transforms.translate(
    [0, 0, z],
    modeling.extrusions.extrudeLinear(
      { height: h },
      primitives.polygon({ points: sectorPoints(inner, outer, angle, span) }),
    ),
  );
}

function cylinder(radius: number, height: number, z: number, segments = 96) {
  return primitives.cylinder({ radius, height, center: [0, 0, z + height / 2], segments });
}

function alongY(radius: number, from: number, to: number, x: number, z: number, segments = 64) {
  return transforms.translate(
    [x, (from + to) / 2, z],
    transforms.rotateX(Math.PI / 2, primitives.cylinder({ radius, height: to - from, segments })),
  );
}

function hubSolid(p: Parameters, bore: number) {
  const v = jawCouplingValues(p);
  const base = cylinder(v.R, v.baseHeight, -v.L / 2, v.lf ? 144 : 96);
  const jaws = Array.from({ length: v.jaws }, (_, i) => (360 * i) / v.jaws).map((angle) =>
    sector(v.innerJaw, v.R, angle, n(p, 'jawAngle'), v.baseEnd - 0.02, v.t + 0.02),
  );
  const slit = primitives.cuboid({
    size: [v.R + 1, n(p, 'slitWidth'), v.baseHeight + 0.02],
    center: [(v.R + 1) / 2, 0, -v.L / 2 + v.baseHeight / 2 - 0.01],
  });
  if (v.thimble)
    return booleans.subtract(
      booleans.union(base, ...jaws),
      cylinder(bore / 2, v.L + 2, -v.L / 2 - 1),
      alongY(v.screw / 2 + 0.1, -v.R - 1, 0, 0, v.screwZ),
    );
  return booleans.subtract(
    booleans.union(base, ...jaws),
    cylinder(bore / 2, v.L + 2, -v.L / 2 - 1),
    slit,
    alongY(v.screw / 2 + 0.1, -v.R - 1, v.R + 1, v.screwX, v.screwZ),
    alongY(n(p, 'headDiameter') / 2 + 0.15, -v.R - 1, v.screwSeat, v.screwX, v.screwZ),
  );
}

function screwSolid(p: Parameters, bore: number) {
  const v = jawCouplingValues(p),
    h = n(p, 'headHeight'),
    top = v.screwSeat - h;
  if (v.thimble)
    return booleans.subtract(
      alongY(v.screw / 2 - 0.05, v.grubStart, -bore / 2 - 0.05, 0, v.screwZ),
      alongY(
        (v.screw * 0.27) / Math.cos(Math.PI / 6),
        v.grubStart - 0.1,
        v.grubStart + 0.8,
        0,
        v.screwZ,
        6,
      ),
    );
  const blank = booleans.union(
    alongY(n(p, 'headDiameter') / 2, top, v.screwSeat, v.screwX, v.screwZ),
    alongY(v.screw / 2 - 0.05, v.screwSeat - 0.02, v.screwEnd, v.screwX, v.screwZ),
  );
  return booleans.subtract(
    blank,
    alongY(
      (v.screw * 0.3) / Math.cos(Math.PI / 6),
      top - 0.1,
      top + h * 0.55,
      v.screwX,
      v.screwZ,
      6,
    ),
  );
}

function spiderProfile(p: Parameters) {
  const v = jawCouplingValues(p);
  return {
    root: v.spiderRoot,
    outer: v.R - v.clear,
    bore: v.spiderBore,
    lobes: v.jaws * 2,
    halfJaw: n(p, 'jawAngle') / 2 + 1,
    height: v.t,
  };
}

function spiderOutline(p: Parameters): [number, number][] {
  const profile = spiderProfile(p);
  const points: [number, number][] = [];
  const add = (r: number, angle: number) =>
    points.push([r * Math.cos((angle * Math.PI) / 180), r * Math.sin((angle * Math.PI) / 180)]);
  const pitch = 360 / profile.lobes;
  for (let i = 0; i < profile.lobes; i++) {
    const start = i * pitch + profile.halfJaw,
      end = (i + 1) * pitch - profile.halfJaw;
    add(profile.root, start);
    for (let j = 0; j <= 24; j++) add(profile.outer, start + ((end - start) * j) / 24);
    for (let j = 0; j < 32; j++) add(profile.root, end + (2 * profile.halfJaw * j) / 32);
  }
  return points;
}

function spiderMesh(p: Parameters) {
  const v = jawCouplingValues(p),
    boundary = new BoundaryMesh();
  const outer = [-1, 1].map((side) =>
    spiderOutline(p).map(([x, y]) => new Vector3(x, y, (side * v.t) / 2)),
  );
  const bore = [-1, 1].map((side) =>
    Array.from(
      { length: 96 },
      (_, i) =>
        new Vector3(
          v.spiderBore * Math.cos((i * Math.PI) / 48),
          v.spiderBore * Math.sin((i * Math.PI) / 48),
          (side * v.t) / 2,
        ),
    ),
  );
  boundary.bridge(outer[0], outer[1]);
  boundary.bridge(bore[0], bore[1], true);
  boundary.face(outer[0], [bore[0]], new Vector3(0, 0, -1));
  boundary.face(outer[1], [bore[1]], new Vector3(0, 0, 1));
  const mesh = boundary.build(palette.spider);
  mesh.name = 'Elastomer spider';
  (mesh.material as MeshStandardMaterial).metalness = 0;
  (mesh.material as MeshStandardMaterial).roughness = 0.65;
  return mesh;
}

/** The shared boolean mesher centers each result, so restore its assembly coordinates. */
function component(solid: Geom3, name: string, color: number) {
  const bounds = modeling.measurements.measureBoundingBox(solid),
    mesh = solidUnionMesh(solid, { minimumTriangleArea: 1e-12 });
  mesh.position.set(
    ...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as [number, number, number]),
  );
  mesh.name = name;
  mesh.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    (child.material as MeshStandardMaterial).color.setHex(color);
  });
  return mesh;
}

function selected(state: string) {
  return {
    a: ['assembly', 'exploded', 'hub-a'].includes(state),
    b: ['assembly', 'exploded', 'hub-b'].includes(state),
    spider: ['assembly', 'exploded', 'spider'].includes(state),
  };
}

function sectorPython(
  inner: number,
  outer: number,
  angle: number,
  span: number,
  z: number,
  h: number,
) {
  return `_coupling_sector(${[inner, outer, angle, span, z, h].map(num).join(',')})`;
}

const part: PartDefinition = {
  id: 'jaw-coupling',
  product: productData as ProductProfile,
  name: 'Flexible jaw coupling',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFT COUPLINGS',
  icon: 'wheel',
  complexity: 'Two shaft hubs + elastomer spider',
  description:
    'HLTNC three-jaw and miniature LF two-jaw couplings with independent shaft bores, Clamp or Thimble fastening and a flexible spider.',
  keywords: [
    'coupler',
    'jaw',
    'flexible',
    'shaft',
    'spider',
    'HLTNC',
    'D25L30',
    'D25 L30',
    'motor',
    'CNC',
    'LF',
    'D14L22',
    'D14 L22',
    'Clamp',
    'Thimble',
    'Other hole',
    '\u043c\u0443\u0444\u0442\u0430',
  ],
  defaults,
  parameters: [
    {
      key: 'design',
      label: 'Coupling design',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'hltnc-d25-l30', label: 'HLTNC D25 L30 · three jaws' },
        { value: 'lf-d14-l22', label: 'LF D14 L22 · two jaws' },
      ],
    },
    {
      key: 'fixing',
      label: 'Shaft fastening',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'clamp', label: 'Clamp · split clamping hub' },
        { value: 'thimble', label: 'Thimble · radial set screw' },
      ],
      visibleWhen: (p) => p.design === 'lf-d14-l22',
    },
    {
      key: 'boreOption',
      label: 'Bore pair',
      type: 'select',
      group: 'Shaft mounting',
      options: [
        ...jawCouplingBoreOptions.map(([a, b]) => ({
          value: `${a}-${b}`,
          label: `${a}–${b} mm`,
          availableWhen: (p: Parameters) =>
            p.design === 'lf-d14-l22'
              ? (lfBorePairs[p.fixing as 'clamp' | 'thimble'] ?? []).some(
                  ([x, y]) => x === a && y === b,
                )
              : modulePresets.some(
                  (preset) =>
                    preset.parameters.design === 'hltnc-d25-l30' &&
                    preset.parameters.boreA === a &&
                    preset.parameters.boreB === b,
                ),
        })),
        { value: 'other', label: 'Other hole · custom bores' },
      ],
      description:
        'Listed pairs are available as presets. Other hole enables independent custom shaft bores.',
    },
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Envelope', 10, 150),
    numberParameter('length', 'Overall length', 'L', 'Envelope', 15, 200),
    {
      ...numberParameter('boreA', 'Shaft bore A', 'd₁', 'Shaft mounting', 1, 100, 0.05),
      visibleWhen: (p) => p.boreOption === 'other',
    },
    {
      ...numberParameter('boreB', 'Shaft bore B', 'd₂', 'Shaft mounting', 1, 100, 0.05),
      visibleWhen: (p) => p.boreOption === 'other',
    },
    numberParameter(
      'spiderThickness',
      'Spider axial thickness',
      't',
      'Jaw and spider geometry',
      2,
      80,
    ),
    numberParameter(
      'axialClearance',
      'Spider-to-hub axial gap',
      'g',
      'Jaw and spider geometry',
      0.05,
      3,
      0.05,
    ),
    numberParameter(
      'radialClearance',
      'Spider radial clearance',
      'c',
      'Jaw and spider geometry',
      0.05,
      2,
      0.05,
    ),
    numberParameter('jawDepth', 'Jaw radial depth', 'h', 'Jaw and spider geometry', 1, 30),
    {
      ...numberParameter(
        'jawAngle',
        'Individual jaw arc',
        'α',
        'Jaw and spider geometry',
        15,
        80,
        1,
      ),
      unit: '°',
    },
    {
      ...numberParameter('slitWidth', 'Clamp slit width', 's', 'Fastening detail', 0.2, 3),
      visibleWhen: (p) => p.fixing === 'clamp',
    },
    numberParameter('screwDiameter', 'Fastening screw diameter', 'M', 'Fastening detail', 1.5, 12),
    {
      ...numberParameter(
        'headDiameter',
        'Low-profile screw head diameter',
        'dₕ',
        'Clamp detail',
        2,
        20,
      ),
      description:
        'Editable low-profile socket head; the reference does not specify its dimensions.',
      visibleWhen: (p) => p.fixing === 'clamp',
    },
    {
      ...numberParameter('headHeight', 'Screw head height', 'k', 'Clamp detail', 1, 12),
      visibleWhen: (p) => p.fixing === 'clamp',
    },
  ],
  presets: modulePresets,
  catalogFilterFields: [
    {
      key: 'series',
      label: 'Source series',
      type: 'select',
      group: 'Catalog',
      options: [
        { value: 'HLTNC D25 L30', label: 'HLTNC D25 L30' },
        { value: 'LF D14 L22', label: 'LF D14 L22' },
      ],
    },
    {
      key: 'fastening',
      label: 'Fastening',
      type: 'select',
      group: 'Catalog',
      options: [
        { value: 'clamp', label: 'Clamp' },
        { value: 'thimble', label: 'Thimble' },
      ],
    },
    {
      key: 'boreOrdering',
      label: 'Bore order',
      type: 'select',
      group: 'Catalog',
      options: [
        { value: 'listed', label: 'Listed bore pair' },
        { value: 'custom', label: 'Other hole · custom' },
      ],
    },
    { key: 'sourceEnvelope', label: 'Dimensioned envelope', type: 'boolean', group: 'Catalog' },
  ],
  presetMatchKeys: ['design', 'fixing', 'boreOption', 'outerDiameter', 'length', 'boreA', 'boreB'],
  states: [
    {
      id: 'assembly',
      label: 'Assembly',
      description: 'Two opposed hubs with the selected fastening screws and elastomer spider.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Axially separated hubs reveal the selected two- or three-jaw construction.',
    },
    {
      id: 'hub-a',
      label: 'Hub A',
      description: 'First clamping hub and its screw, with shaft bore A.',
    },
    {
      id: 'hub-b',
      label: 'Hub B',
      description: 'Second clamping hub and its screw, with shaft bore B.',
    },
    {
      id: 'spider',
      label: 'Elastomer spider',
      description: 'The continuous four- or six-lobe flexible insert.',
    },
  ],
  validate(p) {
    const v = jawCouplingValues(p),
      errors: string[] = [],
      head = n(p, 'headDiameter') / 2;
    if (!v.thimble && v.baseHeight <= n(p, 'headDiameter') + (v.lf ? 0.4 : 1))
      errors.push('Increase the overall length to retain material around each clamp screw.');
    if (v.innerJaw <= v.spiderBore + v.clear + 0.5)
      errors.push('Reduce the shaft bores or jaw depth to leave a continuous spider root.');
    if (n(p, 'jawAngle') >= 180 / v.jaws - 2)
      errors.push('Jaw arcs must leave clearance between the opposing jaw sets.');
    if (v.clear >= n(p, 'jawDepth') * 0.3)
      errors.push('Radial clearance must be below 30% of the jaw depth.');
    if (v.gap >= v.t * 0.2) errors.push('The axial gap must be below 20% of the spider thickness.');
    if (!v.thimble && head <= v.screw / 2 + 0.2)
      errors.push('The screw head must exceed the screw shaft diameter.');
    if (!v.thimble && Math.hypot(v.screwX, v.screwSeat) - head - 0.15 <= v.bore + 0.05)
      errors.push('The clamp counterbore needs material between it and the largest shaft bore.');
    if (!v.thimble && Math.hypot(v.screwX + head, v.screwSeat - n(p, 'headHeight')) >= v.R - 0.02)
      errors.push('Reduce the clamp head dimensions to keep it inside the coupling envelope.');
    if (!v.thimble && n(p, 'slitWidth') >= v.screw * 0.75)
      errors.push('The clamp slit must remain narrower than the clamp screw.');
    if (v.thimble && (v.grubEnd - v.grubStart < 0.6 || v.baseHeight <= v.screw + 0.5))
      errors.push('Retain enough hub wall and axial material around the set screw.');
    return errors;
  },
  updateParameters(p, key) {
    if (key === 'design') {
      const lf = p.design === 'lf-d14-l22';
      return {
        ...p,
        ...(lf
          ? {
              outerDiameter: 14,
              length: 22,
              boreA: 3,
              boreB: 3,
              spiderThickness: 8,
              jawDepth: 1.5,
              jawAngle: 60,
              slitWidth: 0.3,
              screwDiameter: 2,
              headDiameter: 3.3,
              headHeight: 1,
              fixing: 'clamp',
              boreOption: '3-3',
            }
          : defaults),
        design: p.design,
      };
    }
    if (key === 'boreA' || key === 'boreB') return { ...p, boreOption: 'other' };
    if (key === 'boreOption' && p.boreOption !== 'other') {
      const [boreA, boreB] = String(p.boreOption).split('-').map(Number);
      return { ...p, boreA, boreB };
    }
    if (key === 'fixing' && p.design === 'lf-d14-l22') {
      const thimble = p.fixing === 'thimble';
      const supported =
        p.boreOption === 'other' ||
        (lfBorePairs[p.fixing as 'clamp' | 'thimble'] ?? []).some(
          ([a, b]) => `${a}-${b}` === p.boreOption,
        );
      return {
        ...p,
        screwDiameter: thimble ? 3 : 2,
        headDiameter: thimble ? 3.4 : 3.3,
        boreOption: supported ? p.boreOption : 'other',
      };
    }
    return p;
  },
  buildGeometry(p, state) {
    const group = new Group(),
      v = jawCouplingValues(p),
      show = selected(state),
      shift = state === 'exploded' ? v.L * 0.65 : 0;
    for (const [enabled, second] of [
      [show.a, false],
      [show.b, true],
    ]) {
      if (!enabled) continue;
      const hub = component(
        hubSolid(p, n(p, second ? 'boreB' : 'boreA')),
        `${v.thimble ? 'Set-screw' : 'Clamping'} hub ${second ? 'B' : 'A'}`,
        palette.hub,
      );
      const screw = component(
        screwSolid(p, n(p, second ? 'boreB' : 'boreA')),
        `${v.thimble ? 'Set screw' : 'Clamp screw'} ${second ? 'B' : 'A'}`,
        palette.screw,
      );
      const assembly = new Group().add(hub, screw);
      if (second) {
        assembly.rotation.x = Math.PI;
        assembly.rotation.z = v.lf ? Math.PI / 2 : Math.PI;
      }
      assembly.position.z = second ? shift : -shift;
      group.add(assembly);
    }
    if (show.spider) group.add(spiderMesh(p));
    const center = new Box3().setFromObject(group, true).getCenter(new Vector3());
    group.position.sub(center);
    return group;
  },
  python(p, state) {
    const v = jawCouplingValues(p),
      show = selected(state),
      shift = state === 'exploded' ? v.L * 0.65 : 0;
    const lines = [
      '# Clamp threads, jaw curvature and elastomer mechanics are prototype representations.',
      'components = []',
      'component_labels = []',
      'component_colors = []',
      'def cylinder_y(radius, y0, y1, x, z):',
      '    return Part.makeCylinder(radius, y1-y0, App.Vector(x,y0,z), App.Vector(0,1,0))',
      'def _coupling_point(radius, angle, z):',
      '    a = math.radians(angle)',
      '    return App.Vector(radius*math.cos(a), radius*math.sin(a), z)',
      'def _coupling_arc(radius, start, end, z):',
      '    return Part.Arc(_coupling_point(radius,start,z), _coupling_point(radius,(start+end)/2,z), _coupling_point(radius,end,z)).toShape()',
      'def _coupling_sector(inner, outer, angle, span, z, height):',
      '    start, end = angle-span/2, angle+span/2',
      '    edges = [_coupling_arc(outer,start,end,z), Part.makeLine(_coupling_point(outer,end,z),_coupling_point(inner,end,z)), _coupling_arc(inner,end,start,z), Part.makeLine(_coupling_point(inner,start,z),_coupling_point(outer,start,z))]',
      '    return Part.Face(Part.Wire(edges)).extrude(App.Vector(0,0,height))',
      'def _coupling_spider(root, outer, lobes, half_jaw, z, height):',
      '    edges = []',
      '    pitch = 360/lobes',
      '    for i in range(lobes):',
      '        start, end = i*pitch+half_jaw, (i+1)*pitch-half_jaw',
      '        edges.extend([Part.makeLine(_coupling_point(root,start,z),_coupling_point(outer,start,z)), _coupling_arc(outer,start,end,z), Part.makeLine(_coupling_point(outer,end,z),_coupling_point(root,end,z)), _coupling_arc(root,end,(i+1)*pitch+half_jaw,z)])',
      '    return Part.Face(Part.Wire(edges)).extrude(App.Vector(0,0,height))',
    ];
    for (const [enabled, second] of [
      [show.a, false],
      [show.b, true],
    ]) {
      if (!enabled) continue;
      const bore = n(p, second ? 'boreB' : 'boreA'),
        top = v.screwSeat - n(p, 'headHeight');
      lines.push(
        `hub = Part.makeCylinder(${num(v.R)},${num(v.baseHeight)},App.Vector(0,0,${num(-v.L / 2)}))`,
      );
      for (const angle of Array.from({ length: v.jaws }, (_, i) => (360 * i) / v.jaws))
        lines.push(
          `hub = hub.fuse(${sectorPython(v.innerJaw, v.R, angle, n(p, 'jawAngle'), v.baseEnd - 0.02, v.t + 0.02)})`,
        );
      lines.push(
        `hub = hub.cut(Part.makeCylinder(${num(bore / 2)},${num(v.L + 2)},App.Vector(0,0,${num(-v.L / 2 - 1)})))`,
      );
      if (v.thimble) {
        lines.push(
          `hub = hub.cut(cylinder_y(${num(v.screw / 2 + 0.1)},${num(-v.R - 1)},0,0,${num(v.screwZ)})).removeSplitter()`,
          `screw = cylinder_y(${num(v.screw / 2 - 0.05)},${num(v.grubStart)},${num(-bore / 2 - 0.05)},0,${num(v.screwZ)})`,
        );
      } else {
        lines.push(
          `hub = hub.cut(Part.makeBox(${num(v.R + 1)},${num(n(p, 'slitWidth'))},${num(v.baseHeight + 0.02)},App.Vector(0,${num(-n(p, 'slitWidth') / 2)},${num(-v.L / 2 - 0.02)})))`,
          `hub = hub.cut(cylinder_y(${num(v.screw / 2 + 0.1)},${num(-v.R - 1)},${num(v.R + 1)},${num(v.screwX)},${num(v.screwZ)}))`,
          `hub = hub.cut(cylinder_y(${num(n(p, 'headDiameter') / 2 + 0.15)},${num(-v.R - 1)},${num(v.screwSeat)},${num(v.screwX)},${num(v.screwZ)})).removeSplitter()`,
          `screw = cylinder_y(${num(n(p, 'headDiameter') / 2)},${num(top)},${num(v.screwSeat)},${num(v.screwX)},${num(v.screwZ)}).fuse(cylinder_y(${num(v.screw / 2 - 0.05)},${num(v.screwSeat - 0.02)},${num(v.screwEnd)},${num(v.screwX)},${num(v.screwZ)}))`,
        );
      }
      const socketStart = v.thimble ? v.grubStart : top,
        socketX = v.thimble ? 0 : v.screwX,
        socketDepth = v.thimble ? 0.8 : n(p, 'headHeight') * 0.55,
        socketRadius = (v.screw * (v.thimble ? 0.27 : 0.3)) / Math.cos(Math.PI / 6);
      const socket = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return `App.Vector(${num(socketX + socketRadius * Math.cos(a))},${num(socketStart - 0.1)},${num(v.screwZ + socketRadius * Math.sin(a))})`;
      });
      lines.push(
        `socket = Part.Face(Part.makePolygon([${[...socket, socket[0]].join(',')}])).extrude(App.Vector(0,${num(socketDepth + 0.1)},0))`,
        'screw = screw.cut(socket).removeSplitter()',
        'if len(hub.Solids) != 1 or len(screw.Solids) != 1: raise ValueError("Each hub and screw must remain one solid.")',
      );
      if (second)
        lines.push(
          'hub.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)',
          'screw.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)',
          `hub.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${v.lf ? 90 : 180})`,
          `screw.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${v.lf ? 90 : 180})`,
        );
      if (shift)
        lines.push(
          `hub.translate(App.Vector(0,0,${num(second ? shift : -shift)}))`,
          `screw.translate(App.Vector(0,0,${num(second ? shift : -shift)}))`,
        );
      lines.push(
        'components.extend([hub,screw])',
        `component_labels.extend(${JSON.stringify([`${v.thimble ? 'Set-screw' : 'Clamping'} hub ${second ? 'B' : 'A'}`, `${v.thimble ? 'Set screw' : 'Clamp screw'} ${second ? 'B' : 'A'}`])})`,
        `component_colors.extend([${pythonColor(palette.hub)},${pythonColor(palette.screw)}])`,
      );
    }
    if (show.spider) {
      const profile = spiderProfile(p);
      lines.push(
        `spider = _coupling_spider(${[profile.root, profile.outer, profile.lobes, profile.halfJaw, -profile.height / 2, profile.height].map(num).join(',')})`,
      );
      lines.push(
        `spider = spider.cut(Part.makeCylinder(${num(v.spiderBore)},${num(v.t + 2)},App.Vector(0,0,${num(-v.t / 2 - 1)}))).removeSplitter()`,
        'if len(spider.Solids) != 1: raise ValueError("The elastomer spider must be one continuous solid.")',
        'components.append(spider)',
        'component_labels.append("Elastomer spider")',
        `component_colors.append(${pythonColor(palette.spider)})`,
      );
    }
    lines.push(
      'shape = Part.makeCompound(components)',
      'center = shape.optimalBoundingBox(False, False).Center',
      'shape.translate(-center)',
    );
    return lines.join('\n');
  },
  dimensions(p, state) {
    const v = jawCouplingValues(p);
    if (state === 'spider') {
      const outline = spiderOutline(p);
      return [0, 1]
        .map(
          (axis) =>
            Math.max(...outline.map((point) => point[axis])) -
            Math.min(...outline.map((point) => point[axis])),
        )
        .concat(v.t) as [number, number, number];
    }
    return [
      2 * v.R,
      2 * v.R,
      state.startsWith('hub-') ? (v.L + v.t) / 2 - v.gap : state === 'exploded' ? v.L * 2.3 : v.L,
    ];
  },
  notes:
    'Source attachments specify the HLTNC D25 L30 envelope and LF D14 L22 drawing. Jaw sections, spider profiles, clearances, slit and screw details are editable prototype geometry. The LF drawing limits bores to 6.5 mm; requested 7–8 mm listing options retain a provisional D14 L22 envelope and require supplier confirmation. Clamp has split hubs and transverse screws; Thimble has unsplit hubs and radial set screws. Threads and manufacturing fits are omitted. Other hole enables independent custom bores.',
  sources: [
    { label: 'User-supplied D25 L30 dimensions and bore options', url: '' },
    {
      label: 'LF D14 L22 · supplied dimension drawing and listed variants',
      url: jawCouplingReference,
    },
    { label: 'LF source photos', url: '' },
    {
      label: 'Clamp and Thimble · side view',
      url: '',
    },
    {
      label: 'Clamp and Thimble · bore view',
      url: '',
    },
    {
      label: 'User-supplied supplier listing',
      url: 'https://www.aliexpress.com/item/1005009016362961.html',
    },
  ],
};

export default withParameterStates(
  { ...part, presets: modulePresets },
  {
    'hub-a': ['boreB', 'radialClearance'],
    'hub-b': ['boreA', 'radialClearance'],
    spider: [
      'length',
      'boreA',
      'axialClearance',
      'slitWidth',
      'screwDiameter',
      'headDiameter',
      'headHeight',
    ],
  },
);
