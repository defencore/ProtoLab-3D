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
  const b = n(p, 'cable'),
    d = n(p, 'thread'),
    af = n(p, 'hex'),
    l = n(p, 'length'),
    h = n(p, 'nut');
  const hex = (z: number, height: number) =>
    poly(
      Array.from({ length: 6 }, (_, i) => [
        (af / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3),
        (af / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3),
      ]),
      height,
      z,
    );
  add('Gland body', cut(union(C(d, l - h), hex(0, 4)), C(b + 0.6, l + 2, -1)));
  add('Compression nut', cut(hex(l - h + 0.2, h), C(b + 0.6, h + 2, l - h - 0.8)));
  return finish(out, state);
}
