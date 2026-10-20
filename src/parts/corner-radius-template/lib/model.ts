import { n, C, B, prism, subtract, union, made } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const r = n(p, 'radius'),
    s = n(p, 'reach'),
    points: [number, number][] = [
      [-s, -s],
      [0, -s],
      [0, -r],
    ];
  for (let i = 1; i <= 32; i++) {
    const a = (i * Math.PI) / 64;
    points.push([-r + r * Math.cos(a), -r + r * Math.sin(a)]);
  }
  points.push([-s, 0]);
  return { r, s, points };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    drop = n(p, 'fenceDrop'),
    arm = d.s - d.r - 4;
  return [
    made(
      'template',
      'Radius profile / two workpiece-edge stops',
      subtract(
        union(
          prism(d.points, t, 0),
          B(4, arm, drop + 0.2, 2, -d.s + arm / 2, -drop),
          B(arm, 4, drop + 0.2, -d.s + arm / 2, 2, -drop),
        ),
        C(6.5, t + 2, -d.s + 12, -d.s / 2, -1),
        C(6.5, t + 2, -d.s / 2, -d.s + 12, -1),
      ),
    ),
  ];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  return n(p, 'reach') < 2 * n(p, 'radius') + 16
    ? ['Increase template reach to leave sufficient straight registration and clamping arms.']
    : [];
}
export function assessment(p: Parameters) {
  return [
    `The theoretical sharp corner is X=0,Y=0. The two stops touch its original perpendicular edges; the quarter-circle radius is ${p.radius} mm.`,
    `Clamp, scribe, remove the template and cut/sand/file to the line. Refit to inspect. This exact-size scribing profile has no router follower compensation.`,
  ];
}
