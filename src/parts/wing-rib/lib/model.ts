import type { Parameters } from '../../../core/types';
import { component, pythonShape, type Shape } from '../../../core/assembly/boundary/shapes';
import { Group } from 'three';

export type Point = [number, number];
export type Circle = { center: Point; radius: number };
export interface RibSection {
  outline: Point[];
  slots: Point[][];
  circles: Circle[];
}

export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const u = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
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
export function boundaryDistance(p: Point, polygon: Point[]): number {
  return Math.min(
    ...polygon.map((a, i) => segmentDistance(p, a, polygon[(i + 1) % polygon.length])),
  );
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
/** Symmetric/cambered four-digit NACA coordinates with the published finite trailing edge. */
export function ordinate(profile: string, x: number, upper: boolean): Point {
  const digits = profile.slice(4),
    m = Number(digits[0]) / 100,
    p = Number(digits[1]) / 10,
    t = Number(digits.slice(2)) / 100;
  const yt =
    5 *
    t *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const yc =
    m === 0
      ? 0
      : x < p
        ? (m / p ** 2) * (2 * p * x - x ** 2)
        : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x ** 2);
  const slope =
    m === 0 ? 0 : x < p ? ((2 * m) / p ** 2) * (p - x) : ((2 * m) / (1 - p) ** 2) * (p - x);
  const angle = Math.atan(slope),
    sign = upper ? 1 : -1;
  return [x - sign * yt * Math.sin(angle), yc + sign * yt * Math.cos(angle)];
}
function centre(profile: string, x: number): number {
  return (ordinate(profile, x, true)[1] + ordinate(profile, x, false)[1]) / 2;
}
function trim(polygon: Point[], right: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      ai = a[0] <= right,
      bi = b[0] <= right;
    if (ai) result.push(a);
    if (ai !== bi) {
      const t = (right - a[0]) / (b[0] - a[0]);
      result.push([right, a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}
export function section(p: Parameters): RibSection {
  const chord = Number(p.chord),
    profile = String(p.profile),
    count = 160;
  const upper = Array.from(
    { length: count + 1 },
    (_, i) =>
      ordinate(profile, (1 - Math.cos((Math.PI * i) / count)) / 2, true).map(
        (v) => v * chord,
      ) as Point,
  );
  const lower = Array.from(
    { length: count },
    (_, i) =>
      ordinate(profile, (1 - Math.cos((Math.PI * (count - i)) / count)) / 2, false).map(
        (v) => v * chord,
      ) as Point,
  );
  // Counterclockwise outline, with the cutback represented by a closed vertical edge.
  const outline = trim([...upper, ...lower].reverse(), chord - Number(p.tailTrim));
  const slot = (position: number, width: number, height: number): Point[] => {
    const x = (chord * position) / 100,
      y = chord * centre(profile, position / 100),
      dx = (width + Number(p.slotClearance)) / 2,
      dy = (height + Number(p.slotClearance)) / 2;
    return [
      [x - dx, y - dy],
      [x + dx, y - dy],
      [x + dx, y + dy],
      [x - dx, y + dy],
    ];
  };
  const slots = [slot(Number(p.mainPosition), Number(p.mainWidth), Number(p.mainHeight))];
  if (p.rearSpar)
    slots.push(slot(Number(p.rearPosition), Number(p.rearWidth), Number(p.rearHeight)));
  const circles: Circle[] = [];
  if (p.lightening) {
    // One opening between spars, one behind the rear spar. Without a rear spar,
    // retain the same two separate bays rather than cutting a long unsupported window.
    const positions = p.rearSpar
      ? [
          (Number(p.mainPosition) + Number(p.rearPosition)) / 200,
          (Number(p.rearPosition) / 100 + 0.88) / 2,
        ]
      : [0.48, 0.73];
    for (const x of positions) {
      const center: Point = [x * chord, centre(profile, x) * chord];
      const clearance = Math.min(
        boundaryDistance(center, outline),
        ...slots.map((s) => (inside(center, s) ? -1 : boundaryDistance(center, s))),
      );
      circles.push({
        center,
        radius: Math.min(Number(p.lighteningDiameter) / 2, clearance - Number(p.minimumWeb) - 0.01),
      });
    }
  }
  return { outline, slots, circles };
}
export function recipe(p: Parameters): Shape {
  const s = section(p),
    height = Number(p.thickness);
  const plate: Shape = { kind: 'plate', outline: s.outline, holes: s.slots, z: 0, height };
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
  return new Group().add(component(recipe(p), 'Wing rib', 0xc8b17e));
}
export function python(p: Parameters): string {
  return `shape = (${pythonShape(recipe(p))}).removeSplitter()`;
}
export function dimensions(p: Parameters): [number, number, number] {
  const o = section(p).outline;
  return [
    Math.max(...o.map((v) => v[0])) - Math.min(...o.map((v) => v[0])),
    Math.max(...o.map((v) => v[1])) - Math.min(...o.map((v) => v[1])),
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
  s.slots.forEach((h) => poly(h, 'CUTOUT'));
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
