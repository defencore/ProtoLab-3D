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
  const a = n(p, 'inlet') / 2,
    b = n(p, 'outlet') / 2,
    l = n(p, 'length'),
    t = n(p, 'wall');
  let outer: [number, number][] = [
    [a, 0],
    [b, l],
  ];
  if (p.form === 'inlet')
    outer = Array.from({ length: 9 }, (_, i) => [b + (a - b) * (1 - i / 8) ** 2, (l * i) / 8]);
  add('Duct', T([...outer, ...[...outer].reverse().map(([r, z]): [number, number] => [r - t, z])]));
  return finish(out, state);
}
