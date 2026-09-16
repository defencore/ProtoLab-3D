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
  const d = n(p, 'diameter') + 2 * n(p, 'clearance'),
    l = n(p, 'length'),
    t = n(p, 'wall'),
    count = n(p, 'count'),
    w = count * (d + t) + t;
  let tray = B(w, l + 2 * t, d * 0.65 + t, 0, 0, -t);
  for (let i = 0; i < count; i++)
    tray = cut(tray, B(d, l, d + 2, (i - (count - 1) / 2) * (d + t), 0, 0));
  add('Cell tray', tray, 0x39424b);
  return finish(out, state);
}
