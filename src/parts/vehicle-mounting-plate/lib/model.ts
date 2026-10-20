import type { Parameters } from '../../../core/types';
import {
  component,
  cylinder,
  prism,
  subtract,
  union,
  box,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { num } from '../../../core/geometry';
import { Group } from 'three';
export type Point = [number, number];
export interface Slot {
  x: number;
  y: number;
  length: number;
  width: number;
}
export function plateLayout(p: Parameters) {
  const L = Number(p.length),
    W = Number(p.width),
    c = Number(p.corner),
    d = Number(p.hole),
    outline: Point[] = [
      [-L / 2 + c, -W / 2],
      [L / 2 - c, -W / 2],
      [L / 2, -W / 2 + c],
      [L / 2, W / 2 - c],
      [L / 2 - c, W / 2],
      [-L / 2 + c, W / 2],
      [-L / 2, W / 2 - c],
      [-L / 2, -W / 2 + c],
    ],
    pitches: Point[] =
      p.pattern === '20'
        ? [[20, 20]]
        : p.pattern === '30.5'
          ? [[30.5, 30.5]]
          : p.pattern === 'dual'
            ? [
                [20, 20],
                [30.5, 30.5],
              ]
            : p.pattern === 'custom'
              ? [[Number(p.patternX), Number(p.patternY)]]
              : [];
  if (p.perimeter) pitches.push([L - 2 * Number(p.edgeOffset), W - 2 * Number(p.edgeOffset)]);
  const holes = [
    ...new Map(
      pitches
        .flatMap(([x, y]) =>
          [-1, 1].flatMap((sx) => [-1, 1].map((sy): Point => [(sx * x) / 2, (sy * y) / 2])),
        )
        .map((q) => [q.map((v) => v.toFixed(6)).join(','), q]),
    ).values(),
  ];
  const slots: Slot[] = p.straps
    ? [-1, 1].flatMap((x) =>
        [-1, 1].map((y) => ({
          x: (x * Number(p.strapPitchX)) / 2,
          y: (y * Number(p.strapPitchY)) / 2,
          length: Number(p.strapLength),
          width: Number(p.strapWidth),
        })),
      )
    : [];
  return { L, W, d, outline, holes, slots };
}
export const slotEndpoints = (s: Slot): [Point, Point] => [
  [s.x - (s.length - s.width) / 2, s.y],
  [s.x + (s.length - s.width) / 2, s.y],
];
export function segmentDistance(a: Point, b: Point, c: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
  return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]);
}
export function featureEdgeDistance(outline: Point[], points: Point[], radius: number) {
  return Math.min(
    ...outline.flatMap((a, i) => {
      const b = outline[(i + 1) % outline.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy);
      return points.map((q) => (dx * (q[1] - a[1]) - dy * (q[0] - a[0])) / length - radius);
    }),
  );
}
function slotCut(s: Slot, z: number, height: number): Shape {
  const [a, b] = slotEndpoints(s);
  return union(
    box([b[0] - a[0], s.width, height], [a[0], s.y - s.width / 2, z]),
    cylinder(s.width / 2, height, [a[0], a[1], z]),
    cylinder(s.width / 2, height, [b[0], b[1], z]),
  );
}
export function plateShape(p: Parameters): Shape {
  const v = plateLayout(p),
    height = Number(p.thickness);
  return subtract(
    prism(v.outline, height, 0),
    ...v.holes.map(([x, y]) => cylinder(v.d / 2, height + 2, [x, y, -1])),
    ...v.slots.map((s) => slotCut(s, -1, height + 2)),
  );
}
export function geometry(p: Parameters, nominal = false): Group {
  return new Group().add(
    component(plateShape(p), 'Vehicle mounting plate', 0x445361, [0, 0, 0], 0, { nominal }),
  );
}
export function python(p: Parameters): string {
  const v = plateLayout(p),
    t = Number(p.thickness),
    vector = ([x, y]: Point) => `App.Vector(${num(x)},${num(y)},0)`;
  const lines = [
    `shape = Part.Face(Part.makePolygon([${[...v.outline, v.outline[0]].map(vector).join(',')}])).extrude(App.Vector(0,0,${num(t)}))`,
  ];
  for (const [x, y] of v.holes)
    lines.push(
      `shape = shape.cut(Part.makeCylinder(${num(v.d / 2)},${num(t + 2)},App.Vector(${num(x)},${num(y)},-1)))`,
    );
  for (const s of v.slots) {
    const [a, b] = slotEndpoints(s),
      radius = num(s.width / 2),
      height = num(t + 2);
    lines.push(
      `slot = Part.makeBox(${num(b[0] - a[0])},${num(s.width)},${height},App.Vector(${num(a[0])},${num(s.y - s.width / 2)},-1))`,
      `slot = slot.fuse(Part.makeCylinder(${radius},${height},App.Vector(${num(a[0])},${num(s.y)},-1))).fuse(Part.makeCylinder(${radius},${height},App.Vector(${num(b[0])},${num(s.y)},-1)))`,
      'shape = shape.cut(slot)',
    );
  }
  return [
    ...lines,
    'shape = shape.removeSplitter()',
    'if len(shape.Solids) != 1 or not shape.isValid(): raise ValueError("Mounting plate must be one valid solid.")',
  ].join('\n');
}
/** Millimetre DXF with exact circle/arc entities; no mesh projection or cutter compensation. */
export function dxf(p: Parameters): string {
  const v = plateLayout(p),
    pairs: (string | number)[] = [
      0,
      'SECTION',
      2,
      'HEADER',
      9,
      '$ACADVER',
      1,
      'AC1015',
      9,
      '$INSUNITS',
      70,
      4,
      0,
      'ENDSEC',
      0,
      'SECTION',
      2,
      'ENTITIES',
    ];
  const add = (...values: (string | number)[]) => pairs.push(...values);
  const line = (a: Point, b: Point, layer: string) =>
    add(0, 'LINE', 8, layer, 10, a[0], 20, a[1], 30, 0, 11, b[0], 21, b[1], 31, 0);
  v.outline.forEach((a, i) => line(a, v.outline[(i + 1) % v.outline.length], 'OUTLINE'));
  for (const [x, y] of v.holes) add(0, 'CIRCLE', 8, 'HOLES', 10, x, 20, y, 30, 0, 40, v.d / 2);
  for (const s of v.slots) {
    const [a, b] = slotEndpoints(s),
      r = s.width / 2;
    line([a[0], a[1] - r], [b[0], b[1] - r], 'STRAP_SLOTS');
    line([b[0], b[1] + r], [a[0], a[1] + r], 'STRAP_SLOTS');
    for (const [centre, start, end] of [
      [a, 90, 270],
      [b, 270, 90],
    ] as const)
      add(
        0,
        'ARC',
        8,
        'STRAP_SLOTS',
        10,
        centre[0],
        20,
        centre[1],
        30,
        0,
        40,
        r,
        50,
        start,
        51,
        end,
      );
  }
  add(0, 'ENDSEC', 0, 'EOF');
  return (
    pairs
      .map((value) => (typeof value === 'number' ? Number(value.toFixed(8)).toString() : value))
      .join('\n') + '\n'
  );
}
