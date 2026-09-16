import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, T, move, rotate, union, cut, ring, finish } from './helpers';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const d = n(p, 'diameter'),
    w = n(p, 'width'),
    b = n(p, 'bore'),
    count = n(p, 'rollers');
  if (p.form === 'pneumatic') {
    add(
      'Tyre',
      cut(
        ring(d, d * 0.55, w),
        C(d * 0.61, w * 0.05 + 0.01, -0.01),
        C(d * 0.61, w * 0.05 + 0.01, w * 0.95),
      ),
      0x363c43,
    );
    add(
      'Rim and bead seats',
      cut(
        union(
          C(d * 0.55, w * 0.9, w * 0.05),
          C(d * 0.61, w * 0.05),
          C(d * 0.61, w * 0.05, w * 0.95),
        ),
        C(b, w + 2, -1),
      ),
    );
  } else {
    const rr = Math.min(d * 0.065, d * Math.sin(Math.PI / count) * 0.3),
      radius = d / 2 - rr;
    const length = Math.min(w * 0.65, 2 * radius * Math.sin(Math.PI / count) * 0.65),
      axle = rr * 0.55,
      gap = rr * 0.04,
      ear = rr * 0.4;
    const tilt = p.form === 'mecanum' ? 45 : 90,
      reach = radius - d * 0.22;
    let hub = C(d * 0.55, w * 0.85, w * 0.075);
    for (let i = 0; i < count; i++) {
      const a = (i * 360) / count,
        x = radius * Math.cos((a * Math.PI) / 180),
        y = radius * Math.sin((a * Math.PI) / 180);
      const locate = (s: Shape) => move(rotate(s, tilt, 0, a), x, y, w / 2);
      const fork = union(
        B(reach, rr * 0.65, ear, -reach / 2, 0, -length / 2 - gap - ear),
        B(reach, rr * 0.65, ear, -reach / 2, 0, length / 2 + gap),
        C(axle, length + 2 * gap + 2 * ear, -length / 2 - gap - ear),
      );
      hub = union(hub, locate(fork));
      const roller =
        p.detail === 'detailed'
          ? T([
              [(axle + 2 * gap) / 2, -length / 2],
              [rr * 0.7, -length / 2],
              [rr, -length * 0.25],
              [rr, length * 0.25],
              [rr * 0.7, length / 2],
              [(axle + 2 * gap) / 2, length / 2],
            ])
          : C(2 * rr, length, -length / 2);
      add(
        `Free roller ${i + 1}`,
        locate(
          p.detail === 'detailed'
            ? roller
            : cut(roller, C(axle + 2 * gap, length + 2, -length / 2 - 1)),
        ),
        0x363c43,
      );
    }
    add('Hub, roller forks and fixed axles', cut(hub, C(b, w + 2, -1)));
  }
  return finish(out, state);
}
