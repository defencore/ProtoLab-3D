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
    c = n(p, 'chamfer'),
    tip = d - (p.form === 'taper' ? l * n(p, 'taper') : 0);
  add(
    'Locating pin',
    T([
      [0, 0],
      [d / 2 - c, 0],
      [d / 2, c],
      [tip / 2, l - c],
      [tip / 2 - c, l],
      [0, l],
    ]),
  );
  return finish(out, state);
}
