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
    b = n(p, 'bore'),
    l = n(p, 'length'),
    g = n(p, 'groove');
  if (p.form === 'sheave')
    add(
      'Grooved sheave',
      T([
        [b / 2, 0],
        [d / 2, 0],
        [d / 2, l * 0.2],
        [d / 2 - g, l * 0.5],
        [d / 2, l * 0.8],
        [d / 2, l],
        [b / 2, l],
      ]),
    );
  else {
    add('Turnbuckle body', cut(B(d, d, l), B(d * 0.55, d + 2, l * 0.7, 0, 0, l * 0.15)));
    add('Lower eye', move(rotate(ring(b * 2, b, d * 0.35), 90), 0, d * 0.175, -g));
    add('Upper eye', move(rotate(ring(b * 2, b, d * 0.35), 90), 0, d * 0.175, l + g));
  }
  return finish(out, state);
}
