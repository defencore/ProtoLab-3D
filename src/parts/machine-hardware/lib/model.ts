import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, T, poly, move, rotate, union, cut, ring, finish } from './helpers';
import { cylinder, type Shape } from './shapes';

export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x94a2af) => out.push({ label, shape, color });
  const hole = n(p, 'mountHole'),
    gap = 0.2;
  if (p.form === 'hinge') {
    const w = n(p, 'hingeWidth'),
      l = n(p, 'hingeLength'),
      t = n(p, 'leafThickness'),
      pin = n(p, 'pinDiameter');
    const R = pin / 2 + t,
      leaf = w / 2 - R - gap,
      seg = (l - 4 * gap) / 5;
    for (const side of [-1, 1]) {
      let shape: Shape = B(leaf, l, t, side * (R + gap + leaf / 2));
      for (let i = 0; i < 5; i++)
        if ((i % 2 === 0) === side < 0) {
          const y = -l / 2 + i * (seg + gap);
          shape = union(
            shape,
            cylinder(R, seg, [0, y, R], 'y'),
            B(R + gap + 1, seg, t, (side * (R + gap + 1)) / 2, y + seg / 2),
          );
        }
      shape = cut(
        shape,
        cylinder(pin / 2 + 0.1, l + 2, [0, -l / 2 - 1, R], 'y'),
        ...[-1, 1].map((s) => C(hole, t + 2, -1, side * (R + gap + leaf / 2), s * l * 0.3)),
      );
      if (side > 0) shape = move(rotate(move(shape, 0, 0, -R), 0, -n(p, 'hingeAngle')), 0, 0, R);
      add(
        side < 0 ? 'Fixed hinge leaf · three knuckles' : 'Moving hinge leaf · two knuckles',
        shape,
      );
    }
    add('Hinge pin', cylinder(pin / 2, l + 2 * gap, [0, -l / 2 - gap, R], 'y'), 0xc4ccd3);
    for (const side of [-1, 1])
      add(
        side < 0 ? 'Pin head' : 'Pin end retainer',
        cylinder(
          pin * 0.8,
          t * 0.45,
          [0, side < 0 ? -l / 2 - gap - t * 0.45 : l / 2 + gap, R],
          'y',
        ),
        0x63717e,
      );
  } else if (p.form === 'handle') {
    const pitch = n(p, 'handlePitch'),
      w = n(p, 'handleWidth'),
      h = n(p, 'handleHeight'),
      t = n(p, 'handleThickness'),
      f = n(p, 'handleFootLength');
    const x = pitch / 2 + t / 2,
      inner = pitch / 2 - t / 2,
      chamfer = t * 0.6;
    const profile: [number, number][] = [
      [-x, 0],
      [-x, h - chamfer],
      [-x + chamfer, h],
      [x - chamfer, h],
      [x, h - chamfer],
      [x, 0],
      [inner, 0],
      [inner, h - t - chamfer],
      [inner - chamfer, h - t],
      [-inner + chamfer, h - t],
      [-inner, h - t - chamfer],
      [-inner, 0],
    ];
    const bridge = move(rotate(poly(profile, w * 0.7), 90), 0, w * 0.35);
    add(
      'Bridge handle · grip, legs and mounting feet',
      cut(
        union(bridge, ...[-1, 1].map((s) => B(f, w, t * 0.6, (s * pitch) / 2))),
        ...[-1, 1].map((s) => C(hole, t * 1.4, -0.1, (s * pitch) / 2)),
      ),
      0x3c4b59,
    );
  } else if (p.form === 'latch') {
    const L = n(p, 'latchLength'),
      W = n(p, 'latchWidth'),
      d = n(p, 'boltDiameter'),
      t = d * 0.35,
      z = t + d * 0.7;
    const axisHole = (x: number, len: number) => cylinder(d / 2 + gap, len, [x, 0, z], 'x');
    let plate: Shape = union(
      B(L, W, t),
      ...[-0.38, 0.2].map((s) => B(d * 0.7, d * 1.8, d * 1.65, s * L, 0, t)),
    );
    plate = cut(
      plate,
      axisHole(-L, L * 2),
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => C(hole, t + 2, -1, sx * L * 0.35, sy * W * 0.36)),
      ),
    );
    add('Bolt plate · two bored guide saddles', plate);
    const strike = union(
      B(L * 0.24, W, t, L * 0.67),
      B(L * 0.13, d * 1.8, d * 1.65, L * 0.67, 0, t),
    );
    add(
      'Strike plate · bored keeper',
      cut(
        strike,
        axisHole(L * 0.5, L * 0.4),
        ...[-1, 1].map((s) => C(hole, t + 2, -1, L * 0.67, s * W * 0.36)),
      ),
    );
    const travel = n(p, 'latchTravel');
    add(
      'Sliding bolt · operating knob',
      move(
        union(
          cylinder(d / 2, L * 1.18, [-L * 0.48, 0, z], 'x'),
          C(d * 0.4, d * 1.6, z, -L * 0.03),
          C(d * 0.85, d * 0.35, z + d * 1.4, -L * 0.03),
        ),
        -travel,
        0,
        0,
      ),
      0xc6d0d9,
    );
  } else if (p.form === 'foot') {
    const d = n(p, 'footDiameter'),
      h = n(p, 'footHeight'),
      s = n(p, 'stemDiameter'),
      t = n(p, 'padThickness');
    add(
      'Non-slip base pad',
      T([
        [0, 0],
        [d * 0.45, 0],
        [d / 2, t * 0.15],
        [d / 2, t * 0.3],
        [0, t * 0.3],
      ]),
      0x303a42,
    );
    add(
      'Metal foot seat',
      cut(
        T([
          [0, t * 0.3],
          [d * 0.46, t * 0.3],
          [d * 0.46, t * 0.65],
          [d * 0.32, t],
          [0, t],
        ]),
        C(s + 0.2, t, t * 0.45),
      ),
    );
    add('Levelling stem · nominal thread envelope', C(s, h - t * 0.45, t * 0.45), 0xbfcad4);
    const hex = poly(
      Array.from({ length: 6 }, (_, i) => [
        s * Math.cos((i * Math.PI) / 3),
        s * Math.sin((i * Math.PI) / 3),
      ]),
      s * 0.6,
      t + s * 0.4,
    );
    add(
      'Adjustment locknut · smooth bore',
      cut(hex, C(s + 0.2, s * 0.6 + 2, t + s * 0.4 - 1)),
      0x8797a5,
    );
  } else if (p.form === 'cap') {
    const w = n(p, 'capWidth'),
      l = n(p, 'capLength'),
      t = n(p, 'capThickness'),
      dep = n(p, 'capInsertion'),
      wall = n(p, 'capWall');
    const skirt = cut(
      B(w - 0.8, l - 0.8, dep, 0, 0, -dep),
      B(w - 0.8 - 2 * wall, l - 0.8 - 2 * wall, dep + 1, 0, 0, -dep - 1),
    );
    const slots = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        B(
          wall * 1.3,
          wall * 1.3,
          dep * 0.8,
          (sx * (w - 0.8 - wall)) / 2,
          (sy * (l - 0.8 - wall)) / 2,
          -dep - 0.1,
        ),
      ),
    );
    add(
      'Profile end cap · slotted insertion skirt',
      cut(union(B(w, l, t), skirt), ...slots),
      0x394651,
    );
  }
  return finish(out, state);
}
