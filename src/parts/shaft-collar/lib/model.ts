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
  let s = ring(d, b, l);
  if (detailed) s = cut(s, move(rotate(C(n(p, 'screw'), d), 0, 90), -d / 2, 0, l / 2));
  if (p.form === 'split') s = cut(s, B(1, d, l + 2, 0, d / 2, -1));
  add('Collar body', s);
  return finish(out, state);
}
