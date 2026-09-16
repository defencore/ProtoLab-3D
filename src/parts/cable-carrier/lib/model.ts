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
  if (p.form === 'duct' || !detailed)
    add('Cable channel', cut(B(w, h, l), B(w - 2 * t, h, l + 2, 0, t, -1)), 0x41464e);
  else {
    const count = n(p, 'links'),
      pitch = l / count;
    for (let i = 0; i < count; i++)
      add(
        'Carrier link ' + (i + 1),
        cut(
          B(w, h, pitch - 0.5, 0, 0, i * pitch),
          B(w - 2 * t, h - 2 * t, pitch + 1, 0, 0, i * pitch - 0.5),
        ),
        0x41464e,
      );
  }
  return finish(out, state);
}
