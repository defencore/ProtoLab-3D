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
  let body = p.form === 'servo' || p.form === 'tt' ? B(d, d, l) : C(d, l);
  if (p.form === 'iec-b3') body = union(body, B(d * 1.3, d * 0.2, l * 0.7, 0, -d * 0.48, l * 0.15));
  if (p.form === 'iec-b5') body = union(body, C(d * 1.3, 6, l - 6));
  body = boltCircle(body, n(p, 'pitch'), n(p, 'hole'), 4, 6, l - 5);
  add('Motor housing', body, p.form === 'tt' ? 0xd5b644 : 0x677782);
  add('Output shaft', C(s, e, l + 0.2));
  if (detailed && ['iec-b3', 'iec-b5'].includes(String(p.form)))
    add('Terminal box', B(d * 0.4, d * 0.3, l * 0.35, 0, d * 0.65 + 0.2, l * 0.3));

  return finish(out, state);
}
