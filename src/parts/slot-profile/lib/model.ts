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
  const c = n(p, 'cell'),
    nx = n(p, 'columns'),
    ny = n(p, 'rows'),
    w = c * nx,
    h = c * ny,
    l = n(p, 'length'),
    o = n(p, 'slot'),
    t = n(p, 'wall');
  let s = B(w, h, l);
  const holes: Shape[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      holes.push(C(c * 0.18, l + 2, -1, -w / 2 + c * (i + 0.5), -h / 2 + c * (j + 0.5)));
  for (let i = 0; i < nx; i++)
    for (const sign of [-1, 1]) {
      const x = -w / 2 + c * (i + 0.5),
        y = (sign * h) / 2;
      holes.push(
        B(o, c * 0.24, l + 2, x, y, -1),
        B(o + 2 * t, c * 0.15, l + 2, x, y - sign * c * 0.15, -1),
      );
    }
  for (let j = 0; j < ny; j++)
    for (const sign of [-1, 1]) {
      const y = -h / 2 + c * (j + 0.5),
        x = (sign * w) / 2;
      holes.push(
        B(c * 0.24, o, l + 2, x, y, -1),
        B(c * 0.15, o + 2 * t, l + 2, x - sign * c * 0.15, y, -1),
      );
    }
  add('Extrusion', cut(s, ...holes));

  return finish(out, state);
}
