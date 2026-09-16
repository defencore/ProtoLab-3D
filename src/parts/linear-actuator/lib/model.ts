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
    l = n(p, 'bodyLength'),
    r = n(p, 'rod'),
    m = n(p, 'motor');
  add('Actuator tube', ring(d, r + 0.4, l));
  add('Extending rod', C(r, l * 0.4 + n(p, 'extension'), l * 0.6));
  add('Gearmotor housing', B(m, m, m * 0.6, m / 2 + d / 2 + 0.2, 0, 5));
  return finish(out, state);
}
