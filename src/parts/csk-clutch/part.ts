import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector2, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import {
  n,
  num,
  numberParameter,
  sphere,
  ring,
  annulusPython,
  compoundPython,
} from '../../core/geometry';
import { BoundaryMesh, loftMesh, pythonWire } from '../../core/mechanical';
import { modelBounds } from './lib/core/hardware';
import { cageMesh, cagePython, type CageLayout } from './lib/parts/bearing-cage';
import {
  envelopeParameters,
  turnedPython,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';

/** Manufacturer key dimensions are reference defaults, not shop-verified attributes. */
export function cskKeyDimensions(bore: number) {
  const row: Record<number, number[]> = {
    8: [2.5, 0.8, 2, 0.5],
    12: [4, 1.8, 2, 0.6],
    15: [5, 1.2, 2, 0.6],
    17: [5, 1.2, 2, 1],
    20: [6, 1.6, 3, 1.5],
    25: [8, 2, 6, 2],
    30: [8, 2, 6, 2],
    35: [10, 2.4, 8, 2.5],
    40: [12, 3.3, 10, 3],
  };
  // No outer key is specified for CSK 8/12 in the reference table; these are editable examples.
  const [innerKeyWidth, innerKeyDepth, outerKeyWidth, outerKeyDepth] = row[bore] ?? [
    bore * 0.25,
    bore * 0.065,
    bore * 0.2,
    bore * 0.065,
  ];
  return { innerKeyWidth, innerKeyDepth, outerKeyWidth, outerKeyDepth };
}

function values(p: Parameters) {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    w = n(p, 'width'),
    gap = R - r;
  const pitch = (r + R) / 2,
    ballRadius = Math.min(gap * 0.195, w * 0.175);
  return {
    r,
    R,
    w,
    gap,
    pitch,
    ballRadius,
    ballZ: -w * 0.21,
    spragZ: w * 0.21,
    spragHeight: gap * 0.3,
    spragLength: w * 0.32,
  };
}

function raceProfiles(p: Parameters): TurnedProfile[] {
  const v = values(p),
    inner: TurnedProfile = [],
    outer: TurnedProfile = [];
  const grooveRadius = v.ballRadius + Math.min(v.gap, v.w) * 0.012;
  for (let i = 0; i <= 64; i++) {
    const z = v.w * (i / 64 - 0.5),
      distance = Math.abs(z - v.ballZ);
    const reach = distance < grooveRadius ? Math.sqrt(grooveRadius ** 2 - distance ** 2) : 0;
    inner.push([Math.min(v.r + v.gap * 0.33, v.pitch - reach), z]);
    outer.push([Math.max(v.r + v.gap * 0.67, v.pitch + reach), z]);
  }
  return [inner, outer];
}

function circle(radius: number) {
  return Array.from(
    { length: 96 },
    (_, i) =>
      new Vector2(radius * Math.cos((i * Math.PI) / 48), radius * Math.sin((i * Math.PI) / 48)),
  );
}

/** A rectangular keyseat interrupts the circular contour; both keys use the same clocking. */
function keyedContour(radius: number, width: number, depth: number, bore: boolean) {
  const angle = Math.asin(width / (2 * radius));
  const start = Math.PI / 2 + angle,
    end = Math.PI * 2.5 - angle;
  const angles = Array.from({ length: 97 }, (_, i) => start + ((end - start) * i) / 96);
  // Include the final axis extrema after key clocking so the nominal outside diameter stays exact.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    if (a > start && a < end) angles.push(a);
  }
  const points = angles
    .sort((a, b) => a - b)
    .filter((a, i, all) => !i || a - all[i - 1] > 1e-9)
    .map((a) => new Vector2(radius * Math.cos(a), radius * Math.sin(a)));
  const floor = bore ? radius + depth : radius - depth;
  points.push(new Vector2(width / 2, floor), new Vector2(-width / 2, floor));
  return points.map((point) => point.rotateAround(new Vector2(), Math.PI / 4));
}

