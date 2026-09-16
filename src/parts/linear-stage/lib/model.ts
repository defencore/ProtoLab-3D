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
  const l = n(p, 'length'),
    w = n(p, 'width'),
    h = n(p, 'height'),
    c = n(p, 'carriage'),
    z = n(p, 'position');
  let rail: Shape = B(w, h, l);
  if (p.form === 'dovetail')
    rail = poly(
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w * 0.35, h / 2],
        [-w * 0.35, h / 2],
      ],
      l,
    );
  if (p.form === 'telescopic') rail = cut(rail, B(w - 3, h - 3, l + 2, 0, 1, -1));
  add('Fixed rail', rail);
  let slider = cut(B(w + 8, h + 8, c, 0, 0, z), B(w + 0.4, h + 0.4, c + 2, 0, 0, z - 1));
  slider = cut(
    slider,
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((y) =>
        move(
          rotate(C(4, h + 12), 90),
          (x * n(p, 'holePitch')) / 2,
          h / 2 + 6,
          z + c / 2 + y * c * 0.3,
        ),
      ),
    ),
  );
  add('Moving carriage', slider, 0x505a65);
  if (detailed && p.form === 'belt') add('Timing belt envelope', B(w * 0.15, 1, l, 0, h / 2 + 5));

  return finish(out, state);
}
