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
    h = n(p, 'height'),
    b = n(p, 'bore'),
    l = n(p, 'stud');
  if (p.form === 'bobbin') {
    add('Elastomer', C(d, h), 0x30343a);
    add('Lower stud', C(b, l, -l - 0.1));
    add('Upper stud', C(b, l, h + 0.1));
  } else {
    add('Elastomer', ring(d - 2, b + 2.4, h), 0x30343a);
    add('Inner sleeve', ring(b + 2, b, h + 2, -1));
    add('Outer sleeve', ring(d, d - 1.8, h));
  }
  return finish(out, state);
}
