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
    h = n(p, 'height'),
    l = n(p, 'length'),
    t = n(p, 'wall');
  let rail = union(
    B(w * 0.65, t, l, 0, h / 2),
    B(t, h, l, -w * 0.325),
    B(t, h, l, w * 0.325),
    B(w * 0.2, t, l, -w * 0.4, -h / 2),
    B(w * 0.2, t, l, w * 0.4, -h / 2),
  );
  if (detailed)
    for (let z = n(p, 'pitch') / 2; z < l; z += n(p, 'pitch'))
      rail = cut(rail, move(rotate(C(n(p, 'hole'), h + 4), 90), 0, h / 2 + 2, z));
  add('Mounting rail', rail);

  return finish(out, state);
}