function raceMesh(p: Parameters, inner: boolean) {
  const v = values(p),
    profiles = raceProfiles(p),
    mesh = new BoundaryMesh();
  const key = inner ? p.keyways !== 'none' : p.keyways === 'PP';
  const constant = key
    ? keyedContour(
        inner ? v.r : v.R,
        n(p, inner ? 'innerKeyWidth' : 'outerKeyWidth'),
        n(p, inner ? 'innerKeyDepth' : 'outerKeyDepth'),
        inner,
      )
    : circle(inner ? v.r : v.R);
  const sections = profiles[inner ? 0 : 1].map(([radius, z]) => {
    const fixed = constant.map((point) => new Vector3(point.x, point.y, z));
    const variable = circle(radius).map((point) => new Vector3(point.x, point.y, z));
    return { outer: inner ? variable : fixed, hole: inner ? fixed : variable };
  });
  for (let i = 1; i < sections.length; i++) {
    mesh.bridge(sections[i - 1].outer, sections[i].outer);
    mesh.bridge(sections[i - 1].hole, sections[i].hole, true);
  }
  mesh.face(sections[0].outer, [sections[0].hole], new Vector3(0, 0, -1));
  mesh.face(sections.at(-1)!.outer, [sections.at(-1)!.hole], new Vector3(0, 0, 1));
  return mesh.build();
}

function racePython(p: Parameters, inner: boolean, offset: number, name: string) {
  const v = values(p),
    profiles = raceProfiles(p),
    profile: TurnedProfile = inner
      ? [[v.r, -v.w / 2], ...profiles[0], [v.r, v.w / 2], [v.r, -v.w / 2]]
      : [[v.R, -v.w / 2], [v.R, v.w / 2], ...profiles[1].slice().reverse(), [v.R, -v.w / 2]];
  const lines = [`${name} = ${turnedPython(profile)}`];
  if (inner ? p.keyways !== 'none' : p.keyways === 'PP') {
    const width = n(p, inner ? 'innerKeyWidth' : 'outerKeyWidth'),
      depth = n(p, inner ? 'innerKeyDepth' : 'outerKeyDepth');
    lines.push(
      `key = Part.makeBox(${num(width)}, ${num(inner ? v.r + depth : depth + 1)}, ${num(v.w + 2)}, App.Vector(${num(-width / 2)}, ${num(inner ? 0 : v.R - depth)}, ${num(-v.w / 2 - 1)}))`,
      'key.rotate(App.Vector(0,0,0), App.Vector(0,0,1), 45)',
      `${name} = ${name}.cut(key).removeSplitter()`,
    );
  }
  if (offset) lines.push(`${name}.translate(App.Vector(0,0,${num(offset)}))`);
  return lines.join('\n');
}

function spragOutline(p: Parameters, angle: number) {
  const v = values(p),
    half = v.spragHeight / 2,
    cap = v.spragHeight * 0.24,
    lean = cap * 0.24;
  const points: Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 16;
    points.push(new Vector2(lean + cap * Math.cos(a), half - cap + cap * Math.sin(a)));
  }
  points.push(new Vector2(-cap * 0.38, 0));
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i * Math.PI) / 16;
    points.push(new Vector2(-lean + cap * Math.cos(a), -half + cap + cap * Math.sin(a)));
  }
  points.push(new Vector2(cap * 0.38, 0));
  return points
    .reverse()
    .map(
      (point) =>
        new Vector2(
          (v.pitch + point.y) * Math.cos(angle) - point.x * Math.sin(angle),
          (v.pitch + point.y) * Math.sin(angle) + point.x * Math.cos(angle),
        ),
    );
}

function cages(p: Parameters): CageLayout[] {
  const v = values(p);
  return [
    {
      pitch: v.pitch,
      radius: v.ballRadius,
      count: n(p, 'balls'),
      center: v.ballZ,
      halfWindow: v.ballRadius * 1.04,
      band: v.w * 0.012,
      rowPhase: 0,
    },
    {
      pitch: v.pitch,
      radius: v.gap * 0.13,
      count: n(p, 'sprags'),
      center: v.spragZ,
      halfWindow: v.spragLength / 2 + v.w * 0.008,
      band: v.w * 0.012,
      rowPhase: 0,
    },
  ];
}

