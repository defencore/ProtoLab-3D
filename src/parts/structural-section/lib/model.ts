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
    t = n(p, 'wall'),
    l = n(p, 'length');
  let s: Shape;
  if (p.form === 'i')
    s = union(B(w, t, l, 0, (h - t) / 2), B(w, t, l, 0, -(h - t) / 2), B(t, h, l));
  else if (p.form === 'c')
    s = union(B(w, t, l, 0, (h - t) / 2), B(w, t, l, 0, -(h - t) / 2), B(t, h, l, -(w - t) / 2));
  else if (p.form === 'l') s = union(B(w, t, l, 0, -(h - t) / 2), B(t, h, l, -(w - t) / 2));
  else s = cut(B(w, h, l), B(w - 2 * t, h - 2 * t, l + 2, 0, 0, -1));
  add('Cut section', s);
  return finish(out, state);
}
