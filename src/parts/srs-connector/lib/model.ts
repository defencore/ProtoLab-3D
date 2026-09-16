import type { Parameters } from '../../../core/types';
import models from './models.json';
import { box, cylinder, prism, roundedRect, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';
import { rightAngleLatch, straightLatch, sqxwCPA, ca281aCPA, ca282bCPA } from './latches';
import { teAkiiPieces } from './te-akii';

// Coordinates: X = contact spacing, Y = harness length, Z = right-angle mating axis.
// Published envelopes are fixed; undimensioned mold/contact details are reconstructions.
function plate(w: number, l: number, r: number, y: number, z: number, depth: number): Shape {
  const s = roundedRect(w, l, r, z, depth);
  if (s.kind !== 'prism') throw new Error('Expected plate profile');
  return prism(
    s.points.map(([x, py]) => [x, py + y]),
    depth,
    z,
  );
}
function tube(
  radius: number,
  bore: number,
  length: number,
  x: number,
  y: number,
  z: number,
  axis: 'y' | 'z',
): Shape {
  return subtract(
    cylinder(radius, length, [x, y, z], axis),
    cylinder(
      bore,
      length + 0.2,
      [x, y - (axis === 'y' ? 0.1 : 0), z - (axis === 'z' ? 0.1 : 0)],
      axis,
    ),
  );
}
const gold = 0xc3a468,
  yellow = 0xe7bd34,
  orange = 0xeb7d29;
export function pieces(p: Parameters, state: string): Piece[] {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown SRS connector');
  if (m.family === 'te-akii') return teAkiiPieces(m, p, state);
  const exploded = state === 'exploded';
  const result: Piece[] = [];
  const add = (shape: Shape, label: string, color: number, offset = 0) => {
    result.push({ shape, label, color, z: exploded ? offset : 0 });
  };
  const leadLength = Number(p.leadLength),
    wireR = Number(p.wireDiameter) / 2;
  if (m.family === 'ca282b') {
    // Drawing datums: body Y=-17.5..0, nozzle Y=0..6.7, axis Z=8.3,
    // body top Z=12.3, CPA top Z=16.3. Overall X=14.9.
    const contacts = [-2, 2].map((x) => tube(0.95, 0.58, 7.2, x, -1.1, 8.3, 'y'));
    const sockets = [-2, 2].map((x) => cylinder(1.12, 8, [x, -1.2, 8.3], 'y'));
    const cpa = ca282bCPA();
    const cover = subtract(
      plate(14.9, 17.5, 0.7, -8.75, 0, 1),
      ...[-2, 2].map((x) => box([1.8, 1.5, 2], [x - 0.9, -17.6, -0.5])),
    );
    const dimples: Shape[] = [];
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 5; col++)
          dimples.push(
            cylinder(
              0.42,
              0.65,
              [side < 0 ? -7.65 : 7.05, -15 + col * 1.65, 3.0 + row * 1.65],
              'x',
            ),
          );
    const shell = subtract(
      union(plate(14.9, 17.5, 0.7, -8.75, 1.05, 11.25), cylinder(4.4, 6.7, [0, 0, 8.3], 'y')),
      box([10.8, 14.6, 8.2], [-5.4, -16.3, 1]),
      ...sockets,
      ...dimples,
      box([2.4, 7.0, 1.2], [-1.2, -0.1, 11.65]),
      ...[-2, 2].map((x) => cylinder(0.87, 3, [x, -18, 5.0], 'y')),
      cpa,
    );
    add(shell, 'CA282B housing and keyed nozzle', m.color);
    add(cover, 'Rear housing cover', m.color, -7);
    add(cpa, 'CPA inspection lever', yellow, 9);
    for (const side of [-1, 1]) {
      result[0].shape = union(result[0].shape, straightLatch(side));
    }
    contacts.forEach((s, i) => add(s, `Socket contact ${i + 1} (interior simplified)`, gold, 17));
    if (leadLength > 0)
      [-2, 2].forEach((x, i) =>
        add(
          cylinder(wireR, leadLength, [x, -17.5 - leadLength, 5], 'y'),
          `Illustrative lead ${i + 1}`,
          i ? 0x3b4148 : 0xa44737,
        ),
      );
    return result;
  }

  const jst = m.family === 'sqxw';
  const rear = jst ? -20.55 : -22.3;
  const front = jst ? 5.5 : 5.2;
  const bodyTop = jst ? 5.4 : 6.5;
  const top = jst ? 10.55 : 13.2;
  const wireZ = jst ? 2.4 : 3.25;
  const coverZ = jst ? -1.2 : 0;
  const coverT = jst ? 1.1 : 1.0;
  const shellBottom = jst ? 0 : 1.05;
  const width = jst ? 13 : 11.6;

  const contactTop = top - (jst ? 0.2 : 0.25);
  const contacts = [-2, 2].map((x) =>
    union(
      tube(0.95, 0.58, 5.9, x, 0, contactTop - 5.9, 'z'),
      box([1.2, 0.8, contactTop - 5.9 - wireZ + 0.6], [x - 0.6, -0.4, wireZ - 0.4]),
      box([1.6, 8.2, 0.65], [x - 0.8, -8, wireZ - 0.35]),
      tube(0.95, 0.75, 2.5, x, jst ? -9.05 : -9, wireZ, 'y'),
    ),
  );
  const cpa = jst ? sqxwCPA() : ca281aCPA();
  const ferrite = jst
    ? subtract(
        plate(8.4, 8, 0.5, -13, 0.2, 4.4),
        ...[-2, 2].map((x) => cylinder(1.05, 8.2, [x, -17.1, 2.4], 'y')),
      )
    : undefined;
  const cover = subtract(
    union(
      plate(width, front - rear, 0.8, (front + rear) / 2, coverZ, coverT),
      // Integral edge rails and rear wire comb.
      ...[-1, 1].map((side) =>
        box(
          [0.65, front - rear - (jst ? 3.2 : 1.2), jst ? 6 : 4.8],
          [side < 0 ? -width / 2 : width / 2 - 0.65, rear + 0.6, coverZ],
        ),
      ),
      box([width - 1.0, 0.8, 3.5], [-width / 2 + 0.5, rear + 0.2, coverZ]),
    ),
    cpa,
    ...[-2, 2].map((x) => cylinder(0.88, 2, [x, rear - 0.4, wireZ], 'y')),
    // Two molded rear slots / latch windows.
    ...[-1, 1].map((s) => box([1.1, 2, 1.5], [s * 4.5 - 0.55, rear + 2, coverZ - 0.1])),
  );
  const topGrooves = [-1, 1].map((s) =>
    box([0.5, 6.5, 0.45], [s * 2.0 - 0.25, rear + 3, bodyTop - 0.35]),
  );
  const keyCuts: Shape[] = [];
  // Distinct silhouettes from JST's keying figures. No mating tolerances are inferred.
  if (jst) {
    const keyX = m.key === 'I' ? 0 : m.key === 'II' ? -1.25 : 1.25;
    keyCuts.push(
      box(
        [m.key === 'I' ? 0.85 : 1.6, 2.1, 2.0],
        [keyX - (m.key === 'I' ? 0.425 : 0.8), 2.3, top - 1.8],
      ),
    );
    keyCuts.push(box([2.3, 1.1, 1.6], [-1.15, -4.5, top - 1.4]));
  } else keyCuts.push(box([1.4, 2.0, 1.6], [-0.7, 2.8, top - 1.4]));
  let housing = subtract(
    union(
      plate(width, front - rear, 0.8, (front + rear) / 2, shellBottom, bodyTop - shellBottom),
      // Recessed circular guard surrounds the raised two-socket contact island.
      subtract(
        cylinder(jst ? 4.9 : 4.45, top - bodyTop, [0, 0, bodyTop]),
        cylinder(jst ? 4.25 : 3.8, 1.7, [0, 0, top - 1.5]),
      ),
      plate(7.3, 3.4, 1.6, 0, bodyTop, top - bodyTop),
      // Shoulder at the base of the nozzle.
      cylinder(jst ? 5.4 : 5.0, 1.0, [0, 0, bodyTop - 0.2]),
    ),
    box([8.8, 15, bodyTop - shellBottom - 0.4], [-4.4, rear + 1.1, shellBottom - 0.1]),
    ...[-2, 2].map((x) => cylinder(1.08, top + 1, [x, 0, -0.3])),
    ...[-2, 2].map((x) => cylinder(0.88, 3, [x, rear - 0.5, wireZ], 'y')),
    ...contacts,
    cpa,
    cover,
    ...(ferrite ? [ferrite] : []),
    ...topGrooves,
    // Shallow U-shaped cover-latch outline visible in the catalog plan view.
    box([0.45, 3.2, 0.7], [-1.9, rear + 7.5, bodyTop - 0.55]),
    box([0.45, 3.2, 0.7], [1.45, rear + 7.5, bodyTop - 0.55]),
    box([3.8, 0.45, 0.7], [-1.9, rear + 7.5, bodyTop - 0.55]),
    ...keyCuts,
    // Molding windows adjacent to the two flexible locking arms.
    ...[-1, 1].map((s) => box([0.85, 2.1, 2.0], [s * 4.7 - 0.425, 2.3, bodyTop - 0.2])),
  );
  for (const side of [-1, 1]) {
    housing = subtract(union(housing, rightAngleLatch(jst ? 'sqxw' : 'ca281a', side)), cover, cpa);
  }
  add(
    housing,
    `${jst ? 'SQXR female housing · key ' + m.key : 'CA281A housing'} and nozzle`,
    m.color,
  );
  add(cover, jst ? 'SQXL cover housing' : 'Cover and wire comb', yellow, -9);
  add(cpa, jst ? 'SQXC CPA · orange' : 'Push-button CPA', jst ? orange : 0xb15038, -23);
  contacts.forEach((s, i) =>
    add(s, `Socket contact ${i + 1}${jst ? ' · SSQSK ' + (i ? 'L' : 'R') : ''}`, gold, 12),
  );
  if (ferrite) add(ferrite, 'SQXF monoblock ferrite', 0x565a5e, 23);
  if (leadLength > 0)
    [-2, 2].forEach((x, i) =>
      add(
        cylinder(wireR, leadLength, [x, rear - leadLength, wireZ], 'y'),
        `Illustrative lead ${i + 1}`,
        i ? 0x3b4148 : 0xa44737,
      ),
    );
  return result;
}
