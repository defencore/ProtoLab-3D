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
  const R = n(p, 'diameter') / 2,
    H = n(p, 'hub') / 2,
    h = n(p, 'hubHeight'),
    count = n(p, 'blades'),
    chord = n(p, 'chord');
  let rotor = ring(2 * H, n(p, 'bore'), h, -h / 2);
  for (let k = 0; k < count; k++) {
    let blade: Shape;
    if (p.form === 'centrifugal')
      blade = B(R - H * 0.8 - 2, 1.5, h, (R + H * 0.8 - 2) / 2, 0, -h / 2);
    else {
      const rings: Vec[][] = [];
      for (let j = 0; j < 5; j++) {
        const u = j / 4,
          x = H * 0.8 + (R - H * 0.8) * u,
          c = chord * (1 - (p.form === 'axial' ? 0.15 : p.form === 'marine' ? 0.4 : 0.65) * u),
          a = ((n(p, 'rootAngle') * (1 - u) + n(p, 'tipAngle') * u) * Math.PI) / 180,
          t = (c * n(p, 'thickness')) / 100;
        const section: [[number, number], [number, number], [number, number], [number, number]] = [
          [-c / 2, 0],
          [-c * 0.15, t / 2],
          [c / 2, 0],
          [-c * 0.15, -t / 2],
        ];
        rings.push(
          section.map(([y, z]) => [
            x,
            y * Math.cos(a) - z * Math.sin(a),
            y * Math.sin(a) + z * Math.cos(a),
          ]),
        );
      }
      blade = { kind: 'loft', rings };
    }
    rotor = union(rotor, rotate(blade, 0, 0, (k * 360) / count));
  }
  if (p.form === 'centrifugal')
    rotor = cut(
      union(teeth(H, R - 2, count, h, -h / 2), C(2 * R, 2, -h / 2 - 1)),
      C(n(p, 'bore'), h + 4, -h / 2 - 2),
    );
  add('Rotor', rotor, p.form === 'marine' ? 0xb6a276 : 0x596771);

  return finish(out, state);
}
