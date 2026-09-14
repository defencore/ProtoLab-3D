import { Group, Path, Shape, Vector2 } from 'three';
import { extrude, n, num } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { hasSideC, hasSideT, hasTopSlot, hasTwoBores, hasTwoTop, hasVoid } from '../configurator';

type XY = [number, number];
type Command =
  | { kind: 'line'; point: XY }
  | { kind: 'arc'; center: XY; radius: number; start: number; end: number };
type Notch = { center: number; points: XY[] };
export interface ProfileSection {
  start: XY;
  commands: Command[];
  holes: XY[][];
  bores: { center: XY; radius: number }[];
}

function tSlot(
  opening: number,
  cavity: number,
  depth: number,
  floor: number,
  lip: number,
  outerOpening = opening,
  step = 0,
): XY[] {
  const shoulder = depth - (cavity - floor) / 2;
  const entrance: XY[] =
    step > 0
      ? [
          [-outerOpening / 2, 0],
          [-outerOpening / 2, step],
          [-opening / 2, step],
          [-opening / 2, lip],
        ]
      : [
          [-opening / 2, 0],
          [-opening / 2, lip],
        ];
  const left: XY[] = [
    ...entrance,
    [-cavity / 2, lip],
    [-cavity / 2, shoulder],
    [-floor / 2, depth],
  ];
  return [...left, ...[...left].reverse().map(([x, y]): XY => [-x, y])];
}
function cSlot(opening: number, cavity: number, depth: number, lip: number): XY[] {
  const left: XY[] = [
    [-opening / 2, 0],
    [-opening / 2, lip],
    [-cavity / 2, lip],
    [-cavity / 2, depth],
  ];
  return [...left, ...[...left].reverse().map(([x, y]): XY => [-x, y])];
}
export function profileSection(p: Parameters): ProfileSection {
  const w = n(p, 'width'),
    h = n(p, 'height'),
    r = n(p, 'cornerRadius');
  const section: ProfileSection = {
    start: [-w / 2 + r, -h / 2],
    commands: [],
    holes: [],
    bores: [],
  };
  const top = () =>
    tSlot(
      n(p, 'slotOpening'),
      n(p, 'slotCavityWidth'),
      n(p, 'slotDepth'),
      n(p, 'slotFloorWidth'),
      n(p, 'lipThickness'),
      n(p, 'slotOuterOpening'),
      n(p, 'slotStepDepth'),
    );
  const topCenters = hasTwoTop(p) ? [-n(p, 'slotPitch') / 2, n(p, 'slotPitch') / 2] : [0];
  const topNotches: Notch[] = hasTopSlot(p)
    ? topCenters.map((center) => ({ center, points: top() }))
    : [];
  const bottomNotches = ['2020', '2040'].includes(String(p.profile)) ? topNotches : [];
  const sideNotches: Notch[] = hasSideC(p)
    ? [
        {
          center: 0,
          points: cSlot(
            n(p, 'sideOpening'),
            n(p, 'sideCavityHeight'),
            n(p, 'sideCavityDepth'),
            n(p, 'sideLipWidth'),
          ),
        },
      ]
    : hasSideT(p)
      ? [
          {
            center: 0,
            points:
              p.profile === 'eu1540'
                ? tSlot(
                    n(p, 'sideOpening'),
                    n(p, 'sideCavityHeight'),
                    n(p, 'sideCavityDepth'),
                    4.8,
                    n(p, 'sideLipWidth'),
                  )
                : tSlot(
                    n(p, 'sideOpening'),
                    n(p, 'slotCavityWidth'),
                    n(p, 'slotDepth'),
                    n(p, 'slotFloorWidth'),
                    n(p, 'sideLipWidth'),
                  ),
          },
        ]
      : [];
  const line = (point: XY) => section.commands.push({ kind: 'line', point });
  const edge = (origin: XY, tangent: XY, normal: XY, span: number, notches: Notch[]) => {
    const point = (u: number, v: number): XY => [
      origin[0] + u * tangent[0] + v * normal[0],
      origin[1] + u * tangent[1] + v * normal[1],
    ];
    for (const notch of [...notches].sort((a, b) => a.center - b.center))
      for (const [u, v] of notch.points) line(point(u + notch.center, v));
    line(point(span / 2 - r, 0));
  };
  const corner = (center: XY, start: number) => {
    if (r > 0)
      section.commands.push({ kind: 'arc', center, radius: r, start, end: start + Math.PI / 2 });
  };
  edge([0, -h / 2], [1, 0], [0, 1], w, bottomNotches);
  corner([w / 2 - r, -h / 2 + r], -Math.PI / 2);
  edge([w / 2, 0], [0, 1], [-1, 0], h, sideNotches);
  corner([w / 2 - r, h / 2 - r], 0);
  edge([0, h / 2], [-1, 0], [0, -1], w, topNotches);
  corner([-w / 2 + r, h / 2 - r], Math.PI / 2);
  edge([-w / 2, 0], [0, -1], [1, 0], h, sideNotches);
  corner([-w / 2 + r, -h / 2 + r], Math.PI);
  if (p.profile !== 'eu1030' && n(p, 'boreDiameter') > 0)
    for (const x of hasTwoBores(p) ? [-n(p, 'boreSpacing') / 2, n(p, 'boreSpacing') / 2] : [0])
      section.bores.push({
        center: [x, n(p, 'boreHeight') - h / 2],
        radius: n(p, 'boreDiameter') / 2,
      });
  if (hasVoid(p)) {
    const a = n(p, 'centerVoidWidth') / 2,
      b = n(p, 'centerVoidHeight') / 2,
      y = n(p, 'centerVoidHeightFromBase') - h / 2;
    // A relieved trapezoid in the low profile; an octagonal web cavity in 2040.
    section.holes.push(
      p.profile === 'eu1040'
        ? [
            [-0.48 * a, y - b],
            [0.48 * a, y - b],
            [a, y - 0.24 * b],
            [0.4 * a, y + b],
            [-0.4 * a, y + b],
            [-a, y - 0.24 * b],
          ]
        : [
            [-0.6 * a, y - b],
            [0.6 * a, y - b],
            [a, y - 0.45 * b],
            [a, y + 0.45 * b],
            [0.6 * a, y + b],
            [-0.6 * a, y + b],
            [-a, y + 0.45 * b],
            [-a, y - 0.45 * b],
          ],
    );
  }
  return section;
}
export function sectionShape(section: ProfileSection): Shape {
  const shape = new Shape();
  shape.moveTo(...section.start);
  for (const command of section.commands) {
    if (command.kind === 'line') shape.lineTo(...command.point);
    else shape.absarc(...command.center, command.radius, command.start, command.end, false);
  }
  shape.closePath();
  for (const points of section.holes) {
    const path = new Path(points.map((point) => new Vector2(...point)));
    path.closePath();
    shape.holes.push(path);
  }
  for (const bore of section.bores) {
    const path = new Path();
    path.absarc(...bore.center, bore.radius, 0, 2 * Math.PI, true);
    shape.holes.push(path);
  }
  return shape;
}
export function buildProfile(p: Parameters): Group {
  const model = new Group();
  const mesh = extrude(sectionShape(profileSection(p)), n(p, 'length'), 0xaeb4ba);
  mesh.name = 'Aluminium extrusion';
  model.add(mesh);
  return model;
}
export function profilePython(p: Parameters): string {
  const section = profileSection(p),
    z = -n(p, 'length') / 2;
  const vector = (point: XY) => `App.Vector(${num(point[0])}, ${num(point[1])}, ${num(z)})`;
  const lines = ['profile_edges = []'];
  let current = section.start;
  const line = (next: XY) => {
    if (Math.hypot(current[0] - next[0], current[1] - next[1]) > 1e-8)
      lines.push(`profile_edges.append(Part.makeLine(${vector(current)}, ${vector(next)}))`);
    current = next;
  };
  for (const command of section.commands) {
    if (command.kind === 'line') line(command.point);
    else {
      const at = (angle: number): XY => [
        command.center[0] + command.radius * Math.cos(angle),
        command.center[1] + command.radius * Math.sin(angle),
      ];
      lines.push(
        `profile_edges.append(Part.Arc(${vector(at(command.start))}, ${vector(at((command.start + command.end) / 2))}, ${vector(at(command.end))}).toShape())`,
      );
      current = at(command.end);
    }
  }
  line(section.start);
  lines.push('section = Part.Face(Part.Wire(profile_edges))');
  for (const points of section.holes)
    lines.push(
      `section = section.cut(Part.Face(Part.makePolygon([${[...points, points[0]].map(vector).join(', ')}])))`,
    );
  for (const bore of section.bores)
    lines.push(
      `section = section.cut(Part.Face(Part.Wire([Part.makeCircle(${num(bore.radius)}, ${vector(bore.center)})])))`,
    );
  lines.push(
    `shape = section.extrude(App.Vector(0, 0, ${num(n(p, 'length'))})).removeSplitter()`,
    'component_colors = [(0.68, 0.71, 0.74)]',
  );
  return lines.join('\n');
}
