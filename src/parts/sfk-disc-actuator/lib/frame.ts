import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { laserPlates, laserPlateShape } from './laser-plates';
import { discAxisHeight, driveOffsetZ, nutPinOffset, screwAxisHeight } from './drive-layout';

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
const axial = (diameter: number, from: number, to: number, y = 0, z = discAxisHeight): Shape =>
  cylinder(diameter / 2, to - from, [from, y, z], 'x');
const flangeAngles = [60, 120, 240, 300];
const mainDiscIds = new Set(['motor-disc', 'fixed-disc', 'end-disc']);

export function frameFasteners(nutCenter: number): FrameFastener[] {
  const result: FrameFastener[] = [];
  for (const offset of [-5.25, 5.25])
    result.push({
      kind: 'bolt',
      id: `motor-front-M2-${offset}`,
      diameter: 2,
      length: 6,
      underHead: [-68.1, 0, screwAxisHeight + offset],
      direction: [-1, 0, 0],
      head: 'button',
    });
  for (const angle of flangeAngles) {
    const a = (angle * Math.PI) / 180;
    result.push({
      kind: 'bolt',
      id: `nut-flange-${angle}`,
      diameter: 3,
      length: 8,
      underHead: [nutCenter - 13, 11.5 * Math.cos(a), screwAxisHeight + 11.5 * Math.sin(a)],
      direction: [1, 0, 0],
      head: 'button',
    });
  }
  return result;
}

/** Three principal discs use the same profiles as the laser cutting files. */
export function framePieces(nutCenter: number): FramePiece[] {
  const pieces: FramePiece[] = laserPlates
    .filter((plate) => mainDiscIds.has(plate.id))
    .map((plate) => ({
      id: plate.id,
      label: plate.label,
      color: 0xb6bec6,
      shape: laserPlateShape(plate),
    }));
  const flangeTaps: Shape[] = flangeAngles.map((angle) => {
    const a = (angle * Math.PI) / 180;
    return {
      kind: 'cylinder',
      radius: 1.5,
      height: 4.5,
      origin: [nutCenter - 9, 11.5 * Math.cos(a), discAxisHeight + 11.5 * Math.sin(a)],
      axis: 'x',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
    };
  });
  const collar: Shape = {
    kind: 'intersect',
    children: [
      axial(29, nutCenter - 9, nutCenter - 4),
      box([5, 20, 29], [nutCenter - 9, -10, discAxisHeight - 14.5]),
    ],
  };
  const coverBlocks: Shape[] = [collar, axial(18, nutCenter - 4, nutCenter + 8.5)];
  for (const positive of [false, true]) {
    coverBlocks.push(
      box([12.5, 2, 8], [nutCenter - 4, positive ? 8 : -10, discAxisHeight - 4]),
      cylinder(2, 3.2, [nutCenter + nutPinOffset, positive ? 10 : -13.2, discAxisHeight], 'y'),
    );
  }
  pieces.push({
    id: 'nut-yoke',
    label: 'Flange-following ball-nut cover · tapped collar and integral Ø4 side pins',
    color: 0xc7a448,
    shape: {
      kind: 'transform',
      child: subtract(
        union(...coverBlocks),
        axial(16.6, nutCenter - 9.1, nutCenter + 8.6),
        ...flangeTaps,
      ),
      translation: [0, 0, driveOffsetZ],
      rotation: [0, 0, 0],
    },
  });
  return pieces;
}
