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
  const s = n(p, 'size'),
    d = n(p, 'depth'),
    pitch = n(p, 'pitch');
  let frame = cut(B(s, s, d), C(s * 0.86, d + 2, -1));
  frame = cut(
    frame,
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((y) => C(n(p, 'hole'), d + 2, -1, (x * pitch) / 2, (y * pitch) / 2)),
    ),
  );
  add('Fan frame', frame, 0x333941);
  let rotor = C(s * 0.25, d * 0.6, d * 0.2);
  if (detailed)
    for (let i = 0; i < n(p, 'blades'); i++)
      rotor = union(
        rotor,
        rotate(
          poly(
            [
              [s * 0.1, -s * 0.05],
              [s * 0.4, -s * 0.07],
              [s * 0.39, s * 0.04],
              [s * 0.13, s * 0.07],
            ],
            d * 0.12,
            d * 0.45,
          ),
          0,
          0,
          (i * 360) / n(p, 'blades'),
        ),
      );
  add('Fan rotor', rotor, 0x4c535d);

  return finish(out, state);
}
