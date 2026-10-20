import { n, C, B, prism, roundedRect, subtract, union, made, clampSlots } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const offset = (n(p, 'follower') - n(p, 'cutter')) / 2,
    L = n(p, 'targetLength') + 2 * offset,
    W = p.opening === 'circle' ? L : n(p, 'targetWidth') + 2 * offset,
    r = p.opening === 'slot' ? W / 2 : n(p, 'corner') + offset;
  return { offset, L, W, r, bodyL: L + 2 * n(p, 'border'), bodyW: W + 2 * n(p, 'border') };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    drop = n(p, 'fenceDrop'),
    tool =
      p.opening === 'circle'
        ? C(d.L, t + 2, 0, 0, -1)
        : prism(roundedRect(d.L, d.W, d.r), t + 2, -1);
  const blank =
    drop > 0
      ? union(
          B(d.bodyL, d.bodyW, t),
          B(4, d.bodyW, drop + 0.2, -d.bodyL / 2 + 2, 0, -drop),
          B(d.bodyL, 4, drop + 0.2, 0, -d.bodyW / 2 + 2, -drop),
        )
      : B(d.bodyL, d.bodyW, t);
  return [
    made(
      'template',
      'Compensated router template / registration fences',
      subtract(blank, tool, ...clampSlots(d.bodyL, d.bodyW, t)),
    ),
  ];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  const d = layout(p);
  return [
    n(p, 'follower') <= n(p, 'cutter') ? 'Guide bush OD must be larger than cutter diameter.' : '',
    p.opening !== 'circle' && n(p, 'targetWidth') < n(p, 'cutter')
      ? 'Finished width must fit the cutter diameter.'
      : '',
    p.opening !== 'circle' && n(p, 'targetLength') < n(p, 'targetWidth')
      ? 'Finished length must be at least the width.'
      : '',
    p.opening === 'pocket' && (n(p, 'corner') < n(p, 'cutter') / 2 || 2 * d.r > Math.min(d.L, d.W))
      ? 'Pocket corner radius must fit the cutter and opening dimensions.'
      : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  const d = layout(p);
  return [
    `Radial compensation = (${p.follower} - ${p.cutter}) / 2 = ${d.offset} mm. Template opening ${d.L} x ${d.W} mm produces the configured nominal finished outline.`,
    `Use a plunge router with its actual guide bush centered on the cutter. Clamp outside the opening, check bush projection against template thickness and cut in suitable shallow passes. Intended for wood/plastics appropriate to the router and cutter.`,
  ];
}
