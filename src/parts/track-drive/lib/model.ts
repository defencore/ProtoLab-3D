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
  const d = n(p, 'diameter'),
    c = n(p, 'centres'),
    w = n(p, 'width'),
    t = n(p, 'thickness');
  const outer = union(C(d + 2 * t, w), C(d + 2 * t, w, 0, c), B(c, d + 2 * t, w, c / 2));
  const inner = union(
    C(d + 0.4, w + 2, -1),
    C(d + 0.4, w + 2, -1, c),
    B(c, d + 0.4, w + 2, c / 2, 0, -1),
  );
  add('Continuous track', cut(outer, inner), 0x373e45);
  for (const x of [0, c])
    add(x ? 'Idler wheel' : 'Drive wheel', move(ring(d, n(p, 'bore'), w * 0.85, w * 0.075), x));
  return finish(out, state);
}
