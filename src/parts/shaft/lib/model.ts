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
    e = n(p, 'endDiameter'),
    l = n(p, 'length'),
    a = n(p, 'endLength'),
    g = n(p, 'groove');
  let s = union(C(d, l - 2 * a, a), C(e, l));
  if (p.form === 'taper')
    s = union(
      C(d, l - 2 * a, a),
      C(e, l - a),
      T([
        [0, l - a],
        [e / 2, l - a],
        [e * 0.32, l],
        [0, l],
      ]),
    );
  if (p.form === 'spline' && detailed) s = union(s, teeth(e / 2, e * 0.62, n(p, 'teeth'), a));
  if (detailed) {
    if (p.form !== 'spline')
      s = cut(s, B(n(p, 'keyWidth'), n(p, 'keyDepth') * 2, l * 0.35, 0, d / 2, l * 0.325));
    s = cut(s, ring(e + 2, e - 1, g, a * 0.2), ring(e + 2, e - 1, g, l - a * 0.2 - g));
  }
  add('Shaft', s);
  return finish(out, state);
}
