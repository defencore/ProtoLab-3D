import { n, B, C, move, subtract, union, made } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const gap = n(p, 'stockWidth') + 0.5,
    w = gap + 14,
    h = n(p, 'stockHeight') + 10,
    base = n(p, 'floor');
  return { gap, w, h, base, L: n(p, 'length') };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    blank = union(B(d.L, d.w, d.h + d.base), B(20, d.w + 24, d.base, d.L / 2 - 10)),
    channel = B(d.L + 2, d.gap, d.h + 1, 0, 0, d.base),
    saw = move(
      B(n(p, 'kerf'), 3 * d.L, d.h + 2, 0, 0, d.base + 1),
      [0, 0, 0],
      [0, 0, n(p, 'angle')],
    );
  const body = subtract(
    blank,
    channel,
    saw,
    C(6.5, d.base + 2, d.L / 2 - 10, -d.w / 2 - 6, -1),
    C(6.5, d.base + 2, d.L / 2 - 10, d.w / 2 + 6, -1),
  );
  const stop = B(4, d.gap, Math.min(d.h - 3, 14), -n(p, 'stopDistance') - 2, 0, d.base);
  return [
    made('box', 'Hand saw guide / sacrificial floor', body),
    made('stop', 'Removable centerline-length end stop', stop),
  ];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  const d = layout(p),
    spread = (d.gap / 2) * Math.tan((n(p, 'angle') * Math.PI) / 180);
  return [
    n(p, 'stopDistance') + 8 > d.L / 2 ? 'Increase box length to fit the end stop.' : '',
    spread + n(p, 'kerf') + 5 >= d.L / 2 ? 'Increase box length for the angled saw slot.' : '',
    n(p, 'stopDistance') < spread + 6 ? 'Move the end stop beyond the angled cut envelope.' : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  const s = (n(p, 'stockWidth') / 2) * Math.tan((n(p, 'angle') * Math.PI) / 180);
  return [
    `Cut plane is ${p.angle} degrees from a square crosscut. Stop distance ${p.stopDistance} mm is measured on the stock centerline; nominal long/short edge distances are ${(n(p, 'stopDistance') + s).toFixed(2)} / ${(n(p, 'stopDistance') - s).toFixed(2)} mm.`,
    `Clamp stock and box; clamp the removable stop in its configured position. Use a manual fine saw only. Printed side slots wear and the 1 mm remaining sacrificial floor limits blade overtravel; replace when worn.`,
  ];
}
