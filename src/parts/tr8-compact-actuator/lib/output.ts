import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { laserPlates, laserPlateShape } from './laser-plates';
import { crankRadius, outputAxisHeight, outputAxisX, outputBearingCentres } from './drive-layout';

export type OutputPiece = { id: string; label: string; color: number; shape: Shape };
export interface OutputBolt {
  id: string;
  diameter: number;
  length: number;
  underHead: Vec;
  direction: Vec;
  head?: 'button' | 'socket-cap';
}

export const outputLayout = {
  pivot: [outputAxisX, 0, outputAxisHeight] as Vec,
  radius: crankRadius,
  shaftDiameter: 6,
  shaftNegativeEnd: -27,
  shaftPositiveEnd: 32,
  bearingCenters: [...outputBearingCentres],
  innerClipCenters: [-16.8, 16.8],
  outerClipCenters: [-23.7, 23.7],
  slotWidth: 4.1,
  /** Centreline limits of the two rounded closed-slot ends. */
  slotRoot: 9.7,
  slotTip: 10.95,
  armTip: 15.45,
  armPlanes: [
    [-14.05, -11.05],
    [11.05, 14.05],
  ],
  clampBolt: { z: -4.2, left: -6, right: 6, diameter: 2, length: 16 },
};
const steel = 0xaeb8c0;
const housingColor = 0x566f82;
const leverColor = 0x759bb3;
const axisCylinder = (radius: number, from: number, to: number, x = 0, z = 0): Shape =>
  cylinder(radius, to - from, [x, from, z], 'y');
const annulus = (outer: number, inner: number, from: number, to: number): Shape =>
  subtract(axisCylinder(outer, from, to), axisCylinder(inner, from - 0.1, to + 0.1));
const placed = (shape: Shape, angle = 0): Shape => ({
  kind: 'transform',
  child: shape,
  translation: outputLayout.pivot,
  rotation: [0, angle, 0],
});
/** Mirror complete threaded solids by a proper rotation, preserving their handedness. */
const negativeY = (shape: Shape): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [0, 0, 0],
  rotation: [0, 0, 180],
});

function shaft(): Shape {
  const capThread: Shape = {
    kind: 'cylinder',
    radius: 3,
    height: 2.7,
    origin: [0, 24.3, 0],
    axis: 'y',
    thread: { pitch: 0.75 },
  };
  return subtract(
    axisCylinder(3, outputLayout.shaftNegativeEnd, outputLayout.shaftPositiveEnd),
    // Cut the helical grooves from continuous stock; no coincident thread/end-face fuse.
    subtract(axisCylinder(3.1, -27, -24.3), negativeY(capThread)),
    annulus(3.1, 2.85, -24.1, -23.3),
    annulus(3.1, 2.85, 23.3, 24.1),
    annulus(3.1, 2.85, -17.2, -16.4),
    annulus(3.1, 2.85, 16.4, 17.2),
    box([8, 6.4, 4], [-4, 25.8, 2.5]),
  );
}

function crank(positive: boolean): Shape {
  const hubLow = positive ? 11.05 : -15.85;
  const armLow = positive ? 11.05 : -14.05;
  const hub = union(
    axisCylinder(6, hubLow, hubLow + 4.8),
    // Parallel faces provide full seats for the clamp washers.
    box([12, 4.8, 5.2], [-6, hubLow, -6.8]),
  );
  const arm = union(
    box([9, 3, outputLayout.slotTip - 3], [-4.5, armLow, 3]),
    axisCylinder(4.5, armLow, armLow + 3, 0, outputLayout.slotTip),
  );
  const closedSlot = union(
    axisCylinder(outputLayout.slotWidth / 2, armLow - 0.1, armLow + 3.1, 0, outputLayout.slotRoot),
    axisCylinder(outputLayout.slotWidth / 2, armLow - 0.1, armLow + 3.1, 0, outputLayout.slotTip),
    box(
      [outputLayout.slotWidth, 3.2, outputLayout.slotTip - outputLayout.slotRoot],
      [-outputLayout.slotWidth / 2, armLow - 0.1, outputLayout.slotRoot],
    ),
  );
  return subtract(
    union(hub, arm),
    axisCylinder(3.025, hubLow - 0.2, hubLow + 5),
    box([0.5, 5.2, 4.2], [-0.25, hubLow - 0.2, -6.9]),
    cylinder(1.1, 12.4, [-6.2, hubLow + 2.4, -4.2], 'x'),
    closedSlot,
  );
}

