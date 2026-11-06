import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';

export interface FramePiece {
  id: string;
  label: string;
  color: number;
  shape: Shape;
}
export interface FrameFastener {
  kind: 'bolt';
  id: string;
  diameter: number;
  head?: 'button' | 'socket-cap';
  length: number;
  underHead: Vec;
  direction: Vec;
}
const colors = {
  base: 0x465565,
  housing: 0x697d90,
  plate: 0x8da1b3,
  yoke: 0xc7a448,
};
const axial = (diameter: number, from: number, to: number, y = 0, z = 28): Shape =>
  cylinder(diameter / 2, to - from, [from, y, z], 'x');
const vertical = (diameter: number, from: number, to: number, x: number, y: number): Shape =>
  cylinder(diameter / 2, to - from, [x, y, from]);
const tappedVerticalHole = (x: number, y: number, from: number, to: number): Shape => ({
  kind: 'cylinder',
  radius: 1.5,
  height: to - from,
  origin: [x, y, from],
  axis: 'z',
  thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
});
const floatingFootXs = [36, 51];
const flangeAngles = [60, 120, 240, 300];

export function frameFasteners(nutCenter: number): FrameFastener[] {
  const result: FrameFastener[] = [];
  const bolt = (
    id: string,
    diameter: number,
    length: number,
    underHead: Vec,
    direction: Vec,
    head: 'button' | 'socket-cap' = 'socket-cap',
  ) => result.push({ kind: 'bolt', id, diameter, length, underHead, direction, head });
  for (const x of floatingFootXs) bolt(`floating-base-${x}-0`, 3, 8, [x, 0, 9], [0, 0, -1]);
  for (const x of [-115, -109])
    for (const y of [-11, 11]) bolt(`motor-rear-clamp-${x}-${y}`, 3, 12, [x, y, 37], [0, 0, -1]);
  for (const offset of [-5.25, 5.25])
    bolt(`motor-front-M2-${offset}`, 2, 4, [-68, 0, 28 + offset], [-1, 0, 0]);
  for (const angle of flangeAngles) {
    const a = (angle * Math.PI) / 180;
    bolt(
      `nut-flange-${angle}`,
      3,
      8,
      [nutCenter - 13, 11.5 * Math.cos(a), 28 + 11.5 * Math.sin(a)],
      [1, 0, 0],
      'button',
    );
  }
  return result;
}

export function framePieces(nutCenter: number): FramePiece[] {
  const pieces: FramePiece[] = [];
  const add = (id: string, label: string, color: number, shape: Shape) =>
    pieces.push({ id, label, color, shape });
  const baseBlocks: Shape[] = [box([192, 56, 6], [-135, -28, 0])];
  const baseCuts: Shape[] = [];
  for (const x of [5, 34]) for (const y of [-17, 17]) baseCuts.push(tappedVerticalHole(x, y, 0, 6));
  for (const x of floatingFootXs) baseCuts.push(tappedVerticalHole(x, 0, 0, 6));
  for (const x of [-128, 45])
    for (const y of [-23.5, 23.5]) baseCuts.push(vertical(4.5, -0.1, 6.1, x, y));

  for (const fixed of [true, false]) {
    const low = fixed ? -15.9 : 41,
      high = fixed ? -12 : 44.9;
    const blocks: Shape[] = [
      box([high - low, 18, fixed ? 22.01 : 22], [low, -9, fixed ? 5.99 : 6]),
      axial(18, low, high),
    ];
    // The flange remains outside the straight body bore. Opposed bearing
    // flanges and the retained inner-race shaft stack provide axial capture.
    const holes: Shape[] = [axial(13.02, low - 0.1, high + 0.1)];
    if (fixed) {
      baseBlocks.push(...blocks);
      baseCuts.push(...holes);
    } else {
      blocks.push(box([22, 18, 3], [33, -9, 6]));
      for (const x of floatingFootXs) holes.push(vertical(3.4, 5.9, 9.1, x, 0));
      add(
        'floating-bearing-housing',
        'Compact removable screw bearing seat · straight Ø13.02 bore and two-screw foot',
        colors.housing,
        subtract(union(...blocks), ...holes),
      );
    }
  }

  baseBlocks.push(
    box([2, 26, 35.01], [-70, -13, 5.99]),
    box([12, 26, 3.01], [-80, -13, 5.99]),
    box([12, 28, 23.81], [-118, -14, 5.99]),
  );
  baseCuts.push(
    axial(6.4, -70.1, -67.9),
    ...[-5.25, 5.25].map((offset) => axial(2.2, -70.1, -67.9, 0, 28 + offset)),
    axial(16.2, -118.1, -105.9),
    ...[-115, -109].flatMap((x) => [-11, 11].map((y) => tappedVerticalHole(x, y, 25, 29.8))),
  );
  pieces.unshift({
    id: 'base',
    label: 'One-piece fixed base · integral motor mounts and compact screw bearing seat',
    color: colors.base,
    shape: subtract(union(...baseBlocks), ...baseCuts),
  });

  const flangeTaps: Shape[] = flangeAngles.map((angle) => {
    const a = (angle * Math.PI) / 180;
    return {
      kind: 'cylinder',
      radius: 1.5,
      height: 4.5,
      origin: [nutCenter - 9, 11.5 * Math.cos(a), 28 + 11.5 * Math.sin(a)],
      axis: 'x',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
    };
  });
  const collar: Shape = {
    kind: 'intersect',
    children: [
      axial(29, nutCenter - 9, nutCenter - 4),
      box([5, 20, 29], [nutCenter - 9, -10, 13.5]),
    ],
  };
  const coverBlocks: Shape[] = [collar, axial(18, nutCenter - 4, nutCenter + 8.5)];
  for (const positive of [false, true]) {
    coverBlocks.push(
      box([12.5, 2, 8], [nutCenter - 4, positive ? 8 : -10, 24]),
      cylinder(2, 3.2, [nutCenter + 5, positive ? 10 : -13.2, 28], 'y'),
    );
  }
  add(
    'nut-yoke',
    'Flange-following ball-nut cover · tapped collar and integral Ø4 side pins',
    colors.yoke,
    subtract(union(...coverBlocks), axial(16.6, nutCenter - 9.1, nutCenter + 8.6), ...flangeTaps),
  );
  add(
    'motor-rear-cap',
    'Motor rear clamp cap · Ø16.2 seat · free clamp gap 0.4',
    colors.plate,
    subtract(
      box([12, 28, 8.8], [-118, -14, 30.2]),
      axial(16.2, -118.1, -105.9),
      ...[-115, -109].flatMap((x) => [-11, 11].map((y) => vertical(3.4, 30.1, 39.1, x, y))),
      ...[-115, -109].flatMap((x) => [-11, 11].map((y) => vertical(5.8, 37, 39.1, x, y))),
    ),
  );
  return pieces;
}
