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
    h = n(p, 'height'),
    mid = (d + b) / 2;
  add(
    'Outer ring',
    boltCircle(ring(d, mid + 0.3, h), (d + mid) / 2, n(p, 'hole'), n(p, 'holes'), h + 2),
  );
  add(
    'Inner ring',
    boltCircle(ring(mid - 0.3, b, h), (b + mid) / 2, n(p, 'hole'), n(p, 'holes'), h + 2),
  );
  return finish(out, state);
}
