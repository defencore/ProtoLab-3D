import { num } from './geometry';

type Point = [number, number];
type Vec = [number, number, number];
export interface RoundedRectShape {
  translation?: Vec;
  kind: 'rounded-rect';
  width: number;
  height: number;
  radius: number;
  z: number;
  depth: number;
}
export interface AnnularSectorShape {
  translation?: Vec;
  kind: 'annular-sector';
  inner: number;
  outer: number;
  start: number;
  end: number;
  z: number;
  depth: number;
}
export interface TorusShape {
  translation?: Vec;
  kind: 'torus';
  major: number;
  minor: number;
  z: number;
}
export type NativeProfile = RoundedRectShape | AnnularSectorShape | TorusShape;
export function nativeProfilePython(profile: NativeProfile): string {
  let value: string;
  switch (profile.kind) {
    case 'rounded-rect':
      value = roundedRectPython(profile);
      break;
    case 'annular-sector':
      value = annularSectorPython(profile);
      break;
    case 'torus':
      if (!(profile.major > profile.minor && profile.minor > 0))
        throw new Error('A torus needs a positive wire radius smaller than its main radius.');
      value = `Part.makeTorus(${num(profile.major)},${num(profile.minor)},App.Vector(0,0,${num(profile.z)}))`;
      break;
  }
  return profile.translation?.some((v) => v !== 0)
    ? `(lambda shape: (shape.translate(${vector(profile.translation)}),shape)[1])(${value})`
    : value;
}
export const roundedRectShape = (
  width: number,
  height: number,
  radius: number,
  z: number,
  depth: number,
): RoundedRectShape => ({ kind: 'rounded-rect', width, height, radius, z, depth });

/** Keep the established preview tessellation; native CAD uses exact corner arcs. */
export function roundedRectPoints(s: RoundedRectShape): Point[] {
  const points: Point[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (s.width / 2 - s.radius);
    const cy = (corner < 2 ? 1 : -1) * (s.height / 2 - s.radius);
    for (let i = 0; i <= 8; i++) {
      const angle = ((corner * 90 + (i * 90) / 8) * Math.PI) / 180;
      points.push([cx + s.radius * Math.cos(angle), cy + s.radius * Math.sin(angle)]);
    }
  }
  return points;
}

const vector = (p: Vec) => `App.Vector(${p.map(num).join(',')})`;
const planar = (p: Point, z: number): Vec => [p[0], p[1], z];
const line = (a: Point, b: Point, z: number) =>
  `Part.makeLine(${vector(planar(a, z))},${vector(planar(b, z))})`;
const arc = (a: Point, m: Point, b: Point, z: number) =>
  `Part.Arc(${vector(planar(a, z))},${vector(planar(m, z))},${vector(planar(b, z))}).toShape()`;
const near = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-10;

export function roundedRectPython(s: RoundedRectShape): string {
  if (!(
    s.width > 0 &&
    s.height > 0 &&
    s.depth > 0 &&
    s.radius >= 0 &&
    s.radius <= Math.min(s.width, s.height) / 2
  ))
    throw new Error('Rounded rectangle dimensions must leave a valid corner radius.');
  if (s.radius <= 1e-10)
    return `Part.makeBox(${num(s.width)},${num(s.height)},${num(s.depth)},${vector([-s.width / 2, -s.height / 2, s.z])})`;
  const corners = Array.from({ length: 4 }, (_, i) => {
    const center: Point = [
      (i === 0 || i === 3 ? 1 : -1) * (s.width / 2 - s.radius),
      (i < 2 ? 1 : -1) * (s.height / 2 - s.radius),
    ];
    const point = (offset: number): Point => {
      const angle = (i * Math.PI) / 2 + offset;
      return [center[0] + s.radius * Math.cos(angle), center[1] + s.radius * Math.sin(angle)];
    };
    return [point(0), point(Math.PI / 4), point(Math.PI / 2)];
  });
  const edges = corners.flatMap(([start, middle, end], i) => {
    const next = corners[(i + 1) % 4][0];
    return [arc(start, middle, end, s.z), ...(!near(end, next) ? [line(end, next, s.z)] : [])];
  });
  return `Part.Face(Part.Wire([${edges.join(',')}])).extrude(App.Vector(0,0,${num(s.depth)}))`;
}

export function annularSectorPoints(s: AnnularSectorShape): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= 48; i++) {
    const angle = ((s.start + ((s.end - s.start) * i) / 48) * Math.PI) / 180;
    points.push([s.outer * Math.cos(angle), s.outer * Math.sin(angle)]);
  }
  for (let i = 48; i >= 0; i--) {
    const angle = ((s.start + ((s.end - s.start) * i) / 48) * Math.PI) / 180;
    points.push([s.inner * Math.cos(angle), s.inner * Math.sin(angle)]);
  }
  return points;
}

export function annularSectorPython(s: AnnularSectorShape): string {
  const span = s.end - s.start;
  if (!(
    s.inner >= 0 &&
    s.outer > s.inner &&
    s.depth > 0 &&
    Math.abs(span) > 1e-9 &&
    Math.abs(span) <= 360
  ))
    throw new Error('An annular sector needs positive walls and a sweep up to 360 degrees.');
  if (Math.abs(span) >= 360 - 1e-9) {
    const outer = `Part.makeCylinder(${num(s.outer)},${num(s.depth)},App.Vector(0,0,${num(s.z)}))`;
    return s.inner > 0
      ? `${outer}.cut(Part.makeCylinder(${num(s.inner)},${num(s.depth + 2)},App.Vector(0,0,${num(s.z - 1)})))`
      : outer;
  }
  const point = (radius: number, angle: number): Point => [
    radius * Math.cos((angle * Math.PI) / 180),
    radius * Math.sin((angle * Math.PI) / 180),
  ];
  const circularEdges = (radius: number, from: number, to: number) => {
    const count = Math.ceil(Math.abs(to - from) / 180);
    return Array.from({ length: count }, (_, i) => {
      const a = from + ((to - from) * i) / count,
        b = from + ((to - from) * (i + 1)) / count;
      return arc(point(radius, a), point(radius, (a + b) / 2), point(radius, b), s.z);
    });
  };
  const edges = [
    ...circularEdges(s.outer, s.start, s.end),
    line(point(s.outer, s.end), point(s.inner, s.end), s.z),
    ...(s.inner > 0 ? circularEdges(s.inner, s.end, s.start) : []),
    line(point(s.inner, s.start), point(s.outer, s.start), s.z),
  ];
  return `Part.Face(Part.Wire([${edges.join(',')}])).extrude(App.Vector(0,0,${num(s.depth)}))`;
}
