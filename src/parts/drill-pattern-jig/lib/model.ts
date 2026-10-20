import {
  n,
  C,
  B,
  subtract,
  union,
  made,
  guides,
  holeSize,
  clampSlots,
  path,
  type Vec,
} from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const count = n(p, 'count'),
    rows = n(p, 'rows'),
    cols = n(p, 'columns'),
    px = n(p, 'pitchX'),
    py = n(p, 'pitchY');
  const centers: Vec[] =
    p.pattern === 'circle'
      ? Array.from({ length: count }, (_, i) => [
          (n(p, 'pcd') / 2) * Math.cos((i * 2 * Math.PI) / count),
          (n(p, 'pcd') / 2) * Math.sin((i * 2 * Math.PI) / count),
          0,
        ])
      : p.pattern === 'grid'
        ? Array.from({ length: rows * cols }, (_, i) => [
            ((i % cols) - (cols - 1) / 2) * px,
            (Math.floor(i / cols) - (rows - 1) / 2) * py,
            0,
          ])
        : Array.from({ length: count }, (_, i) => [(i - (count - 1) / 2) * px, 0, 0]);
  const spanX =
      p.pattern === 'circle'
        ? n(p, 'pcd')
        : p.pattern === 'grid'
          ? (cols - 1) * px
          : (count - 1) * px,
    spanY = p.pattern === 'circle' ? n(p, 'pcd') : p.pattern === 'grid' ? (rows - 1) * py : 0;
  return { centers, length: spanX + 2 * n(p, 'edge'), width: spanY + 2 * n(p, 'edge') };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    f = n(p, 'fenceDrop');
  return [
    made(
      'plate',
      'Pattern guide / two underside edge datums',
      subtract(
        union(
          B(d.length, d.width, t),
          B(4, d.width, f + 0.2, -d.length / 2 + 2, 0, -f),
          B(d.length, 4, f + 0.2, 0, -d.width / 2 + 2, -f),
        ),
        ...d.centers.map(([x, y]) => C(holeSize(p), t + 2, x, y, -1)),
        ...clampSlots(d.length, d.width, t),
      ),
    ),
    ...guides(p, d.centers, t),
  ];
}
export function paths(p: Parameters) {
  return layout(p).centers.map(([x, y]) => path(x, y, -1, n(p, 'drill'), n(p, 'plate') + 2));
}
export function validate(p: Parameters) {
  const d = layout(p),
    dia = holeSize(p);
  return d.centers.some((a, i) =>
    d.centers.some((b, j) => j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < dia + 2),
  )
    ? [
        'Guide holes must leave at least 2 mm between stations. Increase pitch / PCD or reduce count.',
      ]
    : [];
}
export function assessment(p: Parameters) {
  const d = layout(p);
  return [
    `${d.centers.length} stations; plate ${d.length} x ${d.width} mm. Register the lower and left underside fences against two workpiece edges.`,
    `Clamp through the four 6.5 mm holes or use edge clamps. Remove chips between the plate and workpiece. Circular patterns are centered between the datum edges by half the plate dimensions.`,
  ];
}
