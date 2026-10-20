import { n, C, B, subtract, union, made, guides, holeSize, path, type Vec } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const l = n(p, 'length'),
    gap = n(p, 'stockThickness') + 0.3,
    w = gap + 12,
    centers: Vec[] = Array.from({ length: n(p, 'count') }, (_, i) => [
      -l / 2 + 4 + n(p, 'endOffset') + i * n(p, 'pitch'),
      n(p, 'centerOffset'),
      0,
    ]);
  return { l, gap, w, centers };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    drop = n(p, 'cheek');
  return [
    made(
      'body',
      'Dowel bridge / two registration cheeks / end stop',
      subtract(
        union(
          B(d.l, d.w, t),
          B(d.l, 6, drop + 0.2, 0, -d.gap / 2 - 3, -drop),
          B(d.l, 6, drop + 0.2, 0, d.gap / 2 + 3, -drop),
          B(4, d.w, drop + 0.2, -d.l / 2 + 2, 0, -drop),
        ),
        ...d.centers.map(([x, y]) => C(holeSize(p), t + 2, x, y, -1)),
      ),
    ),
    ...guides(p, d.centers, t),
  ];
}
export function paths(p: Parameters) {
  return layout(p).centers.map(([x, y]) => path(x, y, -0.2, n(p, 'drill'), n(p, 'plate') + 0.4));
}
export function validate(p: Parameters) {
  const d = layout(p);
  return [
    Math.abs(n(p, 'centerOffset')) + n(p, 'drill') / 2 + 1 > n(p, 'stockThickness') / 2
      ? 'The dowel hole needs at least 1 mm edge distance inside the board thickness.'
      : '',
    d.centers.at(-1)![0] > d.l / 2 - holeSize(p) / 2 - 3
      ? 'Increase guide length or reduce dowel count/pitch.'
      : '',
    n(p, 'endOffset') < holeSize(p) / 2 + 3
      ? 'Increase the first-dowel offset to leave material beside its guide.'
      : '',
    Math.abs(n(p, 'centerOffset')) + holeSize(p) / 2 + 2 > d.w / 2
      ? 'The guide seat must leave at least 2 mm of material at each bridge side.'
      : '',
    n(p, 'count') > 1 && n(p, 'pitch') < holeSize(p) + 3
      ? 'Increase dowel pitch for the guide bushings.'
      : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  return [
    `Register both cheeks against board faces and the stop against its end. Dowel centers: ${p.endOffset} mm from the end, then ${p.pitch} mm pitch.`,
    `Clamp in a vise. Set drilling depth separately; these guides do not limit blind-hole depth. Transfer the same datum face to the mating board.`,
  ];
}
