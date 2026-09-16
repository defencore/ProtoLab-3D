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
  const w = n(p, 'width'),
    l = n(p, 'length'),
    h = n(p, 'height'),
    o = n(p, 'opening'),
    f = n(p, 'finger'),
    t = n(p, 'thickness');
  add('Gripper body', boltCircle(B(w, l, h), l * 0.65, 4, 4, h + 2));
  for (const sign of [-1, 1])
    add(sign < 0 ? 'Left jaw' : 'Right jaw', B(t, l * 0.5, f, (sign * (o + t)) / 2, 0, h + 0.2));
  return finish(out, state);
}
