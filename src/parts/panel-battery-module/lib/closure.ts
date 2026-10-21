import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { layout } from './layout';
import { rounded } from './shapes';

export const latch = {
  stroke: 4,
  centreY: -5,
  axisZ: -5.8,
  movingSeat: 50.5,
  fixedSeat: 59.5,
  coverAxes: [
    [43, 6],
    [64.5, -5],
  ] as [number, number][],
};

/** The bearing shoulders, rather than the spring, set both ends of the stroke. */
export function latchShape(_p: Parameters, travel = 0): Shape {
  const nose = prism(
    [
      [38, -0.9],
      [50.5, -0.9],
      [50.5, 1.7],
      [40.6, 1.7],
    ],
    10,
    -10,
    'y',
  );
  return {
    kind: 'transform',
    translation: [travel, 0, 0],
    rotation: [0, 0, 0],
    child: subtract(
      union(
        nose,
        box([3, 10, 12.8], [47.5, -10, -11.1]),
        box([3, 7, 2.1], [47.5, -8.5, 1.6]),
        rounded(6, 8, 1, [50.5, -5], 2.4, 1.3),
      ),
      ...[49, 51, 53].map((x) => box([0.6, 6, 0.5], [x - 0.3, -8, 3.3])),
    ),
  };
}

const outer = (z: number, t: number): Shape =>
  union(
    rounded(20, 13.4, 2, [51.9, -5], z, t),
    box([7.4, 6, t], [39.3, -0.5, z]),
    ...latch.coverAxes.map(([x, y]) => cylinder(3.7, t, [x, y, z])),
  );

export const latchHousing = (): Shape => outer(-11.4, 15.4);

/** Rear-open assembly channel; the lower cover carries the forward travel stop. */
export const latchHousingCuts = (): Shape[] => [
  box([7, 10.6, 13.3], [47.5, -10.3, -11.4]),
  cylinder(4.3, 5, [54.5, -5, -5.8], 'x'),
  box([17.3, 10.6, 13.3], [37.2, -10.3, -11.4]),
  rounded(10.6, 8.6, 0.8, [52.5, -5], 1.6, 2.6),
  box([3.8, 18.6, 7.8], [37.2, -14.3, -3.5]),
  ...latch.coverAxes.flatMap(([x, y]) => [
    cylinder(2.1, 4.2, [x, y, -10.6]),
    cylinder(1.7, 7.9, [x, y, -11.5]),
  ]),
];

export function latchCover(): Shape {
  return subtract(
    union(outer(-13.8, 2.4), box([3, 10, 3.7], [44.5, -10, -11.5])),
    ...latch.coverAxes.flatMap(([x, y]) => [
      cylinder(1.7, 2.6, [x, y, -13.9]),
      {
        kind: 'transform',
        translation: [x, y, 0],
        rotation: [0, 0, 0],
        child: {
          kind: 'revolve',
          profile: [
            [0, -13.9],
            [3.1, -13.9],
            [3.1, -13.8],
            [1.7, -12.4],
            [1.7, -12.2],
            [0, -12.2],
          ],
        },
      } as Shape,
    ]),
  );
}

export function lidHooks(p: Parameters): Shape[] {
  const e = layout(p).openingLength / 2;
  return [-13, 13].map((y) =>
    union(box([2.8, 8, 6.7], [-e + 0.2, y - 4, -2.6]), box([5.5, 8, 2.4], [-e - 3, y - 4, -2.6])),
  );
}

export const lidKeeper = (): Shape =>
  subtract(box([3, 18, 7.3], [37.6, -14, -3.2]), box([3.2, 10.6, 3], [37.5, -10.3, -1.1]));

/** Left underside chamfer clears the fixed bezel while the cover pivots up. */
export function lidBevel(p: Parameters): Shape {
  const e = layout(p).openingLength / 2,
    w = layout(p).lidWidth;
  return prism(
    [
      [-e - 5.2, 3.9],
      [-e + 1, 3.9],
      [-e - 5.2, 5.7],
    ],
    w + 1,
    -w / 2 - 0.5,
    'y',
  );
}

export function lidPoseShape(
  p: Parameters,
  shape: Shape,
  angle = -17,
  withdraw = 4,
  lift = 35,
): Shape {
  const e = layout(p).openingLength / 2;
  return {
    kind: 'transform',
    translation: [-e + withdraw, 0, 4 + lift],
    rotation: [0, angle, 0],
    child: {
      kind: 'transform',
      translation: [e, 0, -4],
      rotation: [0, 0, 0],
      child: shape,
    },
  };
}
