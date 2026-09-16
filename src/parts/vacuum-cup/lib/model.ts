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
    neck = n(p, 'neck'),
    h = n(p, 'height'),
    t = n(p, 'wall'),
    b = n(p, 'bore');
  add(
    'Suction cup',
    T([
      [d / 2, 0],
      [neck / 2, h * 0.7],
      [neck / 2, h],
      [b / 2, h],
      [b / 2, h * 0.7 - t],
      [neck / 2 - t, h * 0.7 - t],
      [d / 2 - t, 0],
    ]),
    0x373d44,
  );
  return finish(out, state);
}
