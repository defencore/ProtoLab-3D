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
    t = n(p, 'wall'),
    d = n(p, 'hole');
  let s = union(
    B(l, w, t),
    B(t, w, h, -l / 2 + t / 2),
    B(t, w, h, l / 2 - t / 2, p.form === 'z' ? h - t : 0),
  );
  if (p.form === 'z')
    s = union(B(l * 0.55, w, t, -l * 0.225), B(t, w, h, 0), B(l * 0.55, w, t, l * 0.225, 0, h - t));
  s = cut(s, C(d, t + 2, -1, -n(p, 'pitch') / 2), C(d, t + 2, -1, n(p, 'pitch') / 2));
  add('Bent bracket', s);
  return finish(out, state);
}
