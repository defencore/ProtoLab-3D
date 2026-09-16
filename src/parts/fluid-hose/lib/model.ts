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
    b = n(p, 'bore');
  if (p.form === 'straight') add('Hose segment', ring(d, b, n(p, 'length')), 0x373d44);
  else {
    const r = n(p, 'radius');
    const full = cut(torus(r, d / 2), torus(r, b / 2));
    add(
      'Hose elbow',
      cut(full, B(r * 4, r * 2, d * 2, 0, -r, -d), B(r * 2, r * 4, d * 2, -r, 0, -d)),
      0x373d44,
    );
  }
  return finish(out, state);
}
