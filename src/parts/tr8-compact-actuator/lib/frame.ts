import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { laserPlates, laserPlateShape } from './laser-plates';
import { motorDiscX, screwAxisHeight } from './drive-layout';

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
const axial = (diameter: number, from: number, to: number, y = 0): Shape =>
  cylinder(diameter / 2, to - from, [from, y, screwAxisHeight], 'x');
const mainDiscs = new Set(['motor-disc', 'fixed-disc', 'end-disc']);

export function frameFasteners(nutCenter: number): FrameFastener[] {
  return [
    ...[-5.25, 5.25].map((offset): FrameFastener => ({
      kind: 'bolt',
      id: `motor-front-M2-${offset}`,
      diameter: 2,
      length: 5,
      underHead: [motorDiscX + 3, 0, screwAxisHeight + offset],
      direction: [-1, 0, 0],
      head: 'button',
    })),
    ...[-8, 8].map((y): FrameFastener => ({
      kind: 'bolt',
      id: `nut-flange-${y < 0 ? 'negative' : 'positive'}`,
      diameter: 3,
      length: 8,
      underHead: [nutCenter - 6, y, screwAxisHeight],
      direction: [1, 0, 0],
      head: 'button',
    })),
  ];
}

/** The H flange stays fixed to this cover by two screws through its stock clearance holes. */
export function nutCoverShape(nutCenter: number): Shape {
  const start = nutCenter - 2.5;
  const collar: Shape = {
    kind: 'intersect',
    children: [axial(22, start, start + 5), box([5, 22, 11], [start, -11, screwAxisHeight - 5.5])],
  };
  const blocks: Shape[] = [collar, axial(13, start, nutCenter + 7.5)];
  for (const positive of [false, true]) {
    blocks.push(
      box([10, 5, 8], [start, positive ? 6 : -11, screwAxisHeight - 4]),
      cylinder(2, 3.2, [nutCenter, positive ? 11 : -14.2, screwAxisHeight], 'y'),
    );
  }
  const taps: Shape[] = [-8, 8].map((y) => ({
    kind: 'cylinder',
    radius: 1.5,
    height: 4.7,
    origin: [start, y, screwAxisHeight],
    axis: 'x',
    thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
  }));
  return subtract(union(...blocks), axial(10.2, start - 0.1, nutCenter + 7.6), ...taps);
}

export function framePieces(nutCenter: number): FramePiece[] {
  return [
    ...laserPlates
      .filter((plate) => mainDiscs.has(plate.id))
      .map((plate) => ({
        id: plate.id,
        label: plate.label,
        color: 0xb6bec6,
        shape: laserPlateShape(plate),
      })),
    {
      id: 'nut-yoke',
      label: 'H-flange-following TR8 nut cover · two blind M3 taps and integral Ø4 pins',
      color: 0xc7a448,
      shape: nutCoverShape(nutCenter),
    },
  ];
}
