import type { Parameters } from '../../../core/types';
import type { Point } from './shapes';
export const jaynesHinged = (p: Parameters) =>
  ['jaynes-v1', 'jaynes-v2', 'jaynes-v5'].includes(String(p.mechanism));
export const rotating = (p: Parameters) =>
  p.mechanism === 'geared-petal' || p.mechanism === 'jaynes-v4' || jaynesHinged(p);
export const mechanismOptions = [
  { value: 'jaynes-v1', label: 'Ben Jaynes V1 · transverse servo / hinged flaps' },
  { value: 'jaynes-v2', label: 'Ben Jaynes V2 · vertical servo / articulated flaps' },
  { value: 'jaynes-v3', label: 'Ben Jaynes V3 · Archimedean sliding leaves' },
  { value: 'jaynes-v4', label: 'Ben Jaynes V4 · geared rotating leaves' },
  { value: 'jaynes-v5', label: 'Ben Jaynes V5 · central servo / geared flaps' },
  { value: 'spiral', label: 'Waterloo · three-slot spiral cam' },
  { value: 'sculpted-cam', label: 'UGA / WPI · sculpted slot cam' },
  { value: 'curved-link', label: 'UGA · three curved links' },
  { value: 'mit-link', label: 'MIT · four sliding leaves / two levels' },
  { value: 'rack-pinion', label: 'Sprague · four rack-driven leaves' },
  { value: 'geared-petal', label: 'Geared pivoting petals · three sectors' },
];
export const paired = (p: Parameters) =>
  p.mechanism === 'mit-link' || p.mechanism === 'rack-pinion';
export const linked = (p: Parameters) =>
  p.mechanism === 'curved-link' || p.mechanism === 'mit-link';
export const layer = (p: Parameters, i: number) => (paired(p) ? (i % 2) * 20 : 0);
export const phases = (p: Parameters) =>
  jaynesHinged(p) ? [0, 180] : paired(p) ? [0, 90, 180, 270] : [0, 120, 240];
export const camLift = (p: Parameters, f: number) =>
  p.mechanism === 'sculpted-cam' ? f * f * (3 - 2 * f) : f;
export function linkage(p: Parameters) {
  const q0 = +p.tubeID * 0.23,
    start = ((+p.sweep + 15) * Math.PI) / 180,
    end = (15 * Math.PI) / 180;
  const length = (a: number) => Math.sqrt(q0 * q0 + a * a - 2 * q0 * a * Math.cos(start));
  const position = (a: number, t: number) =>
    a * Math.cos(t) + Math.sqrt(length(a) ** 2 - (a * Math.sin(t)) ** 2);
  let low = 0.01,
    high = q0 * 0.85;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (position(mid, end) - q0 < +p.stroke) low = mid;
    else high = mid;
  }
  const crank = (low + high) / 2,
    rod = length(crank),
    theta = start - ((start - end) * +p.deployment) / 100;
  return {
    crank,
    rod,
    theta,
    q: position(crank, theta),
    achievable: position(crank, end) - q0,
    joint: [crank * Math.cos(theta), crank * Math.sin(theta)] as Point,
  };
}
export function motion(p: Parameters) {
  const f = +p.deployment / 100;
  return {
    travel: linked(p) ? linkage(p).q - +p.tubeID * 0.23 : +p.stroke * camLift(p, f),
    angle: +p.sweep * f,
  };
}
/** Round-ended constant-width band around a polyline. */
export function ribbon(centers: Point[], width: number): Point[] {
  const n = centers.length - 1;
  const normals = centers.map((_, i) => {
    const a = centers[Math.max(0, i - 1)],
      b = centers[Math.min(n, i + 1)],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy);
    return [-dy / l, dx / l] as Point;
  });
  const side = (sign: number) =>
    centers.map(
      (p, i) =>
        [
          p[0] + ((normals[i][0] * width) / 2) * sign,
          p[1] + ((normals[i][1] * width) / 2) * sign,
        ] as Point,
    );
  const cap = (i: number, start: number): Point[] =>
    Array.from({ length: 13 }, (_, j) => [
      centers[i][0] + (width / 2) * Math.cos(start - (Math.PI * j) / 12),
      centers[i][1] + (width / 2) * Math.sin(start - (Math.PI * j) / 12),
    ]);
  return [
    ...side(1),
    ...cap(n, Math.atan2(normals[n][1], normals[n][0])).slice(1),
    ...side(-1).reverse().slice(1),
    ...cap(0, Math.atan2(-normals[0][1], -normals[0][0])).slice(1),
  ];
}
