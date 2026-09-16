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
    b = n(p, 'bore'),
    l = n(p, 'length');
  let s = C(d, l);
  if (p.form === 'flange') s = union(s, C(n(p, 'flange'), n(p, 'flangeHeight')));
  s = cut(s, C(b, l + 2, -1));
  if (detailed) s = cut(s, C((b + d) / 2, 1, l / 2));
  add('Bearing sleeve', s, 0xb99b50);
  return finish(out, state);
}