function endCap(): Shape {
  const thread: Shape = {
    kind: 'cylinder',
    radius: 3,
    height: 3.1,
    origin: [0, 24.3, 0],
    axis: 'y',
    thread: { pitch: 0.75, internal: true, radialClearance: 0.05 },
  };
  return negativeY(
    subtract(axisCylinder(4.75, 24.3, 28.2), thread, box([6, 0.4, 1], [-3, 27.9, -0.5])),
  );
}

/** Removable clips leave a plain shaft end through which both clamp hubs can slide. */
export function outputPieces(angle: number): OutputPiece[] {
  const pieces: OutputPiece[] = [
    {
      id: 'output-shaft',
      label: 'Output shaft · Ø6 · four DIN 471 retainers, D-flat and M6×0.75 cap thread',
      color: steel,
      shape: placed(shaft(), angle),
    },
    {
      id: 'output-end-cap',
      label: 'Negative output shaft blind cap · Ø9.5 · internal M6×0.75 and shallow driver',
      color: steel,
      shape: placed(endCap(), angle),
    },
  ];
  for (const positive of [false, true]) {
    const side = positive ? 'rear' : 'front';
    pieces.push(
      {
        id: `output-${side}-inner-spacer`,
        label: `${positive ? 'Positive' : 'Negative'} output inner retaining-ring thrust spacer`,
        color: steel,
        shape: placed(annulus(3.9, 3.025, positive ? 17.2 : -17.5, positive ? 17.5 : -17.2)),
      },
      {
        id: `output-${side}-cheek`,
        label: `${positive ? 'Positive' : 'Negative'} output bearing cheek · 4 mm tabbed laser plate`,
        color: housingColor,
        shape: laserPlateShape(laserPlates.find((plate) => plate.id === `output-${side}-cheek`)!),
      },
      {
        id: `output-${side}-spacer`,
        label: `${positive ? 'Positive' : 'Negative'} output inner-race thrust spacer`,
        color: steel,
        shape: placed(annulus(3.9, 3.025, positive ? 22.5 : -23.3, positive ? 23.3 : -22.5)),
      },
      {
        id: `output-${side}-crank`,
        label: `${positive ? 'Positive' : 'Negative'} split-clamp closed-slot crank · Ø4 pin clearance`,
        color: leverColor,
        shape: placed(crank(positive), angle),
      },
    );
  }
  return pieces;
}

/** Installed standard fasteners; the shared assembly instantiates their actual library models. */
export function outputFastenerDatums(angle: number) {
  const radians = (angle * Math.PI) / 180;
  const world = (x: number, y: number, z: number): Vec => [
    outputLayout.pivot[0] + x * Math.cos(radians) + z * Math.sin(radians),
    y,
    outputLayout.pivot[2] - x * Math.sin(radians) + z * Math.cos(radians),
  ];
  const bolts: OutputBolt[] = [];
  const nuts: { id: string; diameter: number; center: Vec; rotation: Vec }[] = [];
  const washers: {
    id: string;
    bore: number;
    outerDiameter: number;
    thickness: number;
    center: Vec;
    rotation: Vec;
  }[] = [];
  for (const positive of [false, true]) {
    const side = positive ? 'rear' : 'front';
    const y = positive ? 13.45 : -13.45;
    bolts.push({
      id: `output-${side}-clamp-bolt`,
      diameter: 2,
      length: 16,
      underHead: world(-6.3, y, -4.2),
      direction: [Math.cos(radians), 0, -Math.sin(radians)],
    });
    nuts.push({
      id: `output-${side}-clamp-nut`,
      diameter: 2,
      center: world(7.1, y, -4.2),
      rotation: [0, 90 + angle, 0],
    });
    for (const [name, x] of [
      ['head', -6.15],
      ['nut', 6.15],
    ] as const)
      washers.push({
        id: `output-${side}-clamp-${name}-washer`,
        bore: 2.2,
        outerDiameter: 4.5,
        thickness: 0.3,
        center: world(x, y, -4.2),
        rotation: [0, 90 + angle, 0],
      });
  }
  return { bolts, nuts, washers };
}
