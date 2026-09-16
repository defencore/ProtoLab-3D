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
  const d = n(p, 'inside'),
    c = n(p, 'section'),
    w = n(p, 'grooveWidth'),
    h = n(p, 'grooveDepth'),
    r = (d + c) / 2;
  if (p.mode === 'seal') add('O-ring', torus(r, c / 2), 0x363a40);
  else if (p.mode === 'face') add('Face gland cutter', ring(2 * r + w, 2 * r - w, h, -h), 0xe89b55);
  else add('Radial gland cutter', ring(d + 2 * h, d, w, -w / 2), 0xe89b55);
  return finish(out, state);
}
