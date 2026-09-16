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
  const l = n(p, 'length'),
    w = n(p, 'width'),
    h = n(p, 'height'),
    b = n(p, 'bore');
  let s = union(
    B(l, w, h * 0.55),
    B(p.form === 'hammer' ? l * 0.65 : l, n(p, 'neck'), h * 0.5, 0, 0, h * 0.5),
  );
  add('T-slot nut', cut(s, C(b, h + 2, -1)));
  return finish(out, state);
}
