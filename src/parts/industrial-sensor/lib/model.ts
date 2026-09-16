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
  if (p.form === 'limit') {
    add('Switch body', B(d, d * 0.7, l), 0x444b54);
    add('Actuator lever', B(d * 0.25, d * 0.2, l * 0.7, d * 0.45, 0, l + 0.2));
    add('Roller', move(rotate(C(d * 0.3, d * 0.3), 90), d * 0.45, -d * 0.1 - 0.2, l * 1.7 + 0.2));
  } else {
    add('Sensor body', C(d, l));
    add(
      p.form === 'encoder' ? 'Encoder shaft' : 'Cable exit',
      C(s, e, l + 0.2),
      p.form === 'encoder' ? 0x929da5 : 0x383e44,
    );
    if (detailed) add('Sensing / mounting face', C(d * 0.92, 1, -1.2), 0x464e58);
  }
  return finish(out, state);
}
