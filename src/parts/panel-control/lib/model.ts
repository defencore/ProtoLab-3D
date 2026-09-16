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
    m = n(p, 'mount'),
    h = n(p, 'height'),
    depth = n(p, 'depth');
  if (p.form === 'knob')
    add(
      'Rotary knob',
      cut(detailed ? teeth(d * 0.46, d / 2, 24, h) : C(d, h), C(m, h + 2, -1)),
      0x484f58,
    );
  else {
    add('Panel mounting body', C(m, depth, -depth - 0.2));
    const count = p.form === 'beacon' ? n(p, 'segments') : 1;
    for (let i = 0; i < count; i++)
      add(
        'Lens / button ' + (i + 1),
        C(d, h, i * (h + 0.2)),
        [0xd8584d, 0xe1b746, 0x629b6b][i % 3],
      );
  }
  return finish(out, state);
}
