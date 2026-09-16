import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import {
  B,
  C,
  T,
  torus,
  poly,
  move,
  rotate,
  union,
  cut,
  ring,
  boltCircle,
  teeth,
  link,
  arcBand,
  finish,
} from './helpers';
import type { Shape, Vec } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const detailed = p.detail === 'detailed';
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const w = n(p, 'width'),
    h = n(p, 'height'),
    l = n(p, 'length');
  if (p.form === 'woodruff') {
    const r = l / 2,
      base = r - h;
    const a = Math.acos(base / r);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const t = -a + (2 * a * i) / 32;
      pts.push([r * Math.sin(t), r * Math.cos(t) - base]);
    }
    add('Woodruff key', rotate(poly(pts, w, -w / 2), 90));
  } else
    add(
      'Parallel key',
      p.form === 'parallel' ? B(l, w, h) : link([-l / 2 + w / 2, 0], [l / 2 - w / 2, 0], w, h, 0),
    );
  return finish(out, state);
}
