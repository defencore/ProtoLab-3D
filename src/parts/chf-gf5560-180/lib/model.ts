import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { B, C, cut, union, poly, move, rotate } from './helpers';
import { cylinder, type Shape } from './shapes';
import { gear } from './gears';
export const mounts: [number, number][] = [
  [3.5, 51.5],
  [51.5, 51.5],
  [51.5, 24],
  [12.5, 3.5],
];
const screws: [number, number][] = [
  [3.5, 56.5],
  [51.5, 56.5],
  [51.5, 28.5],
  [5.5, 3.5],
];
const output: [number, number] = [34, 39.5];
const cy = 39.5 + Math.sqrt(23.5 * 23.5 - 23 * 23);
const centres: [number, number][] = [[11, cy - 27], [11, cy - 13.5], [11, cy], output];
const outline: [number, number][] = [
  [0, 0],
  [18.5, 0],
  [18.5, 20.4],
  [55, 20.4],
  [55, 60],
  [0, 60],
];
const inset: [number, number][] = [
  [1.5, 1.5],
  [17, 1.5],
  [17, 21.9],
  [53.5, 21.9],
  [53.5, 58.5],
  [1.5, 58.5],
];
const alu = 0xadb5bf,
  steel = 0x8c97a4,
  brass = 0xc4a05e;
