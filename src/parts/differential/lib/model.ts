import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, move, rotate, union, cut, teeth, finish } from './helpers';
import { miter } from './gears';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const d = n(p, 'diameter'),
    l = n(p, 'length'),
    s = n(p, 'shaft'),
    e = n(p, 'projection'),
    cap = l * 0.08;
  const R = Math.min(d * 0.27, l * 0.36),
    face = R * 0.32,
    spider = s * 0.45,
    clear = 0.15;
  let carrier = cut(C(d, l), C(s + 2 * clear, l + 2, -1), C(d * 0.8, l - 2 * cap, cap));
  if (p.detail === 'detailed' || state === 'internals') {
    carrier = cut(
      union(C(d, l), teeth(d * 0.49, d * 0.54, 60, l * 0.12, l * 0.1)),
      C(s + 2 * clear, l + 2, -1),
      C(d * 0.8, l - 2 * cap, cap),
      B(d * 0.6, d * 2, l * 0.5, 0, 0, l * 0.25),
      move(rotate(C(spider + 2 * clear, d + 2), 0, 90), -d / 2 - 1, 0, l / 2),
    );
    add(
      'Left bevel side gear',
      move(rotate(miter(R, face, 20, s + clear), 0, 0, 9), 0, 0, l / 2),
      0xb5a070,
    );
    add(
      'Right bevel side gear',
      move(rotate(miter(R, face, 20, s + clear), 180, 0, 9), 0, 0, l / 2),
      0xb5a070,
    );
    add(
      'Spider pinion A',
      move(rotate(miter(R, face, 20, spider + clear), 0, 90), 0, 0, l / 2),
      0xb5a070,
    );
    add(
      'Spider pinion B',
      move(rotate(miter(R, face, 20, spider + clear), 0, -90), 0, 0, l / 2),
      0xb5a070,
    );
    add('Cross pin', move(rotate(C(spider, d * 0.9), 0, 90), -d * 0.45, 0, l / 2), 0xc1c8ce);
  }
  if (state !== 'internals') add('Carrier with input gear', carrier);
  add('Left half-shaft', C(s, e + l / 2 - R + face, -e));
  add('Right half-shaft', C(s, e + l / 2 - R + face, l / 2 + R - face));
  return finish(out, state);
}
