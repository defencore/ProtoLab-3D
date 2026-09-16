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
  const R = n(p, 'diameter') / 2,
    r = n(p, 'bore') / 2,
    h = n(p, 'height'),
    t = n(p, 'lip');
  let s: Shape = ring(2 * R, 2 * r, h);
  if (p.form === 'rod' || p.form === 'piston')
    s = T([
      [r, 0],
      [R, 0],
      [R, h],
      [R - t, h],
      [R - t, t],
      [r + t, t],
      [r + t, h],
      [r, h],
    ]);
  if (p.form === 'wiper')
    s = T([
      [r, 0],
      [R, 0],
      [R, h * 0.6],
      [r + t, h * 0.6],
      [r, h],
      [r - t * 0.25, h],
    ]);
  add('Seal profile', s, p.form === 'gasket' ? 0xb58b4e : 0x363a40);
  return finish(out, state);
}
