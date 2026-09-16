import { Group } from 'three';
import { component, pythonShape, type Shape, type Vec } from './shapes';
import { num } from '../../../core/geometry';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  z?: number;
  angle?: number;
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(
    ...pieces.map((p) => component(p.shape, p.label, p.color, [0, 0, p.z ?? 0], p.angle ?? 0)),
  );
}
export function python(pieces: Piece[]): string {
  const lines = ['components = []'];
  for (const p of pieces)
    lines.push(
      `component = (${pythonShape(p.shape)}).removeSplitter()`,
      `component.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(p.angle ?? 0)})`,
      `component.translate(App.Vector(0,0,${num(p.z ?? 0)}))`,
      'components.append(component)',
    );
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((p) => p.label))}`,
    `component_colors = [${pieces.map((p) => `(${num(((p.color >> 16) & 255) / 255)},${num(((p.color >> 8) & 255) / 255)},${num((p.color & 255) / 255)})`).join(',')}]`,
  );
  return lines.join('\n');
}
function bounds(s: Shape): [Vec, Vec] {
  if (s.kind === 'revolve') {
    const r = Math.max(...s.profile.map((p) => p[0]));
    return [
      [-r, -r, Math.min(...s.profile.map((p) => p[1]))],
      [r, r, Math.max(...s.profile.map((p) => p[1]))],
    ];
  }
  if (s.kind === 'subtract') return bounds(s.children[0]);
  if (s.kind === 'union') {
    const b = s.children.map(bounds);
    return [0, 1].map((end) =>
      [0, 1, 2].map((axis) => (end ? Math.max : Math.min)(...b.map((v) => v[end][axis]))),
    ) as [Vec, Vec];
  }
  if (s.kind === 'box') return [s.origin, s.origin.map((v, i) => v + s.size[i]) as Vec];
  if (s.kind === 'cylinder') {
    const axis = s.axis === 'x' ? 0 : s.axis === 'y' ? 1 : 2;
    return [
      s.origin.map((v, i) => v - (i === axis ? 0 : s.radius)),
      s.origin.map((v, i) => v + (i === axis ? s.height : s.radius)),
    ] as [Vec, Vec];
  }
  const lo = [Math.min(...s.points.map((v) => v[0])), Math.min(...s.points.map((v) => v[1]))];
  const hi = [Math.max(...s.points.map((v) => v[0])), Math.max(...s.points.map((v) => v[1]))];
  return s.axis === 'z'
    ? [
        [lo[0], lo[1], s.origin],
        [hi[0], hi[1], s.origin + s.depth],
      ]
    : [
        [lo[0], s.origin, lo[1]],
        [hi[0], s.origin + s.depth, hi[1]],
      ];
}
export function dimensions(pieces: Piece[]): Vec {
  // Inspection offsets separate components along the optical axis (+Z).
  const b = pieces.map((p) => {
    const v = bounds(p.shape);
    v[0][2] += p.z ?? 0;
    v[1][2] += p.z ?? 0;
    return v;
  });
  return [0, 1, 2].map(
    (a) => Math.max(...b.map((v) => v[1][a])) - Math.min(...b.map((v) => v[0][a])),
  ) as Vec;
}
