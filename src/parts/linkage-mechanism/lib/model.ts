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
    add(label, link(a, b0, w, h, layer * step, b, p.form === 'scissor'));
  const pivot = (label: string, point: [number, number], low: number, high: number) => {
    const z = low * step - 0.2;
    add(
      label,
      union(
        C(b - 0.2, (high - low) * step + h + 0.4, z, point[0], point[1]),
        C(b * 1.5, h * 0.3, z - h * 0.3, point[0], point[1]),
      ),
      0xb5a579,
    );
  };
  if (p.form === 'fourbar') {
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
    pivot('Input ground pin', A, -1, 0);
    pivot('Output ground pin', D, -1, 2);
    pivot('Crank joint pin', B0, 0, 1);
    pivot('Rocker joint pin', J, 1, 2);
  } else if (p.form === 'slider') {
    const x = B0[0] + Math.sqrt(l * l - B0[1] * B0[1]);
    bar('Input crank', A, B0, 0);
    bar('Connecting rod', B0, [x, 0], 1);
    add('Slider block', cut(B(w * 2, w * 2, h, x, 0, 2 * step), C(b, h + 2, 2 * step - 1, x)));
    add(
      'Slider guide',
      cut(
        B(2 * r + 3 * w, 3 * w, h * 1.5, l, 0, 2 * step),
        B(2 * r + 3 * w + 2, 2 * w + 0.4, h + 0.6, l, 0, 2 * step - 0.2),
      ),
      0x56626e,
    );
    add('Crank pedestal', ring(w, b, h, -step));
    pivot('Crank axle', A, -1, 0);
    pivot('Crank pin', B0, 0, 1);
    pivot('Slider pin', [x, 0], 1, 2);
  } else if (p.form === 'yoke') {
    bar('Input crank', A, B0, 0);
    const x = B0[0];
    add(
      'Slotted yoke',
      cut(
        union(
          B(w * 2, 2 * r + w * 2, h, x, 0, step),
          B(l, w * 0.5, h, x + l / 2 + w - 0.01, 0, step),
        ),
        B(w, 2 * r + w, h + 2, x, 0, step - 1),
      ),
    );
    add('Yoke roller', move(ring(w - 0.4, b, h, step), B0[0], B0[1]), 0x56626e);
    add(
      'Yoke rod guide',
      cut(
        B(w, w, h * 2, l * 0.5 + w, 0, step - h * 0.5),
        B(w + 2, w * 0.5 + 0.4, h + 0.4, l * 0.5 + w, 0, step - 0.2),
      ),
      0x56626e,
    );
    add('Crank pedestal', ring(w, b, h, -step));
    pivot('Crank axle', A, -1, 0);
    pivot('Yoke roller pin', B0, 0, 1);
  } else if (p.form === 'scissor') {
    const rise = l * (0.2 + (0.65 * (1 - Math.cos(theta))) / 2),
      half = Math.sqrt(l * l - rise * rise) / 2;
    bar('Scissor link A', [-half, 0], [half, rise], 0);
    bar('Scissor link B', [half, 0], [-half, rise], 1);
    const platform = (y: number, z: number) =>
      cut(B(l + w, w, h, 0, y, z), B(l + b + 1, b + 0.4, h + 2, 0, y, z - 1));
    add('Lift platform with slide slots', platform(rise, 2 * step));
    add('Fixed base with slide slots', platform(0, -step));
    pivot('Scissor centre pin', [0, rise / 2], 0, 1);
    pivot('Base left pin', [-half, 0], -1, 0);
    pivot('Base right pin', [half, 0], -1, 1);
    pivot('Platform left pin', [-half, rise], 1, 2);
    pivot('Platform right pin', [half, rise], 0, 2);
  } else if (p.form === 'pantograph') {
    const u: [number, number] = [l * Math.cos(theta), l * Math.sin(theta)],
      v: [number, number] = [o, 0],
      uv: [number, number] = [u[0] + o, u[1]];
    bar('Parallelogram link A', A, u, 0);
    bar('Parallelogram link B', A, v, 1);
    bar('Parallelogram link C', u, uv, 1);
    bar('Parallelogram link D', v, uv, 0);
    for (const [i, point] of [A, u, v, uv].entries())
      pivot('Parallelogram joint ' + (i + 1), point, 0, 1);
  } else if (p.form === 'cam' || p.form === 'eccentric') {
    const R = l * 0.35,
      rr = w / 2;
    add('Eccentric cam', cut(C(2 * R, h, 0, B0[0], B0[1]), C(b, h + 2, -1)));
    const x = B0[0] + Math.sqrt((R + rr + 0.2) ** 2 - B0[1] ** 2);
    add('Cam pedestal', ring(w, b, h, -step));
    pivot('Cam axle', A, -1, 0);
    if (p.form === 'cam') {
      add('Roller follower', ring(2 * rr, b, h), 0x56626e);
      out[out.length - 1].shape = move(out[out.length - 1].shape, x);
      add('Follower slide', cut(B(w, 2 * w, h, x, 0, step), C(b, h + 2, step - 1, x)));
      pivot('Follower axle', [x, 0], 0, 1);
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
    const tip = points.reduce((a, b) => (a[0] > b[0] ? a : b)),
      pivotPoint: [number, number] = [R + w + l * 0.4, w * 0.6];
    const pawl = union(
      poly(
        [
          [tip[0] + 0.2, tip[1]],
          [pivotPoint[0], pivotPoint[1] - w * 0.35],
          [pivotPoint[0], pivotPoint[1] + w * 0.35],
        ],
        h,
      ),
      C(w * 0.7, h, 0, ...pivotPoint),
    );
    add('Pivoted pawl', cut(pawl, C(b, h + 2, -1, ...pivotPoint)));
    bar('Ratchet base', A, pivotPoint, -1);
    pivot('Wheel axle', A, -1, 0);
    pivot('Pawl axle', pivotPoint, -1, 0);
  } else {
    const N = n(p, 'slots'),
      drive = g * Math.sin(Math.PI / N),
      R = g * Math.cos(Math.PI / N) * 0.96;
    const phase = Math.atan2(Math.sin(theta), Math.cos(theta)),
      limit = Math.PI / 2 - Math.PI / N;
    const engaged = Math.max(-limit, Math.min(limit, phase));
    const beta = -Math.atan2(drive * Math.sin(engaged), g - drive * Math.cos(engaged));
    const pinPoint: [number, number] = [drive * Math.cos(theta), drive * Math.sin(theta)];
    add(
      'Geneva driver and indexing pin',
      cut(
        union(C(2 * (drive + w / 2), h), C(b - 0.2, step + 0.1, h - 0.01, ...pinPoint)),
        C(b, h + 2, -1),
      ),
    );
    let wheel = cut(
      poly(
        Array.from({ length: 192 }, (_, i): [number, number] => [
          R * Math.cos((i * Math.PI) / 96),
          R * Math.sin((i * Math.PI) / 96),
        ]),
        h,
        step,
      ),
      C(b, h + 2, step - 1),
    );
    for (let i = 0; i < N; i++) {
      const inner = g - drive - b;
      const slot = union(
        B(R - inner + 2, b + 0.6, h + 2, (inner + R + 2) / 2, 0, step - 1),
        C(b + 0.6, h + 2, step - 1, inner),
      );
      wheel = cut(wheel, rotate(slot, 0, 0, (i * 360) / N));
    }
    add('Geneva indexed wheel', move(rotate(wheel, 0, 0, 180 + (beta * 180) / Math.PI), g));
    bar('Indexer fixed base', A, D, -1);
    pivot('Driver axle', A, -1, 0);
    pivot('Indexed wheel axle', D, -1, 1);
  }

  return finish(out, state);
}
