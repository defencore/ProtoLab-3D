import {
  n,
  C,
  B,
  prism,
  roundedRect,
  move,
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
  const span = n(p, 'slotLength') - n(p, 'slotWidth'),
    count = Math.max(2, Math.floor(span / (n(p, 'finalDrill') + 1)) + 1),
    pitch = span / (count - 1),
    centers: Vec[] = Array.from({ length: count }, (_, i) => [-span / 2 + i * pitch, 0, 0]);
  return {
    span,
    count,
    pitch,
    centers,
    L: n(p, 'slotLength') + 2 * n(p, 'border'),
    W: n(p, 'slotWidth') + 2 * n(p, 'border'),
  };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    blank = union(
      B(d.L, d.W, t),
      B(4, d.W, 6.2, -d.L / 2 + 2, 0, -6),
      B(d.L, 4, 6.2, 0, -d.W / 2 + 2, -6),
    );
  return [
    made(
      'pilot-mask',
      'Chain drilling pilot mask / common edge datums',
      subtract(
        blank,
        ...d.centers.map(([x, y]) => C(holeSize(p), t + 2, x, y, -1)),
        ...clampSlots(d.L, d.W, t),
      ),
    ),
    made(
      'profile-mask',
      'Finished slot scribing / inspection mask',
      move(
        subtract(
          blank,
          prism(
            roundedRect(n(p, 'slotLength'), n(p, 'slotWidth'), n(p, 'slotWidth') / 2),
            t + 2,
            -1,
          ),
          ...clampSlots(d.L, d.W, t),
        ),
        [d.L + 15, 0, 0],
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
    n(p, 'slotLength') <= n(p, 'slotWidth') + 8
      ? 'Slot length must exceed width by at least 8 mm.'
      : '',
    n(p, 'finalDrill') > n(p, 'slotWidth') - 1
      ? 'Leave at least 0.5 mm of filing allowance on each side of the slot.'
      : '',
    n(p, 'drill') > n(p, 'finalDrill')
      ? 'Pilot drill must not exceed the final enlargement drill.'
      : '',
    d.pitch < holeSize(p) + 1.5 ? 'Increase station spacing or use smaller guide bushings.' : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  const d = layout(p);
  return [
    `${d.count} pilot centers at ${d.pitch.toFixed(3)} mm pitch. Enlarge separately to ${p.finalDrill} mm; adjacent final holes retain ${(d.pitch - n(p, 'finalDrill')).toFixed(2)} mm webs.`,
    `Register both masks on the same two edges. Use the second mask to scribe and inspect the final capsule outline; remove printed masks before filing or sawing out the webs. It is not a wear-resistant filing die.`,
  ];
}
