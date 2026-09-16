import tables from './tabulated-profiles.json';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';

export type Point = [number, number];
export type Profile = {
  family: 'naca' | 'diamond' | 'biconvex' | 'tabulated';
  table?: keyof typeof tables;
  thickness: number;
  camber: number;
  position: number;
};

export function profileDefinition(p: Parameters, end: 'root' | 'tip'): Profile {
  if (end === 'tip' && p.tipProfile === 'same') return profileDefinition(p, 'root');
  const id = String(p[`${end}Profile`]);
  if (id in tables)
    return {
      family: 'tabulated',
      table: id as keyof typeof tables,
      thickness: id === 'e387' ? 0.09 : 0.12,
      camber: 0,
      position: 0.4,
    };
  if (/^naca\d{4}$/.test(id)) {
    const digits = id.slice(4);
    return {
      family: 'naca',
      camber: Number(digits[0]) / 100,
      position: Number(digits[1]) / 10,
      thickness: Number(digits.slice(2)) / 100,
    };
  }
  return {
    family: id === 'naca-custom' ? 'naca' : (id as Profile['family']),
    thickness: n(p, `${end}Thickness`) / 100,
    camber: id === 'naca-custom' ? n(p, `${end}Camber`) / 100 : 0,
    position: id === 'diamond' ? n(p, 'wedgePosition') / 100 : n(p, `${end}CamberPosition`) / 100,
  };
}

/** Keep the original coordinates in JSON; map each surface's chordwise extent to [0,1]. */
export function tableSide(id: keyof typeof tables, upper: boolean): Point[] {
  const points = tables[id].points;
  const le = points.reduce((best, p, i) => (p[0] < points[best][0] ? i : best), 0);
  const side = upper ? points.slice(0, le + 1).reverse() : points.slice(le);
  const x0 = points[le][0],
    y0 = points[le][1],
    dx = side[side.length - 1][0] - x0;
  const trailingY = side[side.length - 1][1] - y0;
  return side.map(([x, y]) => [(x - x0) / dx, y - y0 - ((x - x0) / dx) * trailingY]);
}
export function ordinate(profile: Profile, x: number, upper: boolean): Point {
  if (profile.family === 'tabulated') {
    const points = tableSide(profile.table!, upper);
    const i = Math.max(
      1,
      points.findIndex((p) => p[0] >= x),
    );
    const a = points[i - 1],
      b = points[i],
      u = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + u * (b[1] - a[1])];
  }
  const { thickness: t, camber: m, position: p } = profile;
  let y = 0,
    centre = 0,
    slope = 0;
  if (profile.family === 'naca') {
    // Closed trailing edge: the standard final coefficient -0.1015 is
    // replaced by -0.1036. No finite-gap standard NACA edge is implied.
    y =
      x === 1
        ? 0
        : 5 *
          t *
          (0.2969 * Math.sqrt(x) -
            0.126 * x -
            0.3516 * x * x +
            0.2843 * x * x * x -
            0.1036 * x * x * x * x);
    if (m > 0) {
      if (x <= p) {
        centre = (m / (p * p)) * (2 * p * x - x * x);
        slope = ((2 * m) / (p * p)) * (p - x);
      } else {
        centre = (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
        slope = ((2 * m) / (1 - p) ** 2) * (p - x);
      }
    }
  } else if (profile.family === 'diamond') {
    y = (t / 2) * (x <= p ? x / p : (1 - x) / (1 - p));
  } else {
    const radius = (1 + t * t) / (4 * t);
    // Rationalized difference of square roots retains accuracy for thin arcs.
    y =
      (0.25 - (x - 0.5) ** 2) /
      (Math.sqrt(radius * radius - (x - 0.5) ** 2) + Math.sqrt(radius * radius - 0.25));
  }
  const angle = Math.atan(slope),
    sign = upper ? 1 : -1;
  return [x - sign * y * Math.sin(angle), centre + sign * y * Math.cos(angle)];
}

export function sampleXs(p: Parameters): number[] {
  const root = profileDefinition(p, 'root'),
    tip = profileDefinition(p, 'tip');
  if (root.family === 'diamond' && tip.family === 'diamond')
    return [...new Set([0, root.position, tip.position, 1])].sort((a, b) => a - b);
  const count = n(p, 'profileSegments');
  const points = Array.from(
    { length: count + 1 },
    (_, i) => (1 - Math.cos((Math.PI * i) / count)) / 2,
  );
  for (const end of ['root', 'tip'] as const) {
    const profile = profileDefinition(p, end);
    if (profile.family === 'diamond') points.push(profile.position);
  }
  return [...new Set(points.map((x) => Number(x.toFixed(12))))].sort((a, b) => a - b);
}

/** Corresponding upper/lower points, including each wedge corner exactly. */
export function sectionProfile(p: Parameters, u: number, chord: number): Point[] {
  const root = profileDefinition(p, 'root'),
    tip = profileDefinition(p, 'tip');
  const xs = sampleXs(p),
    edge = n(p, 'trailingEdge') / chord;
  const side = (x: number, upper: boolean): Point => {
    const a = ordinate(root, x, upper),
      b = ordinate(tip, x, upper);
    return [
      a[0] * (1 - u) + b[0] * u,
      a[1] * (1 - u) + b[1] * u + ((upper ? 1 : -1) * x * edge) / 2,
    ];
  };
  const upper = xs.map((x) => side(x, true));
  const lower = xs
    .slice(1, edge === 0 && Math.abs(side(1, true)[1] - side(1, false)[1]) < 1e-10 ? -1 : undefined)
    .reverse()
    .map((x) => side(x, false));
  return [...upper, ...lower];
}
