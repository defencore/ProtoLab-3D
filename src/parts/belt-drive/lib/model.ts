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
  const r = (n(p, 'pitch') * n(p, 'teeth')) / (2 * Math.PI),
    c = n(p, 'centres'),
    w = n(p, 'width'),
    t = n(p, 'thickness'),
    b = n(p, 'bore');
  const outer = union(C(2 * (r + t), w, 0), C(2 * (r + t), w, 0, c), B(c, 2 * (r + t), w, c / 2));
  const inner = union(
    C(2 * (r + 0.3), w + 2, -1),
    C(2 * (r + 0.3), w + 2, -1, c),
    B(c, 2 * (r + 0.3), w + 2, c / 2, 0, -1),
  );
  add('Belt loop', cut(outer, inner), 0x343840);
  for (const x of [0, c]) {
    let pulley =
      detailed && !['v', 'poly'].includes(String(p.form))
        ? teeth(r - 0.8, r - 0.1, n(p, 'teeth'), w)
        : C(2 * (r - 0.1), w);
    pulley = cut(
      union(
        pulley,
        C(2 * (r + t + 0.5), 1, -1.2),
        C(2 * (r + t + 0.5), 1, w + 0.2),
        C(2 * (r - 0.5), w + 2.4, -1.2),
      ),
      C(b, w + 5, -2),
    );
    add(x === 0 ? 'Driver pulley' : 'Driven pulley', move(pulley, x));
  }

  return finish(out, state);
}
