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
    ext = n(p, 'shaftLength');
  const axial = ['planetary', 'cycloidal', 'harmonic', 'motor'].includes(String(p.form));
  const housing = axial ? C(d, l) : B(d, d, l);
  add('Reducer housing', boltCircle(housing, n(p, 'mountPitch'), n(p, 'mountHole'), 4, l + 2));
  add('Output shaft', C(s, ext, l + 0.2));
  if (axial) add('Input shaft', C(s * 0.7, ext, -ext - 0.2));
  else if (p.form === 'parallel') add('Input shaft', C(s * 0.7, ext, -ext - 0.2, d * 0.27));
  else add('Input shaft', move(rotate(C(s * 0.7, ext), 0, 90), d / 2 + 0.2, 0, l * 0.5));
  if (detailed)
    for (let i = 0; i < n(p, 'stages'); i++)
      add(
        'Stage ' + (i + 1) + ' cover',
        move(
          boltCircle(
            axial
              ? ring(d + 6, d + 0.4, 3)
              : cut(B(d + 6, d + 6, 3), B(d + 0.4, d + 0.4, 5, 0, 0, -1)),
            n(p, 'mountPitch'),
            n(p, 'mountHole'),
            4,
            5,
          ),
          0,
          0,
          (i * l) / n(p, 'stages'),
        ),
        0x555c65,
      );

  return finish(out, state);
}
