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
    h = n(p, 'height'),
    t = n(p, 'thickness');
  if (p.form === 'disc')
    add(
      'Disc spring',
      T([
        [b / 2, h],
        [d / 2, 0],
        [d / 2, t],
        [b / 2, h + t],
      ]),
    );
  else if (p.form === 'wave') {
    const rings: Vec[][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i * Math.PI) / 24,
        z = (h / 2) * (1 + Math.sin(a * n(p, 'waves')));
      rings.push([
        [(b / 2) * Math.cos(a), (b / 2) * Math.sin(a), z],
        [(d / 2) * Math.cos(a), (d / 2) * Math.sin(a), z],
        [(d / 2) * Math.cos(a), (d / 2) * Math.sin(a), z + t],
        [(b / 2) * Math.cos(a), (b / 2) * Math.sin(a), z + t],
      ]);
    }
    rings.pop();
    const wedges = rings.map((r, i): Shape => ({
      kind: 'loft',
      rings: [r, rings[(i + 1) % rings.length]],
    }));
    add('Wave spring', union(...wedges));
  } else {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const x = -d / 2 + (d * i) / 24;
      pts.push([x, h * (1 - (4 * x * x) / (d * d))]);
    }
    for (let i = 24; i >= 0; i--) {
      const x = -d / 2 + (d * i) / 24;
      pts.push([x, h * (1 - (4 * x * x) / (d * d)) + t]);
    }
    add('Leaf spring', rotate(poly(pts, b, -b / 2), 90));
  }

  return finish(out, state);
}
