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
import { jawCouplingReference } from './lib/catalog/jaw-couplings';

const defaults: Parameters = {
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
  return {
    R,
    L,
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
    screwX: R - screw * (2.9 / 3),
    screwZ: -L / 2 + baseHeight / 2,
    screwSeat: -n(p, 'slitWidth') / 2 - 1,
    screwEnd: R * 0.35,
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

function cylinder(radius: number, height: number, z: number) {
  return primitives.cylinder({ radius, height, center: [0, 0, z + height / 2], segments: 96 });
}

function alongY(radius: number, from: number, to: number, x: number, z: number, segments = 64) {
  return transforms.translate(
    [x, (from + to) / 2, z],
    transforms.rotateX(Math.PI / 2, primitives.cylinder({ radius, height: to - from, segments })),
  );
}

function hubSolid(p: Parameters, bore: number) {
  const v = jawCouplingValues(p);
  const base = cylinder(v.R, v.baseHeight, -v.L / 2);
  const jaws = [0, 120, 240].map((angle) =>
    sector(v.innerJaw, v.R, angle, n(p, 'jawAngle'), v.baseEnd - 0.02, v.t + 0.02),
  );
  const slit = primitives.cuboid({
    size: [v.R + 1, n(p, 'slitWidth'), v.baseHeight + 0.02],
    center: [(v.R + 1) / 2, 0, -v.L / 2 + v.baseHeight / 2 - 0.01],
  });
  return booleans.subtract(
    booleans.union(base, ...jaws),
    cylinder(bore / 2, v.L + 2, -v.L / 2 - 1),
    slit,
    alongY(v.screw / 2 + 0.1, -v.R - 1, v.R + 1, v.screwX, v.screwZ),
    alongY(n(p, 'headDiameter') / 2 + 0.15, -v.R - 1, v.screwSeat, v.screwX, v.screwZ),
  );
}

function screwSolid(p: Parameters) {
  const v = jawCouplingValues(p),
    h = n(p, 'headHeight'),
    top = v.screwSeat - h;
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

function spiderOutline(p: Parameters): [number, number][] {
  const v = jawCouplingValues(p),
    halfJaw = n(p, 'jawAngle') / 2 + 1;
  const points: [number, number][] = [];
  const add = (r: number, angle: number) =>
    points.push([r * Math.cos((angle * Math.PI) / 180), r * Math.sin((angle * Math.PI) / 180)]);
  for (let i = 0; i < 6; i++) {
    const start = i * 60 + halfJaw,
      end = (i + 1) * 60 - halfJaw;
    add(v.spiderRoot, start);
    for (let j = 0; j <= 24; j++) add(v.R - v.clear, start + ((end - start) * j) / 24);
    for (let j = 0; j < 32; j++) add(v.spiderRoot, end + (2 * halfJaw * j) / 32);
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
  const mesh = boundary.build(0xf27a21);
  mesh.name = 'Elastomer spider';
  (mesh.material as MeshStandardMaterial).metalness = 0;
  (mesh.material as MeshStandardMaterial).roughness = 0.65;
  return mesh;
}

/** The shared boolean mesher centers each result, so restore its assembly coordinates. */
function component(solid: Geom3, name: string, color: number) {
  const bounds = modeling.measurements.measureBoundingBox(solid),
    mesh = solidUnionMesh(solid);
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
  const points = sectorPoints(inner, outer, angle, span).map(
    ([x, y]) => `App.Vector(${num(x)},${num(y)},${num(z)})`,
  );
  return `Part.Face(Part.makePolygon([${[...points, points[0]].join(',')}])).extrude(App.Vector(0,0,${num(h)}))`;
}

const part: PartDefinition = {
  id: 'jaw-coupling',
  name: 'Flexible jaw coupling',
  category: 'MOTION',
  subgroup: 'SHAFT COUPLINGS',
  icon: 'wheel',
  complexity: 'Two clamping hubs + elastomer spider',
  description:
    'Independent shaft bores, opposed three-jaw clamping hubs, socket screws and a six-lobe elastomer spider.',
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
  ],
  defaults,
  parameters: [
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Envelope', 10, 150),
    numberParameter('length', 'Overall length', 'L', 'Envelope', 15, 200),
    numberParameter('boreA', 'Shaft bore A', 'd₁', 'Shaft mounting', 1, 100, 0.05),
    numberParameter('boreB', 'Shaft bore B', 'd₂', 'Shaft mounting', 1, 100, 0.05),
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
        48,
        1,
      ),
      unit: '°',
    },
    numberParameter('slitWidth', 'Clamp slit width', 's', 'Clamp detail', 0.2, 3),
    numberParameter('screwDiameter', 'Clamp screw diameter', 'M', 'Clamp detail', 1.5, 12),
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
    },
    numberParameter('headHeight', 'Screw head height', 'k', 'Clamp detail', 1, 12),
  ],
  presets: modulePresets,
  presetMatchKeys: ['outerDiameter', 'length', 'boreA', 'boreB'],
  states: [
    {
      id: 'assembly',
      label: 'Assembly',
      description: 'Two opposed hubs with clamp screws and the elastomer spider.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Axially separated hubs reveal the three-jaw sets and six-lobe spider.',
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
      description: 'The continuous six-lobe flexible insert.',
    },
  ],
  validate(p) {
    const v = jawCouplingValues(p),
      errors: string[] = [],
      head = n(p, 'headDiameter') / 2;
    if (v.baseHeight <= n(p, 'headDiameter') + 1)
      errors.push('Increase the overall length to retain material around each clamp screw.');
    if (v.innerJaw <= v.spiderBore + v.clear + 0.5)
      errors.push('Reduce the shaft bores or jaw depth to leave a continuous spider root.');
    if (v.clear >= n(p, 'jawDepth') * 0.3)
      errors.push('Radial clearance must be below 30% of the jaw depth.');
    if (v.gap >= v.t * 0.2) errors.push('The axial gap must be below 20% of the spider thickness.');
    if (head <= v.screw / 2 + 0.2)
      errors.push('The screw head must exceed the screw shaft diameter.');
    if (v.screwX - head - 0.15 <= v.bore + 0.05)
      errors.push('The clamp counterbore needs material between it and the largest shaft bore.');
    if (Math.hypot(v.screwX + head, v.screwSeat - n(p, 'headHeight')) >= v.R - 0.02)
      errors.push('Reduce the clamp head dimensions to keep it inside the coupling envelope.');
    if (n(p, 'slitWidth') >= v.screw * 0.75)
      errors.push('The clamp slit must remain narrower than the clamp screw.');
    return errors;
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
        second ? 'Clamping hub B' : 'Clamping hub A',
        0xaeb5be,
      );
      const screw = component(screwSolid(p), second ? 'Clamp screw B' : 'Clamp screw A', 0x333b45);
      const assembly = new Group().add(hub, screw);
      if (second) {
        assembly.rotation.x = Math.PI;
        assembly.rotation.z = Math.PI;
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
      for (const angle of [0, 120, 240])
        lines.push(
          `hub = hub.fuse(${sectorPython(v.innerJaw, v.R, angle, n(p, 'jawAngle'), v.baseEnd - 0.02, v.t + 0.02)})`,
        );
      lines.push(
        `hub = hub.cut(Part.makeCylinder(${num(bore / 2)},${num(v.L + 2)},App.Vector(0,0,${num(-v.L / 2 - 1)})))`,
        `hub = hub.cut(Part.makeBox(${num(v.R + 1)},${num(n(p, 'slitWidth'))},${num(v.baseHeight + 0.02)},App.Vector(0,${num(-n(p, 'slitWidth') / 2)},${num(-v.L / 2 - 0.02)})))`,
        `hub = hub.cut(cylinder_y(${num(v.screw / 2 + 0.1)},${num(-v.R - 1)},${num(v.R + 1)},${num(v.screwX)},${num(v.screwZ)}))`,
        `hub = hub.cut(cylinder_y(${num(n(p, 'headDiameter') / 2 + 0.15)},${num(-v.R - 1)},${num(v.screwSeat)},${num(v.screwX)},${num(v.screwZ)})).removeSplitter()`,
        `screw = cylinder_y(${num(n(p, 'headDiameter') / 2)},${num(top)},${num(v.screwSeat)},${num(v.screwX)},${num(v.screwZ)}).fuse(cylinder_y(${num(v.screw / 2 - 0.05)},${num(v.screwSeat - 0.02)},${num(v.screwEnd)},${num(v.screwX)},${num(v.screwZ)}))`,
      );
      const socket = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3,
          radius = (v.screw * 0.3) / Math.cos(Math.PI / 6);
        return `App.Vector(${num(v.screwX + radius * Math.cos(a))},${num(top - 0.1)},${num(v.screwZ + radius * Math.sin(a))})`;
      });
      lines.push(
        `socket = Part.Face(Part.makePolygon([${[...socket, socket[0]].join(',')}])).extrude(App.Vector(0,${num(n(p, 'headHeight') * 0.55 + 0.1)},0))`,
        'screw = screw.cut(socket).removeSplitter()',
        'if len(hub.Solids) != 1 or len(screw.Solids) != 1: raise ValueError("Each clamping hub and screw must remain one solid.")',
      );
      if (second)
        lines.push(
          'hub.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)',
          'screw.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)',
          'hub.rotate(App.Vector(0,0,0),App.Vector(0,0,1),180)',
          'screw.rotate(App.Vector(0,0,0),App.Vector(0,0,1),180)',
        );
      if (shift)
        lines.push(
          `hub.translate(App.Vector(0,0,${num(second ? shift : -shift)}))`,
          `screw.translate(App.Vector(0,0,${num(second ? shift : -shift)}))`,
        );
      lines.push(
        'components.extend([hub,screw])',
        `component_labels.extend(${JSON.stringify([`Clamping hub ${second ? 'B' : 'A'}`, `Clamp screw ${second ? 'B' : 'A'}`])})`,
        'component_colors.extend([(0.68,0.71,0.75),(0.20,0.23,0.27)])',
      );
    }
    if (show.spider) {
      const points = spiderOutline(p).map(
        ([x, y]) => `App.Vector(${num(x)},${num(y)},${num(-v.t / 2)})`,
      );
      lines.push(
        `spider = Part.Face(Part.makePolygon([${[...points, points[0]].join(',')}])).extrude(App.Vector(0,0,${num(v.t)}))`,
      );
      lines.push(
        `spider = spider.cut(Part.makeCylinder(${num(v.spiderBore)},${num(v.t + 2)},App.Vector(0,0,${num(-v.t / 2 - 1)}))).removeSplitter()`,
        'if len(spider.Solids) != 1: raise ValueError("The elastomer spider must be one continuous solid.")',
        'components.append(spider)',
        'component_labels.append("Elastomer spider")',
        'component_colors.append((0.96,0.37,0.08))',
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
    if (state === 'spider')
      return [
        2 *
          Math.max(
            v.spiderRoot,
            (v.R - v.clear) * Math.cos(((n(p, 'jawAngle') / 2 + 1) * Math.PI) / 180),
          ),
        2 * (v.R - v.clear),
        v.t,
      ];
    return [
      2 * v.R,
      2 * v.R,
      state.startsWith('hub-') ? (v.L + v.t) / 2 - v.gap : state === 'exploded' ? v.L * 2.3 : v.L,
    ];
  },
  notes:
    'The attached HLTNC listing specifies only the D25 L30 envelope and shaft bore pairs. Jaw sections, six-lobe spider, clearances, slit and low-profile clamp screws are editable prototype geometry. Clamp bores and shafts are smooth; threads and manufacturing fits are omitted. Rigid assembly and exploded states show construction without simulating torsional stiffness or misalignment.',
  sources: [
    { label: 'User-supplied D25 L30 dimensions and bore options', url: jawCouplingReference },
  ],
};

export default { ...part, presets: modulePresets };
