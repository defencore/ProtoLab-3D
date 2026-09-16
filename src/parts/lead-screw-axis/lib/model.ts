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
    z = n(p, 'position'),
    nl = n(p, 'nutLength'),
    nd = n(p, 'nutDiameter');
  add('Lead screw · nominal envelope', C(d, l));
  let nut = union(C(d + 8, nl, z), C(nd, 4, z));
  nut = cut(nut, C(d + 0.4, nl + 2, z - 1));
  nut = boltCircle(nut, nd * 0.72, 3, 4, 6, z - 1);
  add('Travelling nut', nut, 0xb89b58);
  return finish(out, state);
}
