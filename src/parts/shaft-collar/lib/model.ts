import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, move, rotate, union, cut, ring, finish } from './helpers';
export function pieces(p: Parameters, state: string): Piece[] {
  const d = n(p, 'diameter'),
    b = n(p, 'bore'),
    l = n(p, 'length'),
    screw = n(p, 'screw');
  const split = p.form === 'split',
    y = split ? (b + d) / 4 : 0,
    x = split ? -Math.sqrt((d / 2) ** 2 - y * y) : b / 2;
  const reach = split ? -2 * x : d / 2 - b / 2;
  const along = (diam: number, length: number, start: number) =>
    move(rotate(C(diam, length), 0, 90), start, y, l / 2);
  let body = cut(ring(d, b, l), along(screw + 0.2, split ? d : reach + 1, split ? -d / 2 : x));
  if (split) body = cut(body, along(screw * 1.7, d / 2 + x + 0.1, -d / 2 - 0.1));
  if (split) body = cut(body, B(Math.min(1, screw * 0.2), d, l + 2, 0, d / 2, -1));
  const out: Piece[] = [
    { label: split ? 'Split clamp collar' : 'Set-screw collar', shape: body, color: 0x87919c },
  ];
  if (p.detail === 'detailed') {
    const bolt = split
      ? union(along(screw, reach, x), along(screw * 1.65, screw * 0.6, x - screw * 0.6))
      : along(screw, reach, x);
    out.push({
      label: split ? 'Tangential clamp screw' : 'Radial set screw',
      shape: bolt,
      color: 0x555e69,
    });
  }
  return finish(out, state);
}
