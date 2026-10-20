import { n, C, B, move, subtract, union, made, bought, ring, clampSlots } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const t = n(p, 'plate'),
    r = n(p, 'pcd') / 2,
    z = t + 1.2,
    D = n(p, 'diameter'),
    a = (n(p, 'position') * 360) / n(p, 'count');
  return { t, r, z, D, a, side: D + 30 };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    pin = n(p, 'pin'),
    index = Array.from({ length: n(p, 'count') }, (_, i) => {
      const a = (i * 2 * Math.PI) / n(p, 'count');
      return C(pin + 0.2, d.t + 2, d.r * Math.cos(a), d.r * Math.sin(a), -1);
    }),
    mount = Array.from({ length: 4 }, (_, i) => {
      const a = ((i * 90 + 45) * Math.PI) / 180;
      return C(
        4.5,
        d.t + 2,
        (n(p, 'mountPCD') / 2) * Math.cos(a),
        (n(p, 'mountPCD') / 2) * Math.sin(a),
        -1,
      );
    });
  const base = subtract(
    B(d.side, d.side, d.t),
    C(8.3, d.t + 2, 0, 0, -1),
    C(pin + 0.2, d.t + 2, d.r, 0, -1),
    ...clampSlots(d.side, d.side, d.t),
  );
  const disc = move(
    subtract(C(d.D, d.t), C(8.3, d.t + 2, 0, 0, -1), ...index, ...mount),
    [0, 0, d.z],
    [0, 0, d.a],
  );
  const top = d.z + d.t + 1.1;
  return [
    made('base', 'Index fixture base / single pin datum', base, true),
    made('disc', 'Index disc / carrier hole pattern', disc, true),
    bought(
      'lower-washer',
      'Low-friction pivot washer',
      ring(20, 8.3, 1, 0, 0, d.t),
      'Pivot washer OD20 / ID8.3 / thickness1',
    ),
    bought(
      'upper-washer',
      'Pivot clamping washer',
      ring(20, 8.3, 1, 0, 0, d.z + d.t),
      'Clamping washer OD20 / ID8.3 / thickness1',
    ),
    bought(
      'pivot',
      'M8 pivot bolt envelope',
      union(C(8, top + 6, 0, 0, -6), C(13, 5, 0, 0, top)),
      'M8 bolt / choose grip and nut length; nominal envelope',
    ),
    bought(
      'index-pin',
      'Removable index locking pin',
      union(C(pin, top + 2, d.r, 0, 0), C(pin + 4, 3, d.r, 0, top + 2)),
      `Retained steel locking pin OD${pin}`,
    ),
  ];
}
export function paths() {
  return [];
}
export function validate(p: Parameters) {
  const D = n(p, 'diameter'),
    pcd = n(p, 'pcd'),
    pin = n(p, 'pin');
  return [
    pcd + pin + 8 > D ? 'Index holes need at least 4 mm radial disc-edge land.' : '',
    pcd * Math.sin(Math.PI / n(p, 'count')) < pin + 2.2
      ? 'Adjacent locking holes need at least 2 mm of material. Increase PCD or reduce divisions.'
      : '',
    n(p, 'position') >= n(p, 'count')
      ? 'Selected position must be less than the division count.'
      : '',
    n(p, 'mountPCD') + 12 > pcd - pin
      ? 'Move carrier holes inward to separate them from the index holes.'
      : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  return [
    `Index step ${(360 / n(p, 'count')).toFixed(3)} degrees; position ${p.position} = ${((n(p, 'position') * 360) / n(p, 'count')).toFixed(3)} degrees. The fixed base lock pin stays at +X.`,
    `Attach a separate workpiece carrier to the four 4.5 mm holes. Loosen the pivot, index with the machine stopped, fully insert the lock pin, retighten and clamp before drilling. Not a powered rotary table or a milling-load-rated fixture.`,
  ];
}
