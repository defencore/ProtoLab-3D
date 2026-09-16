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
    r = n(p, 'rod'),
    l = n(p, 'bodyLength'),
    e = n(p, 'extension'),
    eye = n(p, 'eye');
  add('Strut cylinder', ring(d, r + 0.4, l));
  add('Piston rod', C(r, l * 0.4 + e, l * 0.6));
  add('Lower eye', move(rotate(ring(eye * 2, eye, d * 0.6), 90), 0, d * 0.3, -eye));
  add('Upper eye', move(rotate(ring(eye * 2, eye, d * 0.6), 90), 0, d * 0.3, l + e + eye));
  return finish(out, state);
}
