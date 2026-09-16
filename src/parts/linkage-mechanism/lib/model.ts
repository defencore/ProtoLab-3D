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
  const g = n(p, 'ground'),
    r = n(p, 'crank'),
    l = n(p, 'rod'),
    o = n(p, 'output'),
    theta = (n(p, 'phase') * Math.PI) / 180,
    w = n(p, 'width'),
    h = n(p, 'thickness'),
    b = n(p, 'pin'),
    step = h + 0.5;
  const A: [number, number] = [0, 0],
    D: [number, number] = [g, 0],
    B0: [number, number] = [r * Math.cos(theta), r * Math.sin(theta)];
  const bar = (label: string, a: [number, number], b0: [number, number], layer: number) =>
    add(label, link(a, b0, w, h, layer * step, b));
  if (p.form === 'fourbar' || p.form === 'toggle') {
    const dx = D[0] - B0[0],
      dy = -B0[1],
      dist = Math.hypot(dx, dy),
      along = (l * l - o * o + dist * dist) / (2 * dist),
      off = Math.sqrt(Math.max(0, l * l - along * along));
    const J: [number, number] = [
      B0[0] + (along * dx) / dist - (off * dy) / dist,
      B0[1] + (along * dy) / dist + (off * dx) / dist,
    ];
    bar('Fixed pivot link', A, D, -1);
    bar('Input crank', A, B0, 0);
    bar('Coupler', B0, J, 1);
    bar('Output rocker', D, J, 2);
  } else if (p.form === 'slider') {
    const x = B0[0] + Math.sqrt(l * l - B0[1] * B0[1]);
    bar('Input crank', A, B0, 0);
    bar('Connecting rod', B0, [x, 0], 1);
    add('Slider block', cut(B(w * 2, w * 2, h, x, 0, 2 * step), C(b, h + 2, 2 * step - 1, x)));
  } else if (p.form === 'yoke') {
    bar('Input crank', A, B0, 0);
    const x = B0[0];
    add(
      'Slotted yoke',
      cut(B(w * 2, 2 * r + w * 2, h, x, 0, step), B(w, 2 * r + w, h + 2, x, 0, step - 1)),
    );
    add('Yoke output rod', B(l, w * 0.5, h, x + l / 2 + w + 0.2, 0, step));
  } else if (p.form === 'scissor') {
    const rise = l * (0.2 + (0.65 * (1 - Math.cos(theta))) / 2),
      half = Math.sqrt(l * l - rise * rise) / 2;
    bar('Scissor link A', [-half, 0], [half, rise], 0);
    bar('Scissor link B', [half, 0], [-half, rise], 1);
    add('Lift platform', B(2 * half + w, w, h, 0, rise, 2 * step));
  } else if (p.form === 'pantograph') {
    const u: [number, number] = [l * Math.cos(theta), l * Math.sin(theta)],
      v: [number, number] = [o, 0],
      uv: [number, number] = [u[0] + o, u[1]];
    bar('Pantograph link A', A, u, 0);
    bar('Pantograph link B', A, v, 1);
    bar('Pantograph link C', u, uv, 1);
    bar('Pantograph link D', v, uv, 0);
  } else if (p.form === 'cam' || p.form === 'eccentric') {
    const R = l * 0.35,
      rr = w / 2;
    add('Eccentric cam', cut(C(2 * R, h, 0, B0[0], B0[1]), C(b, h + 2, -1)));
    const x = B0[0] + Math.sqrt((R + rr + 0.2) ** 2 - B0[1] ** 2);
    if (p.form === 'cam') {
      add('Roller follower', ring(2 * rr, b, h), 0x56626e);
      out[out.length - 1].shape = move(out[out.length - 1].shape, x);
    }
  } else if (p.form === 'ratchet') {
    const R = o,
      points: [number, number][] = [];
    for (let i = 0; i < n(p, 'slots') * 2; i++) {
      const a = (i * Math.PI) / n(p, 'slots') + theta,
        rad = i % 2 ? R : R - w * 0.6;
      points.push([rad * Math.cos(a), rad * Math.sin(a)]);
    }
    add('Ratchet wheel', cut(poly(points, h), C(b, h + 2, -1)));
    bar('Pawl', [R + w, 0], [R + w + l * 0.4, w * 0.6], 0);
  } else {
    const N = n(p, 'slots'),
      drive = g * Math.sin(Math.PI / N),
      R = g * Math.cos(Math.PI / N) * 0.85;
    add('Driver disc', C(drive * 1.4, h));
    add('Drive pin', C(b, h, h + 0.2, drive * Math.cos(theta), drive * Math.sin(theta)));
    let wheel = cut(
      poly(
        Array.from({ length: 128 }, (_, i): [number, number] => [
          R * Math.cos((i * Math.PI) / 64),
          R * Math.sin((i * Math.PI) / 64),
        ]),
        h,
        2 * step,
      ),
      C(b, h + 2, 2 * step - 1),
    );
    for (let i = 0; i < N; i++)
      wheel = cut(wheel, rotate(B(R, b + 1, h + 2, R * 0.8, 0, 2 * step - 1), 0, 0, (i * 360) / N));
    add('Geneva wheel', move(wheel, g));
  }

  return finish(out, state);
}
