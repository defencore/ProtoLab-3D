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
  const pitch = n(p, 'pitch'),
    r = pitch / (2 * Math.sin(Math.PI / n(p, 'teeth'))),
    c = n(p, 'centres'),
    w = n(p, 'width');
  const outside = union(
    C(2 * r + pitch * 0.5, w),
    C(2 * r + pitch * 0.5, w, 0, c),
    B(c, 2 * r + pitch * 0.5, w, c / 2),
  );
  const inside = union(
    C(2 * r + 1, w + 2, -1),
    C(2 * r + 1, w + 2, -1, c),
    B(c, 2 * r + 1, w + 2, c / 2, 0, -1),
  );
  add('Chain path envelope', cut(outside, inside), 0x42474e);
  for (const x of [0, c])
    add(
      x ? 'Driven sprocket' : 'Driver sprocket',
      move(
        cut(
          detailed
            ? teeth(r - pitch * 0.2, r - 0.2, n(p, 'teeth'), w * 0.6, w * 0.2)
            : C(2 * r - 0.4, w * 0.6, w * 0.2),
          C(n(p, 'bore'), w + 2, -1),
        ),
        x,
      ),
    );
  return finish(out, state);
}
