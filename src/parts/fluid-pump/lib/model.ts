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
    l = n(p, 'length'),
    s = n(p, 'shaft');
  let body = p.form === 'gear' ? B(d, d * 0.75, l) : C(d, l);
  body = union(body, C(d + 12, 6));
  body = boltCircle(body, d * 0.85, 5, 4, 8, -1);
  for (const z of [l * 0.35, l * 0.7])
    body = cut(body, move(rotate(C(n(p, 'port'), d), 90), 0, d / 2, z));
  add('Pump / motor housing', body);
  add('Drive shaft', C(s, 25, -25.2));
  return finish(out, state);
}
