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
    h = n(p, 'height');
  let s = ring(d, b, h, 1.2);
  if (detailed)
    for (let i = 0; i < 4; i++)
      s = cut(s, rotate(B(d * 0.15, d * 0.2, h + 2, 0, d / 2, 0), 0, 0, i * 90));
  add('Slotted locknut', s);
  add('Tab washer', cut(teeth(b / 2 + 2, n(p, 'washer') / 2, 12, 1), C(b + 0.2, 3, -1)));
  return finish(out, state);
}
