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
    l = n(p, 'length'),
    h = n(p, 'height'),
    b = n(p, 'base'),
    f = n(p, 'fin'),
    count = n(p, 'fins');
  let s = B(w, l, b);
  if (detailed)
    for (let i = 0; i < count; i++)
      s = union(s, B(f, l, h - b, (i / (count - 1) - 0.5) * (w - f), 0, b));
  else s = union(s, B(w, l, h - b, 0, 0, b));
  add('Heat sink', s);
  return finish(out, state);
}
