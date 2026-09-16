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
    s = n(p, 'shaft'),
    e = n(p, 'projection');
  let carrier = ring(d, s + 1, l);
  if (detailed) carrier = cut(carrier, B(d * 0.65, d * 2, l * 0.45, 0, 0, l * 0.275));
  add('Differential carrier', carrier);
  add('Left half-shaft', C(s, e, -e - 0.2));
  add('Right half-shaft', C(s, e, l + 0.2));
  if (detailed) add('Input ring wheel', ring(d + 12, d + 0.4, l * 0.2, l * 0.4), 0x59616c);
  return finish(out, state);
}
