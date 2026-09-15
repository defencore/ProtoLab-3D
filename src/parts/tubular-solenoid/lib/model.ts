import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3, Group } from 'three';
import { BoundaryMesh, circleSection } from '../../../core/mechanical';
import { material, n, num } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';

type Profile = [radius: number, z: number][];
type Hole = { x: number; radius: number };
export type Component = {
  label: string;
  color: number;
  x: number;
  radius: number;
  z0: number;
  z1: number;
  profile?: Profile;
  holes?: Hole[];
};

const STEEL = 0x798592;
const DARK = 0x48515d;
const COPPER = 0xbd703c;
const POLYMER = 0x263542;

export function layout(p: Parameters, state: string) {
  const outer = n(p, 'outerDiameter') / 2;
  const inner = outer - n(p, 'wallThickness');
  const half = n(p, 'bodyLength') / 2;
  const end = n(p, 'endThickness');
  const clearance = n(p, 'clearance');
  const armature = n(p, 'plungerDiameter') / 2;
  const guideInner = armature + clearance;
  const guideOuter = guideInner + n(p, 'guideWall');
  const coilInner = guideOuter + clearance;
  const coilOuter = inner - clearance;
  const coilStart = -half + end + clearance;
  const coilEnd = half - end - clearance;
  const rod = n(p, 'rodDiameter') / 2;
  const pull = p.action === 'pull';
  const stroke = n(p, 'stroke');
  const extended = state === 'extended';
  const travel = pull ? (extended ? stroke : 0) : extended ? 0 : stroke;
  const armatureStart = coilStart + travel;
  const armatureEnd = armatureStart + n(p, 'plungerLength');
  const tip = pull
    ? half + n(p, 'extension') + travel
    : -half - n(p, 'extension') - stroke + travel;
  const terminalRadius = n(p, 'terminalDiameter') / 2;
  const insulatorRadius = terminalRadius + clearance + 0.2;
  return {
    outer,
    inner,
    half,
    end,
    clearance,
    armature,
    guideInner,
    guideOuter,
    coilInner,
    coilOuter,
    coilStart,
    coilEnd,
    rod,
    pull,
    stroke,
    armatureStart,
    armatureEnd,
    tip,
    terminalRadius,
    insulatorRadius,
  };
}

const annularProfile = (outer: number, inner: number, z0: number, z1: number): Profile => [
  [inner, z0],
  [outer, z0],
  [outer, z1],
  [inner, z1],
];

export function components(p: Parameters, state: string): Component[] {
  const a = layout(p, state);
  const pitch = state === 'exploded' ? n(p, 'outerDiameter') * 1.2 + 5 : 0;
  const component = (
    label: string,
    color: number,
    radius: number,
    z0: number,
    z1: number,
    profile: Profile,
    x = 0,
  ): Component => ({ label, color, radius, z0, z1, profile, x });
  const frontHoles: Hole[] = a.pull ? [{ x: 0, radius: a.rod + a.clearance }] : [];
  const terminalXs = [-n(p, 'terminalSpacing') / 2, n(p, 'terminalSpacing') / 2];
  if (p.terminals) terminalXs.forEach((x) => frontHoles.push({ x, radius: a.insulatorRadius }));
  const pieces: Component[] = [
    component(
      'Tubular steel housing',
      DARK,
      a.outer,
      -a.half,
      a.half,
      annularProfile(a.outer, a.inner, -a.half, a.half),
    ),
    component(
      'Rear fixed pole',
      STEEL,
      a.inner,
      -a.half,
      -a.half + a.end,
      annularProfile(a.inner, a.pull ? 0 : a.rod + a.clearance, -a.half, -a.half + a.end),
      -pitch,
    ),
    {
      label: 'Front guide plate',
      color: STEEL,
      radius: a.inner,
      z0: a.half - a.end,
      z1: a.half,
      x: pitch,
      holes: frontHoles,
    },
    component(
      'Armature guide sleeve',
      POLYMER,
      a.guideOuter,
      -a.half + a.end,
      a.half - a.end,
      annularProfile(a.guideOuter, a.guideInner, -a.half + a.end, a.half - a.end),
      -2 * pitch,
    ),
    component(
      'Coil envelope',
      COPPER,
      a.coilOuter,
      a.coilStart,
      a.coilEnd,
      annularProfile(a.coilOuter, a.coilInner, a.coilStart, a.coilEnd),
      2 * pitch,
    ),
    component(
      'Moving armature and output rod',
      0xb6bec5,
      a.armature,
      a.pull ? a.armatureStart : a.tip,
      a.pull ? a.tip : a.armatureEnd,
      a.pull
        ? [
            [0, a.armatureStart],
            [a.armature, a.armatureStart],
            [a.armature, a.armatureEnd],
            [a.rod, a.armatureEnd],
            [a.rod, a.tip],
            [0, a.tip],
          ]
        : [
            [0, a.tip],
            [a.rod, a.tip],
            [a.rod, a.armatureStart],
            [a.armature, a.armatureStart],
            [a.armature, a.armatureEnd],
            [0, a.armatureEnd],
          ],
      3 * pitch,
    ),
  ];
  if (p.terminals)
    terminalXs.forEach((x, i) => {
      const insulatorTop = a.half + Math.min(0.5, n(p, 'terminalLength') / 4);
      pieces.push(
        component(
          `Terminal ${i + 1} insulator`,
          POLYMER,
          a.insulatorRadius,
          a.half - a.end,
          insulatorTop,
          annularProfile(a.insulatorRadius, a.terminalRadius, a.half - a.end, insulatorTop),
          x + pitch,
        ),
      );
      pieces.push(
        component(
          `Terminal ${i + 1}`,
          COPPER,
          a.terminalRadius,
          a.coilEnd,
          a.half + n(p, 'terminalLength'),
          annularProfile(a.terminalRadius, 0, a.coilEnd, a.half + n(p, 'terminalLength')),
          x + pitch,
        ),
      );
    });
  return pieces;
}

