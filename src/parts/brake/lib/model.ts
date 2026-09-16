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
    t = n(p, 'thickness'),
    h = n(p, 'depth');
  add('Brake rotor', ring(d, b, t));
  if (p.form === 'disc')
    add(
      'Caliper body',
      cut(
        B(d * 0.35, d * 0.3, h, d * 0.43, 0, -h / 2 + t / 2),
        B(d * 0.5, d * 0.4, t + 0.6, d * 0.25, 0, -0.3),
      ),
      0x535e69,
    );
  else add('Brake stator / drum', ring(d + 8, d + 0.4, h, -h / 2 + t / 2), 0x535e69);
  return finish(out, state);
}
