import {
  n,
  C,
  B,
  prism,
  subtract,
  union,
  made,
  guides,
  holeSize,
  path,
  type Vec,
  type Shape,
} from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const r = n(p, 'stockOD') / 2,
    l = n(p, 'length'),
    vertex = 6,
    center = vertex + r * Math.SQRT2,
    top = center + r + 0.5,
    width = Math.max(42, n(p, 'stockOD') + 24),
    baseTop = Math.max(18, vertex + r * Math.SQRT1_2 + 4);
  const centers: Vec[] = Array.from({ length: n(p, 'count') }, (_, i) => [
    -l / 2 + 5 + n(p, 'endOffset') + i * n(p, 'pitch'),
    0,
    top,
  ]);
  return { r, l, vertex, center, top, width, baseTop, centers };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    z = d.baseTop,
    half = d.width / 2 - 5;
  const trough = prism(
    [
      [-half, d.vertex + half],
      [0, d.vertex],
      [half, d.vertex + half],
      [half, z + 45],
      [-half, z + 45],
    ],
    d.l + 2,
    -d.l / 2 - 1,
    'y',
  );
  // This prism uses X/Z coordinates; rotate the long direction into shaft X.
  const channel: Shape = {
    kind: 'transform',
    child: trough,
    translation: [0, 0, 0],
    rotation: [0, 0, 90],
  };
  const base = subtract(B(d.l, d.width, z), channel);
  const body = union(
    base,
    B(d.l, 5, d.top + t - 0.1, 0, -d.width / 2 + 2.5, 0),
    B(d.l, 5, d.top + t - 0.1, 0, d.width / 2 - 2.5, 0),
    B(d.l, d.width, t, 0, 0, d.top),
    B(5, d.width, d.top + 0.2, -d.l / 2 + 2.5, 0, 0),
  );
  return [
    made(
      'frame',
      'V cradle / end stop / drill bridge',
      subtract(body, ...d.centers.map(([x, y, z]) => C(holeSize(p), t + 2, x, y, z - 1))),
    ),
    ...guides(p, d.centers, t),
  ];
}
export function paths(p: Parameters) {
  const d = layout(p);
  return d.centers.map(([x, y, z]) => path(x, y, z - 0.2, n(p, 'drill'), n(p, 'plate') + 0.4));
}
export function validate(p: Parameters) {
  const d = layout(p),
    last = d.centers.at(-1)![0];
  return [
    last > d.l / 2 - holeSize(p) / 2 - 3
      ? 'Increase fixture length or reduce offset/count/pitch.'
      : '',
    n(p, 'endOffset') < holeSize(p) / 2 + 3
      ? 'Increase the first-hole offset to retain its guide beside the end stop.'
      : '',
    n(p, 'count') > 1 && n(p, 'pitch') < holeSize(p) + 3
      ? 'Guide stations need at least 3 mm of material between them.'
      : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  const d = layout(p);
  return [
    `Shaft axis Z=${d.center.toFixed(3)} mm in a 90 degree V. The tube end contacts the inner end-stop face X=${(-d.l / 2 + 5).toFixed(1)}.`,
    `Slide stock along X, seat it in the V and clamp it down. First hole is ${p.endOffset} mm from its end. Use a depth stop for one tube wall; opposite-wall alignment is not guaranteed by a single-sided guide.`,
  ];
}
