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
    w = n(p, 'width'),
    b = n(p, 'bore'),
    count = n(p, 'rollers');
  if (p.form === 'pneumatic' || !detailed) {
    add('Tyre', ring(d, d * 0.55, w), 0x363c43);
    add('Rim', ring(d * 0.54, b, w * 0.9, w * 0.05));
  } else {
    add('Wheel disc', ring(d * 0.55, b, w * 0.35, w * 0.325));
    const rr = d * 0.065;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count;
      const roller = rotate(
        C(rr * 2, w * 0.65, -w * 0.325),
        p.form === 'mecanum' ? 45 : 90,
        0,
        (i * 360) / count,
      );
      add(
        'Peripheral roller ' + (i + 1),
        move(roller, d * 0.41 * Math.cos(a), d * 0.41 * Math.sin(a), w / 2),
        0x363c43,
      );
    }
  }

  return finish(out, state);
}
