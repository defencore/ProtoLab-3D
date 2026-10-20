import { n, made, prism, C, union, subtract, type Shape, type Vec } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const r = n(p, 'tubeOD') / 2,
    R = n(p, 'mateOD') / 2,
    a = (n(p, 'angle') * Math.PI) / 180,
    ri = r + n(p, 'clearance') / 2,
    ro = ri + n(p, 'wall'),
    steps = 96,
    profile = Array.from({ length: steps }, (_, i) => {
      const t = (i * 2 * Math.PI) / steps;
      return (
        (r * Math.cos(t) * Math.cos(a) + Math.sqrt(Math.max(0, R * R - r * r * Math.sin(t) ** 2))) /
        Math.sin(a)
      );
    }),
    low = Math.min(...profile);
  return { r, R, a, ri, ro, steps, heights: profile.map((z) => z - low + n(p, 'base')) };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    points: Vec[] = [],
    faces: number[][] = [];
  for (const radius of [d.ro, d.ri])
    for (const top of [false, true])
      for (let i = 0; i < d.steps; i++) {
        const t = (i * 2 * Math.PI) / d.steps + (n(p, 'phase') * Math.PI) / 180;
        points.push([radius * Math.cos(t), radius * Math.sin(t), top ? d.heights[i] : 0]);
      }
  const add = (a: number, b: number, c: number, e: number) => {
    faces.push([a, b, c], [a, c, e]);
  };
  for (let i = 0; i < d.steps; i++) {
    const j = (i + 1) % d.steps,
      N = d.steps;
    add(i, j, N + j, N + i);
    add(2 * N + j, 2 * N + i, 3 * N + i, 3 * N + j);
    add(N + i, N + j, 3 * N + j, 3 * N + i);
    add(j, i, 2 * N + i, 2 * N + j);
  }
  let volume = 0;
  for (const [ia, ib, ic] of faces) {
    const a = points[ia],
      b = points[ib],
      c = points[ic];
    volume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  if (volume < 0) faces.forEach((f) => f.reverse());
  const apothem = d.ro + 2;
  const outline: [number, number][] = Array.from({ length: 8 }, (_, i) => {
    const angle = ((2 * i + 1) * Math.PI) / 8;
    return [
      (apothem / Math.cos(Math.PI / 8)) * Math.cos(angle),
      (apothem / Math.cos(Math.PI / 8)) * Math.sin(angle),
    ];
  });
  const shell: Shape = { kind: 'boundary', points, faces };
  const rim = subtract(prism(outline, 3, 0), C(2 * d.ri, 5, 0, 0, -1));
  return [made('sleeve', 'Fishmouth profile / flat-sided clamping rim', union(shell, rim))];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  return n(p, 'mateOD') < n(p, 'tubeOD')
    ? ['This full saddle sleeve requires mating tube OD at least as large as the trimmed tube.']
    : [];
}
export function assessment(p: Parameters) {
  return [
    `Intersecting outside cylinders OD${p.tubeOD} and OD${p.mateOD}, axes at ${p.angle} degrees. Profile sampled at 96 angular stations.`,
    `Slide onto the workpiece, align phase and the sleeve base with a chosen axial layout datum, then scribe the upper edge. There is no tube-end stop or automatic finished-length setting. Remove the template before sawing and file to fit; tube walls, weld gap and root preparation are separate decisions.`,
  ];
}
