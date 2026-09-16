import type { Parameters } from '../../../core/types';
import models from './models.json';
import type { Piece } from './assembly';
import { B, C, T, poly, move, union, cut, finish } from './helpers';
import type { Shape } from './shapes';

// M/F always describes metal contacts, not the outer plastic shroud.
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x637585) => out.push({ label, shape, color });
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown AMASS connector model');
  const { width: w, height: h, pitch, contact: c, pins: count } = m;
  const tail = m.cover ? m.length * 0.27 : m.family === 'XT30U' ? 2.5 : 4;
  const L = m.length - tail;
  const female = m.sex === 'F',
    detailed = p.detail === 'detailed',
    gap = 0.15;
  const keyed = (width: number, height: number, depth: number, z: number) => {
    const k = height * 0.3;
    return poly(
      [
        [-width / 2, -height / 2],
        [width / 2 - k, -height / 2],
        [width / 2, -height / 2 + k],
        [width / 2, height / 2 - k],
        [width / 2 - k, height / 2],
        [-width / 2, height / 2],
      ],
      depth,
      z,
    );
  };
  const contact = (x: number, y: number, index: number, front: number) => {
    let metal: Shape;
    if (female) {
      metal = cut(
        C(c * 1.2, front + tail, -tail, x, y),
        C(c + 0.1, front - L * 0.3 + 1, L * 0.3, x, y),
        C(c * 0.72, tail + 0.1, -tail - 0.1, x, y),
      );
      if (detailed) metal = cut(metal, B(0.2, c * 1.5, front * 0.3 + 1, x, y, front * 0.7));
    } else {
      metal = union(
        move(
          T([
            [0, -tail],
            [c * 0.6, -tail],
            [c * 0.6, 0],
            [c / 2, 0.5],
            [c / 2, front - 0.4],
            [c * 0.38, front],
            [0, front],
          ]),
          x,
          y,
        ),
      );
      metal = cut(metal, C(c * 0.72, tail + 0.1, -tail - 0.1, x, y));
      if (detailed) metal = cut(metal, B(0.2, c * 1.3, front * 0.22 + 1, x, y, front * 0.78));
    }
    add(`${female ? 'Female socket' : 'Male pin'} ${index + 1} · solder cup`, metal, 0xc8a65a);
  };
  const profile = (width: number, height: number, depth: number, z: number): Shape =>
    m.family === 'MR60'
      ? union(
          B(width - height, height, depth, 0, 0, z),
          C(height, depth, z, -(width - height) / 2),
          C(height, depth, z, (width - height) / 2),
        )
      : keyed(width, height, depth, z);
  const points = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);
  const shoulder = L * 0.48,
    inset = m.family === 'XT30U' ? 1.2 : 1.8;
  let body: Shape = female
    ? union(profile(w, h, shoulder, 0), profile(w - inset, h - inset, L - shoulder, shoulder))
    : cut(profile(w, h, L, 0), profile(w - inset, h - inset, L - shoulder + 1, shoulder));
  body = cut(body, ...points.map((x) => C(c * 1.2 + gap, L + 2, -1, x)));
  // XT30U female tongue has separate rounded lobes with shallow central relief.
  if (m.family === 'XT30U' && female)
    body = cut(
      body,
      B(0.65, 0.65, L - shoulder + 1, 0, (h - inset) / 2, shoulder),
      B(0.65, 0.65, L - shoulder + 1, 0, -(h - inset) / 2, shoulder),
    );
  if (detailed)
    body = cut(
      body,
      ...[0.12, 0.23, 0.34].flatMap((f) =>
        [-1, 1].map((s) => B(w * 0.65, 0.4, 0.6, 0, (s * h) / 2, L * f)),
      ),
    );
  add(`${m.name} · ${female ? 'keyed socket tongue' : 'pin shroud'}`, body, 0xe5b934);
  points.forEach((x, i) => contact(x, 0, i, L - 0.6));
  if (m.cover) {
    let cover = cut(
      profile(w - 0.1, h - 0.1, tail - 0.15, -tail),
      ...points.map((x) => C(c * 1.2 + 0.5, tail + 1, -tail - 0.1, x)),
    );
    if (detailed)
      cover = cut(
        cover,
        ...[0.25, 0.5, 0.75].flatMap((f) =>
          [-1, 1].map((s) => B(w * 0.65, 0.4, 0.5, 0, (s * h) / 2, -tail * f)),
        ),
      );
    add(`${m.name} · rear cable cover`, cover, m.family === 'XT90H' ? 0xe5b934 : 0x626b76);
  }
  return finish(out, state);
}