const defaults = {
  bore: 17,
  outer: 40,
  width: 12,
  keyways: 'PP',
  ...cskKeyDimensions(17),
  balls: 9,
  sprags: 14,
  seals: 'open',
};
const part: PartDefinition = {
  id: 'csk-clutch',
  name: 'Ball-bearing sprag clutch',
  category: 'BEARINGS',
  subgroup: 'ONE-WAY CLUTCHES',
  icon: 'bearing',
  complexity: 'Ball bearing + sprag set',
  standard: 'CSK / CSK P / CSK PP reference',
  description:
    'A CSK-style clutch with two races, separate ball and asymmetric sprag rows, cages, and selectable inner/outer keyways.',
  keywords: [
    'CSK',
    'CSK P',
    'CSK PP',
    'CSK 2RS',
    'sprag',
    'overrunning',
    'one way',
    'freewheel',
    'keyway',
  ],
  parameters: [
    ...envelopeParameters,
    {
      key: 'keyways',
      label: 'Keyway configuration',
      type: 'select',
      group: 'Mounting',
      options: [
        { value: 'none', label: 'CSK · no keyways' },
        { value: 'P', label: 'CSK P · inner keyway' },
        { value: 'PP', label: 'CSK PP · inner and outer keyways' },
      ],
    },
    {
      ...numberParameter('innerKeyWidth', 'Inner keyway width', 'bᵢ', 'Mounting', 0.5, 60),
      visibleWhen: (p) => p.keyways !== 'none',
    },
    {
      ...numberParameter('innerKeyDepth', 'Inner keyway radial depth', 'tᵢ', 'Mounting', 0.1, 20),
      visibleWhen: (p) => p.keyways !== 'none',
    },
    {
      ...numberParameter('outerKeyWidth', 'Outer keyway width', 'bₒ', 'Mounting', 0.5, 60),
      visibleWhen: (p) => p.keyways === 'PP',
    },
    {
      ...numberParameter('outerKeyDepth', 'Outer keyway radial depth', 'tₒ', 'Mounting', 0.1, 20),
      visibleWhen: (p) => p.keyways === 'PP',
    },
    {
      key: 'seals',
      label: 'Closure',
      type: 'select',
      group: 'Construction',
      options: [
        { value: 'open', label: 'Open / dust-protected reference' },
        { value: 'rubber', label: 'Rubber seals · 2RS' },
      ],
    },
    {
      ...numberParameter('balls', 'Illustrative ball count', 'nᵦ', 'Internal layout', 4, 32, 1),
      unit: '',
    },
    {
      ...numberParameter('sprags', 'Illustrative sprag count', 'nₛ', 'Internal layout', 6, 60, 1),
      unit: '',
    },
  ],
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width', 'keyways'],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Complete clutch envelope.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separated races reveal the ball bearing and sprag rows.',
    },
    {
      id: 'internals',
      label: 'Internal mechanism',
      description: 'Outer ring and seals removed to expose the cages, balls and sprags.',
    },
  ],
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p);
    for (const key of ['balls', 'sprags'])
      if (!Number.isInteger(n(p, key)))
        errors.push(`${key === 'balls' ? 'Ball' : 'Sprag'} count must be an integer.`);
    if (2 * v.pitch * Math.sin(Math.PI / n(p, 'balls')) <= v.ballRadius * 2.3)
      errors.push('Reduce the ball count to leave clearance between rolling elements.');
    if (2 * v.pitch * Math.sin(Math.PI / n(p, 'sprags')) <= v.gap * 0.29)
      errors.push('Reduce the sprag count to leave room for cage windows.');
    const profiles = raceProfiles(p),
      innerWall = Math.min(...profiles[0].map(([r]) => r)) - v.r,
      outerWall = v.R - Math.max(...profiles[1].map(([r]) => r));
    if (p.keyways !== 'none') {
      if (n(p, 'innerKeyWidth') >= v.r * 1.5)
        errors.push('The inner keyway must remain narrower than 75% of the bore diameter.');
      if (
        Math.hypot(n(p, 'innerKeyWidth') / 2, v.r + n(p, 'innerKeyDepth')) >=
        v.r + innerWall - v.gap * 0.02
      )
        errors.push('The inner keyway must leave material below the ball raceway.');
    }
    if (p.keyways === 'PP') {
      if (n(p, 'outerKeyWidth') >= v.R)
        errors.push('The outer keyway must remain narrower than half the outer diameter.');
      if (n(p, 'outerKeyDepth') >= outerWall - v.gap * 0.02)
        errors.push('The outer keyway must leave material above the ball raceway.');
      if (v.R - n(p, 'outerKeyDepth') >= Math.sqrt(v.R ** 2 - (n(p, 'outerKeyWidth') / 2) ** 2))
        errors.push('The outer keyway depth must reach below the circle at both edges.');
    }
    return errors;
  },
  buildGeometry(p, state) {
    const v = values(p),
      group = new Group(),
      offset = state === 'exploded' ? v.w * 1.1 : 0;
    const inner = raceMesh(p, true);
    inner.name = 'Inner race with mounting bore';
    inner.position.z = -offset;
    group.add(inner);
    if (state !== 'internals') {
      const outer = raceMesh(p, false);
      outer.name = 'Outer race';
      outer.position.z = offset;
      group.add(outer);
    }
    cages(p).forEach((layout) => group.add(cageMesh(layout)));
    for (let i = 0; i < n(p, 'balls'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'balls'),
        ball = sphere(v.ballRadius);
      ball.name = 'Bearing ball';
      ball.position.set(v.pitch * Math.cos(a), v.pitch * Math.sin(a), v.ballZ);
      group.add(ball);
    }
    for (let i = 0; i < n(p, 'sprags'); i++) {
      const points = spragOutline(p, (i * Math.PI * 2) / n(p, 'sprags'));
      const sprag = loftMesh(
        [
          { points, z: v.spragZ - v.spragLength / 2 },
          { points, z: v.spragZ + v.spragLength / 2 },
        ],
        0x59616b,
      );
      sprag.name = 'Asymmetric sprag cam';
      group.add(sprag);
    }
    if (state !== 'internals' && p.seals === 'rubber')
      for (const side of [-1, 1]) {
        const seal = ring(v.r + v.gap * 0.665, v.r + v.gap * 0.335, v.w * 0.035, 0x292d31);
        seal.position.z = side * (v.w * 0.465 + offset);
        group.add(seal);
      }
    return group;
  },
  python(p, state) {
    const v = values(p),
      offset = state === 'exploded' ? v.w * 1.1 : 0;
    const setup = [racePython(p, true, -offset, 'inner')],
      shapes = ['inner'];
    if (state !== 'internals') {
      setup.push(racePython(p, false, offset, 'outer'));
      shapes.push('outer');
    }
    cages(p).forEach((layout, i) => {
      setup.push(cagePython(layout, `cage_${i}`));
      shapes.push(`cage_${i}`);
    });
    for (let i = 0; i < n(p, 'balls'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'balls');
      shapes.push(
        `Part.makeSphere(${num(v.ballRadius)}, App.Vector(${num(v.pitch * Math.cos(a))},${num(v.pitch * Math.sin(a))},${num(v.ballZ)}))`,
      );
    }
    for (let i = 0; i < n(p, 'sprags'); i++)
      shapes.push(
        `Part.Face(${pythonWire(spragOutline(p, (i * Math.PI * 2) / n(p, 'sprags')), v.spragZ - v.spragLength / 2)}).extrude(App.Vector(0,0,${num(v.spragLength)}))`,
      );
    if (state !== 'internals' && p.seals === 'rubber')
      for (const side of [-1, 1])
        shapes.push(
          annulusPython(
            v.r + v.gap * 0.665,
            v.r + v.gap * 0.335,
            v.w * 0.035,
            side * (v.w * 0.465 + offset) - v.w * 0.0175,
          ),
        );
    return [...setup, compoundPython(shapes)].join('\n');
  },
  dimensions(p, state) {
    return modelBounds(part.buildGeometry(p, state));
  },
  notes:
    'CSK construction combines a ball bearing and a separate sprag row. The source-verified envelope and keyseat dimensions are preserved. Ball/sprag counts, cam contours, cages, groove conformity, seals and aligned key clocking are illustrative prototype geometry. Internal clearances prevent intersecting solids; this model does not simulate wedging, torque capacity or manufacturing fits. Manufacturer reference key dimensions are defaults only when the supplier has no dimensions; CSK 8/12 outer keys are editable examples.',
  sources: [
    {
      label: 'Promtehimport · overrunning clutches',
      url: 'https://promtehimport.com.ua/obginni-mufti-c45/',
    },
    {
      label: 'Formsprag · CSK construction and keyway drawings',
      url: 'https://www.formsprag.com/-/media/Project/Altramotion/shared/files/Literature/brand/formsprag-clutch/catalogs/p-1352-fc.pdf?rev=07f2b0485a214b71b62ca4f8846a12a4',
    },
  ],
};

export default { ...part, presets: modulePresets };
