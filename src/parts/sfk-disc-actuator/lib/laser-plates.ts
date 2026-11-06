import {
  cylinder,
  prism,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { discAxisHeight, driveOffsetZ, outputAxisHeight, outputAxisX } from './drive-layout';

export type LaserPoint = [number, number];
export type LaserLoop =
  { kind: 'circle'; center: LaserPoint; radius: number } | { kind: 'path'; points: LaserPoint[] };
export interface LaserInner {
  id: string;
  loop: LaserLoop;
  finishedDiameter?: number;
  cutDiameter?: number;
  operation?: 'ream';
}
export interface LaserPlate {
  id: string;
  label: string;
  thickness: 4;
  placement: { translation: Vec; rotation: Vec };
  outer: LaserLoop;
  inner: LaserInner[];
}

const circle = (id: string, center: LaserPoint, diameter: number): LaserInner => ({
  id,
  loop: { kind: 'circle', center, radius: diameter / 2 },
  finishedDiameter: diameter,
});
const bearingHole = (center: LaserPoint = [0, 0]): LaserInner => ({
  ...circle('bearing-bore', center, 13.02),
  cutDiameter: 12.8,
  operation: 'ream',
});
const rodHoles = (): LaserInner[] =>
  ([-20, 20] as const)
    .map((y) => circle(`column-upper-${y < 0 ? 'negative' : 'positive'}`, [y, 20], 3.4))
    .concat(circle('column-lower', [0, -22], 3.4));
const cheekSlots = (): LaserInner[] =>
  [-18.4, 18.4].map((y): LaserInner => ({
    id: `cheek-tab-${y < 0 ? 'negative' : 'positive'}`,
    loop: {
      kind: 'path',
      points: [
        [y - 2.05, outputAxisHeight - discAxisHeight - 3.05],
        [y + 2.05, outputAxisHeight - discAxisHeight - 3.05],
        [y + 2.05, outputAxisHeight - discAxisHeight + 3.05],
        [y - 2.05, outputAxisHeight - discAxisHeight + 3.05],
      ],
    },
  }));

/** Centred-drive drawing coordinates; placement carries the complete drive offset. */
const cheekReferenceOutline: LaserPoint[] = [
  [-18.6, 12],
  [-14.1, 12],
  [-14.1, 11],
  [-9.1, 11],
  [-9.1, 12],
  [outputAxisX - 9, 12],
  [outputAxisX - 9, 6],
  [outputAxisX + 9, 6],
  [outputAxisX + 9, 12],
  [35.9, 12],
  [35.9, 11],
  [40.9, 11],
  [40.9, 12],
  [45.4, 12],
  [45.4, 18],
  [40.9, 18],
  [40.9, 19],
  [35.9, 19],
  [35.9, 18],
  [outputAxisX + 9, 18],
  [outputAxisX + 9, 24],
  [outputAxisX - 9, 24],
  [outputAxisX - 9, 18],
  [-9.1, 18],
  [-9.1, 19],
  [-14.1, 19],
  [-14.1, 18],
  [-18.6, 18],
];

export const laserPlates: LaserPlate[] = [
  {
    id: 'motor-disc',
    label: 'Motor mounting disc · Ø68 × 4 · laser-cut through features',
    thickness: 4,
    placement: { translation: [-72.1, 0, discAxisHeight], rotation: [90, 0, 90] },
    outer: { kind: 'circle', center: [0, 0], radius: 34 },
    inner: [
      circle('motor-boss-clearance', [0, driveOffsetZ], 6.2),
      circle('motor-mount-negative', [0, driveOffsetZ - 5.25], 2.2),
      circle('motor-mount-positive', [0, driveOffsetZ + 5.25], 2.2),
      ...rodHoles(),
    ],
  },
  {
    id: 'fixed-disc',
    label: 'Fixed screw bearing disc · Ø68 × 4 · finished Ø13.02 bore',
    thickness: 4,
    placement: { translation: [-18.1, 0, discAxisHeight], rotation: [90, 0, 90] },
    outer: { kind: 'circle', center: [0, 0], radius: 34 },
    inner: [bearingHole([0, driveOffsetZ]), ...rodHoles(), ...cheekSlots()],
  },
  {
    id: 'end-disc',
    label: 'Floating screw bearing end disc · Ø68 × 4 · finished Ø13.02 bore',
    thickness: 4,
    placement: { translation: [40.9, 0, discAxisHeight], rotation: [90, 0, 90] },
    outer: { kind: 'circle', center: [0, 0], radius: 34 },
    inner: [bearingHole([0, driveOffsetZ]), ...rodHoles(), ...cheekSlots()],
  },
  ...[false, true].map((positive): LaserPlate => ({
    id: `output-${positive ? 'rear' : 'front'}-cheek`,
    label: `${positive ? 'Positive' : 'Negative'} output bearing cheek · 4 mm tabbed laser plate`,
    thickness: 4,
    placement: {
      translation: [outputAxisX, positive ? 16.4 : -20.4, outputAxisHeight],
      rotation: [-90, 0, 0],
    },
    outer: {
      kind: 'path',
      points: cheekReferenceOutline
        .map(([x, z]): LaserPoint => [x - outputAxisX, 15 - z])
        .reverse(),
    },
    inner: [bearingHole()],
  })),
];

/** The CAD model and cut-plan exporter consume these same exact circle/line contours. */
export function laserPlateShape(plate: LaserPlate, mode: 'finished' | 'cut' = 'finished'): Shape {
  const loopSolid = (loop: LaserLoop, start: number, height: number): Shape =>
    loop.kind === 'circle'
      ? cylinder(loop.radius, height, [loop.center[0], loop.center[1], start])
      : prism(loop.points, height, start);
  const cuts = plate.inner.map((feature) => {
    const diameter = mode === 'cut' ? feature.cutDiameter : feature.finishedDiameter;
    const loop =
      feature.loop.kind === 'circle' && diameter !== undefined
        ? { ...feature.loop, radius: diameter / 2 }
        : feature.loop;
    return loopSolid(loop, -0.1, plate.thickness + 0.2);
  });
  return {
    kind: 'transform',
    child: subtract(loopSolid(plate.outer, 0, plate.thickness), ...cuts),
    translation: plate.placement.translation,
    rotation: plate.placement.rotation,
  };
}
