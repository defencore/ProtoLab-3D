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
  const b = n(p, 'bore'),
    r = n(p, 'rod'),
    stroke = n(p, 'stroke'),
    e = n(p, 'extension'),
    t = n(p, 'wall'),
    cap = 6,
    l = stroke + 30,
    d = b + 2 * t;
  let body =
    p.form === 'compact' || p.form === 'tie' || p.form === 'rodless' ? B(d, d, l) : C(d, l);
  body = cut(body, C(b, l - 2 * cap, cap), C(r + 0.4, cap + 2, l - cap - 1));
  if (detailed)
    for (const z of [cap + n(p, 'port') / 2 + 1, l - cap - n(p, 'port') / 2 - 1])
      body = cut(body, move(rotate(C(n(p, 'port'), d), 90), 0, d / 2, z));
  add('Cylinder body', body);
  if (p.form === 'rodless')
    add(
      'External carriage',
      cut(B(d + 8, d + 8, 16, 0, 0, cap + e), B(d + 0.4, d + 0.4, 18, 0, 0, cap + e - 1)),
    );
  else {
    add('Piston', C(b - 0.4, 5, cap + e));
    add('Piston rod', C(r, l - cap - 5, cap + e + 5));
  }

  return finish(out, state);
}