/** One closed mesh per manufactured turned component; outward winding on every surface. */
function turnedMesh(profile: Profile, color: number): Mesh {
  const segments = 96;
  const positions: number[] = [];
  const loops: number[][] = [];
  for (const [radius, z] of profile) {
    const loop: number[] = [];
    for (let i = 0; i < (radius === 0 ? 1 : segments); i++) {
      loop.push(positions.length / 3);
      positions.push(
        radius * Math.cos((i * Math.PI * 2) / segments),
        radius * Math.sin((i * Math.PI * 2) / segments),
        z,
      );
    }
    loops.push(loop);
  }
  const indices: number[] = [];
  for (let level = 0; level < loops.length; level++) {
    const lower = loops[level];
    const upper = loops[(level + 1) % loops.length];
    if (lower.length === 1 && upper.length === 1) continue;
    for (let i = 0; i < segments; i++) {
      const a = lower[i % lower.length];
      const b = lower[(i + 1) % lower.length];
      const c = upper[(i + 1) % upper.length];
      const d = upper[i % upper.length];
      if (a !== b) indices.push(a, b, d);
      if (c !== d) indices.push(b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, material(color));
}

function plateMesh(c: Component): Mesh {
  const boundary = new BoundaryMesh();
  const outer0 = circleSection(c.radius, new Vector3(0, 0, c.z0), 'z', 96);
  const outer1 = circleSection(c.radius, new Vector3(0, 0, c.z1), 'z', 96);
  const holes0 = c.holes!.map((h) => circleSection(h.radius, new Vector3(h.x, 0, c.z0), 'z', 96));
  const holes1 = c.holes!.map((h) => circleSection(h.radius, new Vector3(h.x, 0, c.z1), 'z', 96));
  boundary.face(outer0, holes0, new Vector3(0, 0, -1));
  boundary.face(outer1, holes1, new Vector3(0, 0, 1));
  boundary.bridge(outer0, outer1);
  holes0.forEach((hole, i) => boundary.bridge(hole, holes1[i], true));
  return boundary.build(c.color);
}

export function geometry(p: Parameters, state: string): Group {
  const group = new Group();
  for (const c of components(p, state)) {
    const mesh = c.profile ? turnedMesh(c.profile, c.color) : plateMesh(c);
    mesh.name = c.label;
    mesh.position.x = c.x;
    group.add(mesh);
  }
  return group;
}

export function python(p: Parameters, state: string): string {
  const pieces = components(p, state);
  const lines: string[] = ['components = []'];
  for (const c of pieces) {
    if (c.profile) {
      // A revolved meridian produces the same single connected solid as the preview.
      const points = [...c.profile, c.profile[0]].map(
        ([r, z]) => `App.Vector(${num(r)}, 0, ${num(z)})`,
      );
      lines.push(
        `wire = Part.makePolygon([${points.join(', ')}])`,
        'component = Part.Face(wire).revolve(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 360)',
      );
    } else {
      lines.push(
        `component = Part.makeCylinder(${num(c.radius)}, ${num(c.z1 - c.z0)}, App.Vector(0, 0, ${num(c.z0)}))`,
      );
      for (const hole of c.holes!)
        lines.push(
          `component = component.cut(Part.makeCylinder(${num(hole.radius)}, ${num(c.z1 - c.z0 + 2)}, App.Vector(${num(hole.x)}, 0, ${num(c.z0 - 1)})))`,
        );
    }
    lines.push(
      'component = component.removeSplitter()',
      `component.translate(App.Vector(${num(c.x)}, 0, 0))`,
      'components.append(component)',
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((c) => c.label))}`,
    `component_colors = [${pieces.map((c) => `(${num(((c.color >> 16) & 255) / 255)}, ${num(((c.color >> 8) & 255) / 255)}, ${num((c.color & 255) / 255)})`).join(', ')}]`,
  );
  return lines.join('\n');
}

export function dimensions(p: Parameters, state: string): [number, number, number] {
  const pieces = components(p, state);
  const xmin = Math.min(...pieces.map((c) => c.x - c.radius));
  const xmax = Math.max(...pieces.map((c) => c.x + c.radius));
  return [
    xmax - xmin,
    2 * Math.max(...pieces.map((c) => c.radius)),
    Math.max(...pieces.map((c) => c.z1)) - Math.min(...pieces.map((c) => c.z0)),
  ];
}
