import {
  cylinder,
  prism,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import {
  cheekThickness,
  columnLines,
  discDiameter,
  endDiscX,
  fixedDiscX,
  mainPlateThickness,
  motorDiscX,
  outputCheekInner,
  outputCheekOuter,
  screwAxisHeight,
} from './drive-layout';

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
  thickness: 3 | 4;
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
const columnHoles = (): LaserInner[] =>
  columnLines.map((line, i) => circle(`column-${i + 1}`, line, 3.4));
const cheekSlots = (): LaserInner[] =>
  [-19.4, 19.4].map((y): LaserInner => ({
    id: `cheek-tab-${y < 0 ? 'negative' : 'positive'}`,
    loop: {
      kind: 'path',
      points: [
        [y - 2.05, -3.05],
        [y + 2.05, -3.05],
        [y + 2.05, 3.05],
        [y - 2.05, 3.05],
      ],
    },
  }));

/** World X/Z outline: both narrow tab axes pass through the bearing centre. */
const cheekXZ: LaserPoint[] = [
  [-18.5, -3],
  [-15, -3],
  [-15, -4],
  [-11, -4],
  [-11, -3],
  [-9, -3],
  [-9, -9],
  [9, -9],
  [9, -3],
  [11, -3],
  [11, -4],
  [15, -4],
  [15, -3],
  [18.5, -3],
  [18.5, 3],
  [15, 3],
  [15, 4],
  [11, 4],
  [11, 3],
  [9, 3],
  [9, 9],
  [-9, 9],
  [-9, 3],
  [-11, 3],
  [-11, 4],
  [-15, 4],
  [-15, 3],
  [-18.5, 3],
];

export const laserPlates: LaserPlate[] = [
  {
    id: 'motor-disc',
    label: 'Motor mounting disc · Ø56 × 3 · laser-cut through features',
    thickness: mainPlateThickness,
    placement: { translation: [motorDiscX, 0, 0], rotation: [90, 0, 90] },
    outer: { kind: 'circle', center: [0, 0], radius: discDiameter / 2 },
    inner: [
      circle('motor-boss-clearance', [0, screwAxisHeight], 6.2),
      circle('motor-mount-negative', [0, screwAxisHeight - 5.25], 2.2),
      circle('motor-mount-positive', [0, screwAxisHeight + 5.25], 2.2),
      ...columnHoles(),
    ],
  },
  ...(
    [
      ['fixed-disc', fixedDiscX],
      ['end-disc', endDiscX],
    ] as const
  ).map(([id, x]): LaserPlate => ({
    id,
    label: `${id === 'fixed-disc' ? 'Fixed' : 'Floating'} screw bearing disc · Ø56 × 3 · finished Ø13.02 bore`,
    thickness: mainPlateThickness,
    placement: { translation: [x, 0, 0], rotation: [90, 0, 90] },
    outer: { kind: 'circle', center: [0, 0], radius: discDiameter / 2 },
    inner: [bearingHole([0, screwAxisHeight]), ...columnHoles(), ...cheekSlots()],
  })),
  ...[false, true].map((positive): LaserPlate => ({
    id: `output-${positive ? 'rear' : 'front'}-cheek`,
    label: `${positive ? 'Positive' : 'Negative'} output bearing cheek · 4 mm tabbed laser plate`,
    thickness: cheekThickness,
    placement: {
      translation: [0, positive ? outputCheekInner : -outputCheekOuter, 0],
      rotation: [-90, 0, 0],
    },
    outer: { kind: 'path', points: cheekXZ.map(([x, z]): LaserPoint => [x, -z]).reverse() },
    inner: [bearingHole()],
  })),
];

/** Exported cut profiles and assembled sheets share the same exact contours. */
export function laserPlateShape(plate: LaserPlate, mode: 'finished' | 'cut' = 'finished'): Shape {
  const solid = (loop: LaserLoop, z: number, height: number): Shape =>
    loop.kind === 'circle'
      ? cylinder(loop.radius, height, [loop.center[0], loop.center[1], z])
      : prism(loop.points, height, z);
  const cuts = plate.inner.map((feature) => {
    const diameter = mode === 'cut' ? feature.cutDiameter : feature.finishedDiameter;
    const loop =
      feature.loop.kind === 'circle' && diameter !== undefined
        ? { ...feature.loop, radius: diameter / 2 }
        : feature.loop;
    return solid(loop, -0.1, plate.thickness + 0.2);
  });
  return {
    kind: 'transform',
    child: subtract(solid(plate.outer, 0, plate.thickness), ...cuts),
    translation: plate.placement.translation,
    rotation: plate.placement.rotation,
  };
}
