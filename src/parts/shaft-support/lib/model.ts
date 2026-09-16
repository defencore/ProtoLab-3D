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
  const b = n(p, 'bore'),
    w = n(p, 'width'),
    h = n(p, 'height'),
    d = n(p, 'depth'),
    pitch = n(p, 'mountPitch'),
    hole = n(p, 'mountHole');
  if (['shf', 'fk', 'ff'].includes(String(p.form)))
    add(
      'Flange support',
      cut(
        B(w, w, d),
        C(b, d + 2, -1),
        C(hole, d + 2, -1, -pitch / 2),
        C(hole, d + 2, -1, pitch / 2),
      ),
    );
  else {
    let s = union(B(w, d, 5), B(b + 14, d, h + b / 2, 0, 0, 2));
    s = cut(
      s,
      move(rotate(C(b, d + 2), 90), 0, d / 2 + 1, h),
      C(hole, 7, -1, -pitch / 2),
      C(hole, 7, -1, pitch / 2),
    );
    if (p.form === 'sk') s = cut(s, B(1, d + 2, b + 10, 0, 0, h));
    add('Pillow support', s);
  }

  return finish(out, state);
}
