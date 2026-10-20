import { n, C, B, subtract, made, bought, clampSlots, type Vec } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const r = n(p, 'radius'),
    w = n(p, 'wire'),
    pr = n(p, 'pin') / 2,
    span = n(p, 'span'),
    mandrels: Vec[] =
      p.form === 'loop'
        ? [[0, 0, 0]]
        : [
            [-span / 2 + r, 0, 0],
            [span / 2 - r, 0, 0],
          ],
    stops: Vec[] =
      p.form === 'loop'
        ? [[r + w + pr + 0.3, 0, 0]]
        : [
            [-span / 2 - w - pr - 0.3, r + 6, 0],
            [span / 2 + w + pr + 0.3, r + 6, 0],
          ],
    L = Math.max(100, p.form === 'u' ? span + 2 * n(p, 'pin') + 50 : 4 * r + 50),
    W = Math.max(80, 4 * r + 40);
  return { r, w, mandrels, stops, L, W };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate'),
    h = n(p, 'pinHeight'),
    stud = Math.min(5, 2 * d.r - 3);
  const base = subtract(
    B(d.L, d.W, t),
    ...d.mandrels.map(([x, y]) => C(stud + 0.2, t + 2, x, y, -1)),
    ...d.stops.map(([x, y]) => C(n(p, 'pin') + 0.1, t + 2, x, y, -1)),
    ...clampSlots(d.L, d.W, t),
  );
  const pins = d.mandrels.map(([x, y], i) =>
    bought(
      'mandrel-' + i,
      `Metal bend mandrel / inside R${d.r}`,
      { kind: 'union', children: [C(stud, t + 0.2, x, y, -0.1), C(2 * d.r, h, x, y, t)] },
      `Custom metal mandrel OD${2 * d.r} / shoulder stud${stud}; mechanically retain beneath plate`,
    ),
  );
  const guides = d.stops.map(([x, y], i) =>
    bought(
      'pin-' + i,
      'Retained steel guide pin',
      C(n(p, 'pin'), t + h, x, y, 0),
      `Steel dowel OD${p.pin} / mechanically retained, length ${t + h}`,
    ),
  );
  return [
    made('base', 'Drilled metal bending plate / bench clamp holes', base, true),
    ...pins,
    ...guides,
  ];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  const d = layout(p);
  return [
    p.form === 'u' && n(p, 'span') < 4 * d.r + 2
      ? 'U width must leave room between its two mandrels.'
      : '',
    2 * d.r < 6 ? 'Mandrel diameter must leave material around the 5 mm shoulder stud.' : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  return [
    `Mandrel OD ${2 * n(p, 'radius')} mm gives nominal inside radius ${p.radius} mm before springback. Guide clearance is wire diameter plus 0.3 mm.`,
    `Bolt or clamp the metal base to a bench; retain every pin from beneath. A printed copy is a hole-layout / light soft-wire prototype. Actual bend allowance, springback and allowable load depend on material and must be measured.`,
  ];
}
