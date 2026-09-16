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
    l = n(p, 'length'),
    g = n(p, 'gap'),
    hub = (l - g) / 2;
  if (p.form === 'rigid') {
    let s = ring(d, b, l);
    if (detailed) s = cut(s, move(rotate(C(3, d), 90), 0, d / 2, hub / 2));
    add('Rigid sleeve', s);
  } else {
    add('Input hub', ring(d, b, hub));
    add('Output hub', ring(d, b, hub, hub + g));
    let middle: Shape = ring(d * 0.82, b + 1, g - 0.4, hub + 0.2);
    if (p.form === 'bellows' && detailed) {
      const prof: [number, number][] = [];
      for (let i = 0; i <= 16; i++)
        prof.push([d * (i % 2 ? 0.4 : 0.48), hub + 0.2 + ((g - 0.4) * i) / 16]);
      for (let i = 16; i >= 0; i--)
        prof.push([d * (i % 2 ? 0.4 : 0.48) - 0.5, hub + 0.2 + ((g - 0.4) * i) / 16]);
      middle = T(prof);
    }
    if (p.form === 'beam' && detailed)
      for (let i = 0; i < 4; i++)
        middle = cut(
          middle,
          rotate(B(d, 0.6, 0.6, 0, 0, hub + 0.8 + (i * (g - 2)) / 4), 0, 0, i * 90),
        );
    if (p.form === 'oldham')
      middle = cut(
        middle,
        B(d * 0.8, 2, 0.5, 0, 0, hub + 0.2),
        B(2, d * 0.8, 0.5, 0, 0, hub + g - 0.7),
      );
    if (p.form === 'flange' || p.form === 'shear' || p.form === 'detent')
      middle = boltCircle(middle, d * 0.6, 2.5, 4, g + 2, hub - 1);
    add(
      p.form === 'oldham' ? 'Floating centre disc' : 'Flexible / transfer element',
      middle,
      p.form === 'oldham' ? 0x454950 : 0xb2b9c0,
    );
  }

  return finish(out, state);
}
