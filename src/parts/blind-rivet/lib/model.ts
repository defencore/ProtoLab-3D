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
    b = n(p, 'mandrel');
  add('Rivet sleeve', cut(union(C(d, l), C(n(p, 'head'), d * 0.25)), C(b + 0.15, l + 2, -1)));
  add(
    'Pull mandrel',
    union(C(b, l + n(p, 'pull'), -n(p, 'pull')), C(d * 0.85, d * 0.5, l)),
    0x50555d,
  );
  return finish(out, state);
}