function holes(shape: Shape, d: number, z: number, h: number, positions = mounts): Shape {
  return cut(shape, ...positions.map(([x, y]) => C(d, h, z, x, y)));
}
function screw(x: number, y: number): Shape {
  return cut(
    union(C(2.4, 7.4, 9.4, x, y), C(5.2, 1.7, 16.8, x, y)),
    B(3.4, 0.7, 0.8, x, y, 17.8),
    B(0.7, 3.4, 0.8, x, y, 17.8),
  );
}
/** External dimensions from CHIHAI; gear counts and support geometry are a reference reconstruction. */
export function pieces(p: Parameters, state: string): Piece[] {
  const exploded = state === 'exploded',
    showInternals = p.detail === 'complete' || state !== 'assembled';
  const parts: Piece[] = [];
  const add = (label: string, shape: Shape, color = steel, z = 0) =>
    parts.push({ label, shape, color, z });
  // Reconstructed bosses connect to the floor; all clearance holes continue through the casting.
  let shell = cut(poly(outline, 17), poly(inset, 17, 1.5));
  shell = union(
    shell,
    ...mounts.map(([x, y]) => C(4.6, 17, 0, x, y)),
    ...screws.map(([x, y]) => C(6.2, 17, 0, x, y)),
  );
  shell = holes(holes(shell, 3.6, -1, 20), 2.45, 8.8, 12, screws);
  shell = holes(shell, 5.4, 16.8, 1, screws);
  shell = cut(
    shell,
    C(+p.shaftDiameter + 0.08, 4, -1, ...output),
    C(37.2, 16, 1.5, ...output),
    cylinder(3.2, 5, [16, 10.2, 9.5], 'x'),
  );
  if (state !== 'mechanism') add('L-shaped gearbox casting', shell, alu, exploded ? -24 : 0);
  let cover = holes(poly(outline, 2, 17), 3.6, 16, 4);
  cover = holes(cover, 2.8, 16, 4, screws);
  cover = holes(cover, 5.4, 16.8, 3, screws);
  cover = cut(cover, C(12.1, 4, 16, ...output));
  if (state === 'assembled' || exploded) {
    add('Removable cover plate', cover, 0xc6ccd2, exploded ? 36 : 0);
    for (const [i, [x, y]] of screws.entries())
      add(`Cover screw ${i + 1}`, screw(x, y), steel, exploded ? 41 : 0);
  }
  // Formed 180-size can, clipped to the flat housing thickness. Axial section is reconstructed.
  const motorBody = cut(
    cylinder(10.2, 32, [19, 10.2, 9.5], 'x'),
    B(80, 50, 20, 30, 10, -18.3),
    B(80, 50, 20, 30, 10, 17.3),
  );
  add('180 DC motor · formed metal can', motorBody, 0xbac1c9);
  const cap = cut(
    cylinder(10.1, 4, [51, 10.2, 9.5], 'x'),
    B(80, 50, 20, 30, 10, -18.3),
    B(80, 50, 20, 30, 10, 17.3),
  );
  add('Motor brush end cap', cap, 0x696f78);
  for (const side of [-1, 1]) {
    const lug = cut(
      B(2.1, 2.4, 0.45, 56.05, 10.2 + side * 7.5, 9.5),
      C(0.9, 2, 8.8, 56.05, 10.2 + side * 7.5),
    );
    add(side < 0 ? 'Negative terminal' : 'Positive terminal', lug, brass);
  }
  add('Motor front bearing boss', cylinder(3.1, 2.1, [16.9, 10.2, 9.5], 'x'), steel);
  add('Motor drive shaft · Ø2', cylinder(1, 12.9, [4, 10.2, 9.5], 'x'), steel);
  const shaftTop = C(+p.shaftDiameter, +p.shaftLength, 19, ...output);
  const start = p.shaftProfile === 'full-d' ? 19 : 19 + +p.shaftLength - +p.flatLength;
  const flat = move(
    rotate(
      B(20, 20, 60, 0, +p.flatThickness - +p.shaftDiameter / 2 + 10, start),
      0,
      0,
      +p.shaftAngle,
    ),
    ...output,
  );
  // Shaft terminates at the requested projection and does not pass through the motor-side cavity.
  const shaft = cut(union(C(+p.shaftDiameter, 17.5, 1.5, ...output), shaftTop), flat);
  add('Output D-shaft', shaft, 0xc0c7d0);
  const bearing = cut(C(12, 3, 17, ...output), C(+p.shaftDiameter + 0.05, 5, 16, ...output));
  add('Output sleeve bearing · Ø12 boss', bearing, brass, exploded ? 30 : 0);
  if (!showInternals) return parts;
  // Four-stage layout: worm -> compound wheel A -> compound B -> compound C -> output gear.
  // Reference spur pairs share module 0.5 and exact pitch centre distances.
  const wormRaw: Shape = move(
    rotate({ kind: 'worm', root: 1.6, tip: 3.2, pitch: Math.PI * 0.5, height: 10 }, 0, 90, 0),
    5,
    10.2,
    9.5,
  );
  const worm = cut(wormRaw, cylinder(1.04, 12, [4, 10.2, 9.5], 'x'));
  add('Brass helical worm · reconstructed', worm, brass);
  const gears = [
    { wheel: 18, pinion: 22, wz: 8, wHeight: 3, pz: 4.5, pHeight: 2.5 },
    { wheel: 32, pinion: 24, wz: 4.5, wHeight: 2.5, pz: 8, pHeight: 2.5 },
    { wheel: 30, pinion: 22, wz: 8, wHeight: 2.5, pz: 12, pHeight: 2.5 },
  ];
  // Phase each involute spur pair about the centre line so tooth tips enter the opposing spaces.
  const angles = [0, 90 + 180 / 32, 90 + 180 / 30];
  const finalLine =
    (Math.atan2(output[1] - centres[2][1], output[0] - centres[2][0]) * 180) / Math.PI;
  const pinionC = finalLine;
  for (let i = 0; i < 3; i++) {
    const g = gears[i],
      [x, y] = centres[i];
    const phaseWheel = angles[i];
    const phasePinion = i === 2 ? pinionC : 90;
    let compound = union(
      rotate(gear(0.5, g.wheel, 2.1, g.wHeight, g.wz), 0, 0, phaseWheel),
      rotate(gear(0.5, g.pinion, 2.1, g.pHeight, g.pz), 0, 0, phasePinion),
      cut(
        C(
          5,
          Math.max(g.wz + g.wHeight, g.pz + g.pHeight) - Math.min(g.wz, g.pz),
          Math.min(g.wz, g.pz),
        ),
        C(2.1, 20, 0),
      ),
    );
    compound = move(compound, x, y);
    if (i === 0) compound = cut(compound, wormRaw); // Reference contact pocket, not a production hobbed wheel.
    add(
      `Compound gear ${String.fromCharCode(65 + i)} · reference tooth counts`,
      compound,
      i === 0 ? 0xd3d7d9 : steel,
      exploded ? 8 * (i + 1) : 0,
    );
    add(`Gear ${String.fromCharCode(65 + i)} journal pin`, C(2, 15.5, 1.5, x, y), steel);
    add(
      `Gear ${String.fromCharCode(65 + i)} lower spacer`,
      cut(C(4.5, i === 2 ? 6.2 : 2.7, 1.6, x, y), C(2.05, 8, 1, x, y)),
      brass,
    );
  }
  const outputGear = move(
    rotate(gear(0.5, 72, +p.shaftDiameter + 0.04, 2.5, 12), 0, 0, finalLine + 180 + 180 / 72),
    ...output,
  );
  add('Output spur gear · reference tooth count', outputGear, steel, exploded ? 32 : 0);
  return parts;
}
