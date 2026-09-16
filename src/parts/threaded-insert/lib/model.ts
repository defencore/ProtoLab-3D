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
    b = n(p, 'bore');
  let s = C(d, l);
  if (p.form !== 'heat') s = union(s, C(n(p, 'flange'), Math.min(l * 0.25, 2)));
  if (detailed && p.form === 'heat')
    s = union(s, teeth(d / 2 - 0.2, d / 2 + 0.25, 16, l * 0.75, l * 0.1));
  add('Insert body', cut(s, C(b, l + 2, -1)), 0xc49845);
  return finish(out, state);
}
