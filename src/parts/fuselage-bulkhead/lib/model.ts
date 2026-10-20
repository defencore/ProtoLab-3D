import type { Parameters } from '../../../core/types';
import { component, pythonShape, type Shape } from '../../../core/assembly/boundary/shapes';
import { Group } from 'three';
export type Point = [number, number];
export type Circle = { center: Point; radius: number };
export type FormerSection = { outline: Point[]; opening: Point[] | null; circles: Circle[] };
const ellipse = (rx: number, ry: number): Point[] =>
  Array.from({ length: 384 }, (_, i) => [
    rx * Math.cos((2 * Math.PI * i) / 384),
    ry * Math.sin((2 * Math.PI * i) / 384),
  ]);
const rectangle = (rx: number, ry: number): Point[] => [
  [-rx, -ry],
  [rx, -ry],
  [rx, ry],
  [-rx, ry],
];
export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    q = dx * dx + dy * dy;
  if (q === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q));
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
}
export function boundaryDistance(p: Point, polygon: Point[]): number {
  return Math.min(
    ...polygon.map((a, i) => segmentDistance(p, a, polygon[(i + 1) % polygon.length])),
  );
}
export function polygonGap(a: Point[], b: Point[]): number {
  let minimum = Infinity;
  const cross = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        r = b[j],
        s = b[(j + 1) % b.length];
      if (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0) return 0;
      minimum = Math.min(
        minimum,
        segmentDistance(p, r, s),
        segmentDistance(q, r, s),
        segmentDistance(r, p, q),
        segmentDistance(s, p, q),
      );
    }
  return minimum;
}
export function inside(p: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function section(p: Parameters): FormerSection {
  const rx = Number(p.width) / 2,
    ry = (p.form === 'round' ? Number(p.width) : Number(p.height)) / 2;
  let outline = p.form === 'box' ? rectangle(rx, ry) : ellipse(rx, ry);
  if (p.notches) {
    const width = Number(p.notchWidth),
      depth = Number(p.notchDepth),
      result: Point[] = [];
    const entryAngles = Array.from(
      { length: 4 },
      (_, i) => (i * Math.PI) / 2 - Math.asin(width / (2 * (i % 2 === 0 ? ry : rx))),
    );
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        n: Point = [Math.cos(a), Math.sin(a)],
        t: Point = [-Math.sin(a), Math.cos(a)],
        r = i % 2 === 0 ? rx : ry;
      const delta = Math.asin(width / (2 * (i % 2 === 0 ? ry : rx)));
      const side = (v: number): Point => [n[0] * r + t[0] * v, n[1] * r + t[1] * v];
      const start =
        p.form === 'box'
          ? side(-width / 2)
          : ([rx * Math.cos(a - delta), ry * Math.sin(a - delta)] as Point);
      const end =
        p.form === 'box'
          ? side(width / 2)
          : ([rx * Math.cos(a + delta), ry * Math.sin(a + delta)] as Point);
      result.push(
        start,
        [(r - depth) * n[0] - (t[0] * width) / 2, (r - depth) * n[1] - (t[1] * width) / 2],
        [(r - depth) * n[0] + (t[0] * width) / 2, (r - depth) * n[1] + (t[1] * width) / 2],
        end,
      );
      if (p.form === 'box')
        result.push([
          Math.sign(Math.cos(a + Math.PI / 4)) * rx,
          Math.sign(Math.sin(a + Math.PI / 4)) * ry,
        ]);
      else {
        const next = i === 3 ? entryAngles[0] + 2 * Math.PI : entryAngles[i + 1],
          begin = a + delta;
        const count = Math.max(1, Math.ceil((next - begin) / ((2 * Math.PI) / 384)));
        for (let k = 1; k < count; k++) {
          const angle = begin + ((next - begin) * k) / count;
          result.push([rx * Math.cos(angle), ry * Math.sin(angle)]);
        }
      }
    }
    outline = result;
  }
  const opening = p.opening
    ? p.form === 'box'
      ? rectangle(Number(p.openingWidth) / 2, Number(p.openingHeight) / 2)
      : ellipse(Number(p.openingWidth) / 2, Number(p.openingHeight) / 2)
    : null;
  const circles: Circle[] = p.mountingHoles
    ? Array.from({ length: 4 }, (_, i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return {
          center: [
            (rx - Number(p.mountingInset)) * Math.cos(a),
            (ry - Number(p.mountingInset)) * Math.sin(a),
          ] as Point,
          radius: Number(p.holeDiameter) / 2,
        };
      })
    : [];
  return { outline, opening, circles };
}
export function recipe(p: Parameters): Shape {
  const s = section(p),
    height = Number(p.thickness);
  const plate: Shape = {
    kind: 'plate',
    outline: s.outline,
    holes: s.opening ? [s.opening] : [],
    z: 0,
    height,
  };
  return s.circles.length
    ? {
        kind: 'subtract',
        children: [
          plate,
          ...s.circles.map(({ center, radius }): Shape => ({
            kind: 'cylinder',
            radius,
            height: height + 2,
            origin: [center[0], center[1], -1],
            axis: 'z',
            segments: 96,
          })),
        ],
      }
    : plate;
}
export function geometry(p: Parameters): Group {
  return new Group().add(component(recipe(p), 'Fuselage former', 0xbda982));
}
export function python(p: Parameters): string {
  return `shape = (${pythonShape(recipe(p))}).removeSplitter()`;
}
export function dimensions(p: Parameters): [number, number, number] {
  const outline = section(p).outline;
  return [
    Math.max(...outline.map((v) => v[0])) - Math.min(...outline.map((v) => v[0])),
    Math.max(...outline.map((v) => v[1])) - Math.min(...outline.map((v) => v[1])),
    Number(p.thickness),
  ];
}
export function dxf(p: Parameters): string {
  const s = section(p),
    lines = [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$ACADVER',
      '1',
      'AC1015',
      '9',
      '$INSUNITS',
      '70',
      '4',
      '0',
      'ENDSEC',
      '0',
      'SECTION',
      '2',
      'ENTITIES',
    ];
  const poly = (points: Point[], layer: string) =>
    lines.push(
      '0',
      'LWPOLYLINE',
      '100',
      'AcDbEntity',
      '8',
      layer,
      '100',
      'AcDbPolyline',
      '90',
      String(points.length),
      '70',
      '1',
      ...points.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
    );
  poly(s.outline, 'OUTLINE');
  if (s.opening) poly(s.opening, 'CUTOUT');
  for (const c of s.circles)
    lines.push(
      '0',
      'CIRCLE',
      '100',
      'AcDbEntity',
      '8',
      'CUTOUT',
      '100',
      'AcDbCircle',
      '10',
      String(c.center[0]),
      '20',
      String(c.center[1]),
      '30',
      '0',
      '40',
      String(c.radius),
    );
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n') + '\n';
}
