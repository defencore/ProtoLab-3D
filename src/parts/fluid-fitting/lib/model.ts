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
    b = n(p, 'passage'),
    l = n(p, 'length'),
    c = n(p, 'connectionDiameter');
  let s = union(C(d, l * 0.5, l * 0.25), C(c, l));
  if (p.form === 'elbow') s = union(C(d, l * 0.3, l * 0.25), C(c, l * 0.5));
  if (p.form === 'quick') s = union(s, C(d + 3, l * 0.25, l * 0.25));
  let cuts: Shape[] = [C(b, p.form === 'elbow' ? l * 0.5 + 1 : l + 2, -1)];
  if (p.form === 'elbow' || p.form === 'tee') {
    s = union(s, move(rotate(C(c, l * 0.55), 0, 90), 0, 0, l * 0.5));
    cuts.push(move(rotate(C(b, l), 0, 90), 0, 0, l * 0.5));
  }
  if (p.form === 'bulkhead') s = union(s, C(d * 1.3, 4, l * 0.4));
  if (p.connection === 'jic')
    s = union(
      s,
      T([
        [b / 2, l],
        [c / 2, l],
        [b / 2, l + 3],
      ]),
    );
  if (p.connection === 'orfs') cuts.push(ring(c - 1, b + 1, 1, l - 0.7));
  add('Fitting body', cut(s, ...cuts), 0xb6a16c);
  if (detailed && p.connection === 'push') {
    if (p.form === 'elbow')
      add('Release collar', move(rotate(ring(c + 3, c + 0.2, 2), 0, 90), l * 0.55 - 2, 0, l * 0.5));
    else add('Release collar', ring(c + 3, c + 0.2, 2, l - 2));
  }

  return finish(out, state);
}
