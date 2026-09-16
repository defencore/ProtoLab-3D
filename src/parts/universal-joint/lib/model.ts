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
    s = n(p, 'shaft'),
    l = n(p, 'length');
  if (p.form === 'hooke') {
    const w = d * 0.7,
      t = d * 0.12;
    let y = union(
      C(s, l * 0.2),
      B(w, w, t, 0, 0, l * 0.18),
      B(t, d * 0.25, l * 0.32 + s, -w / 2 + t / 2, 0, l * 0.18),
      B(t, d * 0.25, l * 0.32 + s, w / 2 - t / 2, 0, l * 0.18),
    );
    y = cut(y, move(rotate(C(s * 0.8, d), 0, 90), -d / 2, 0, l / 2));
    add('Input yoke', y);
    add('Output yoke', move(rotate(y, 180, 0, 90), 0, 0, l));
    add(
      'Cross journal',
      union(
        move(rotate(C(s * 0.7, d * 0.66), 0, 90), -d * 0.33, 0, l / 2),
        move(rotate(C(s * 0.7, d * 0.66), 90), 0, d * 0.33, l / 2),
      ),
    );
  } else {
    add('Socket housing', ring(d, d * 0.6, d));
    const sphere = T(
      Array.from({ length: 33 }, (_, i): [number, number] => {
        const a = -Math.PI / 2 + (i * Math.PI) / 32;
        return [i === 0 || i === 32 ? 0 : d * 0.28 * Math.cos(a), d * 0.5 + d * 0.28 * Math.sin(a)];
      }),
    );
    add('Joint head and shaft', union(sphere, C(s, l * 0.55, d * 0.75)));
  }

  return finish(out, state);
}
