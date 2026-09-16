import type { Parameters } from '../../../core/types';
import { box, cylinder, roundedRect, prism, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';

/** Dimensioned envelope with illustrative exterior details; not a mating drawing. */
export function teAkiiPieces(
  m: { width: number; length: number; housingDepth: number; circuits: number; color: number },
  p: Parameters,
  state: string,
): Piece[] {
  const { width: w, length: l, housingDepth: h, circuits: n } = m;
  const front = w / 2,
    rear = front - l,
    center = (front + rear) / 2;
  const plate = (
    width: number,
    length: number,
    r: number,
    y: number,
    z: number,
    t: number,
  ): Shape => {
    const s = roundedRect(width, length, r, z, t);
    if (s.kind !== 'prism') throw new Error('Expected rounded plate');
    return prism(
      s.points.map(([x, v]) => [x, v + y]),
      t,
      z,
    );
  };
  const locations =
    n === 2
      ? [
          [-2, 0],
          [2, 0],
        ]
      : [
          [-2, -1],
          [2, -1],
          [0, 2],
        ];
  const wires = n === 2 ? [-2, 2] : [-3, 0, 3];
  const cover = subtract(
    plate(w, l, 1.2, center, 1.25, 0.9),
    ...[-1, 1].map((s) => box([1, 3, 2], [s * (w / 2 - 1.4) - 0.5, 1, 1])),
    ...[-1, 1].map((s) => box([0.45, 5, 2], [s * 2 - 0.225, rear + 3, 1])),
  );
  const cpa = union(
    plate(6.4, 7, 1.2, 0, 0, 1.15),
    ...[-1, 1].map((s) => box([0.6, 5, 0.35], [s * 2 - 0.3, -2.5, 0.95])),
  );
  const holes = locations.map(([x, y]) => cylinder(1.05, h + 1, [x, y, 2]));
  const nozzle = subtract(cylinder(4.7, h - 7.5, [0, 0, 7.5]), cylinder(4.0, 1.2, [0, 0, h - 1]));
  const island = plate(n === 2 ? 7 : 7.4, n === 2 ? 3 : 6, 1.2, 0, 7.5, h - 7.7);
  const hooks: Shape[] = [];
  for (const s of [-1, 1]) {
    const outline: [number, number][] = [
      [s * 5.0, 7.4],
      [s * 5.7, 7.4],
      [s * 5.7, h - 2.8],
      [s * 6.1, h - 2.8],
      [s * 6.1, h - 2.1],
      [s * 5.0, h - 2.1],
    ];
    hooks.push(prism(outline, 2.2, -1.1, 'y'));
  }
  const housing = subtract(
    union(plate(w, l, 1.2, center, 2.2, 5.6), nozzle, island, ...hooks),
    box([w - 2, l - 2, 3.5], [-w / 2 + 1, rear + 1, 2.15]),
    ...holes,
    ...wires.map((x) => cylinder(0.9, 2.2, [x, rear - 0.1, 4.5], 'y')),
    // Shallow mold ribs/cover latch outline from the brochure plan view.
    ...[-1, 1].map((s) => box([0.45, 4, 0.5], [s * 2 - 0.225, rear + 3.2, 7.45])),
  );
  const parts: Piece[] = [];
  const add = (shape: Shape, label: string, color: number, offset = 0) =>
    parts.push({ shape, label, color, z: state === 'exploded' ? offset : 0 });
  add(housing, 'AK II housing', m.color);
  add(subtract(cover, cpa), 'Housing cover', 0xe9c53b, -8);
  add(cpa, 'CPA lock', 0xd77a29, -17);
  locations.forEach(([x, y], i) =>
    add(
      subtract(cylinder(0.85, 4.8, [x, y, h - 5.2]), cylinder(0.5, 5, [x, y, h - 5.3])),
      `Socket contact ${i + 1}`,
      0xc3a468,
      10,
    ),
  );
  if (Number(p.leadLength) > 0)
    wires.forEach((x, i) =>
      add(
        cylinder(
          Number(p.wireDiameter) / 2,
          Number(p.leadLength),
          [x, rear - Number(p.leadLength), 4.5],
          'y',
        ),
        `Illustrative lead ${i + 1}`,
        [0x42474e, 0xb76555, 0xc9b879][i],
      ),
    );
  return parts;
}
