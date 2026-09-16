import { box, prism, roundedRect, subtract, union, type Shape } from './shapes';

/** Mold silhouettes reconstructed from the orthographic catalog views.
 * Hook undercuts face OUTWARDS, away from the two-contact nozzle.
 * Radii, beam thickness and snap engagement are not dimensioned in these sheets.
 */
export function rightAngleLatch(family: 'sqxw' | 'ca281a', side: number): Shape {
  const profile: [number, number][] =
    family === 'sqxw'
      ? [
          // SQXR: bowed spring leg, free nose and an outward retaining shoulder.
          [5.0, 5.1],
          [5.65, 5.1],
          [6.05, 6.1],
          [6.25, 7.7],
          [6.25, 8.25],
          [6.5, 8.55],
          [6.5, 9.05],
          [5.75, 9.65],
          [5.55, 9.4],
          [5.72, 8.55],
          [5.68, 7.7],
          [5.48, 6.35],
          [5.0, 5.65],
        ]
      : [
          // CA281A: shorter stepped service leg with a ramp at its free end.
          [4.8, 6.2],
          [5.5, 6.2],
          [5.72, 7.1],
          [5.72, 9.8],
          [6.15, 10.3],
          [6.15, 10.85],
          [5.45, 11.85],
          [5.0, 11.85],
          [5.02, 11.0],
          [5.15, 10.1],
          [5.15, 7.35],
          [4.8, 6.9],
        ];
  return prism(
    profile.map(([x, z]) => [x * side, z]),
    family === 'sqxw' ? 3.4 : 2.6,
    family === 'sqxw' ? -1.7 : -1.3,
    'y',
  );
}

export function straightLatch(side: number): Shape {
  // CA282B: axial, not vertical. The outer barb is behind the tapered lead-in.
  return prism(
    [
      [4.95, -0.5],
      [5.7, -0.5],
      [5.7, 2.6],
      [6.4, 3.65],
      [6.4, 4.3],
      [5.5, 5.9],
      [5.03, 5.9],
      [5.13, 4.0],
      [4.95, 2.85],
    ].map(([x, y]) => [side * x, y] as [number, number]),
    1.4,
    7.6,
  );
}

export function sqxwCPA(): Shape {
  // 12 × 8 mm stepped pressure pad; 11.5 mm from pad back to central guide tip.
  const pad = prism(
    [
      [-4.05, 4],
      [-4.4, 3.6],
      [-4.4, 0.8],
      [-5.5, 0.8],
      [-6, 0.1],
      [-6, -2.8],
      [-5.4, -4],
      [5.4, -4],
      [6, -2.8],
      [6, 0.1],
      [5.5, 0.8],
      [4.4, 0.8],
      [4.4, 3.6],
      [4.05, 4],
    ],
    1.2,
    -2.5,
  );
  const fingers = [-1, 1].map((side) =>
    prism(
      [
        [4, -1.4],
        [5, -1.4],
        [5, 6.55],
        [4.85, 7.2],
        [4.85, 8.1],
        [4.4, 8.1],
        [4, 7.25],
      ].map(([x, z]) => [side * x, z] as [number, number]),
      2.2,
      -1.1,
      'y',
    ),
  );
  const guide = prism(
    [
      [-1.05, -1.4],
      [1.05, -1.4],
      [1.05, 4.1],
      [1.9, 4.8],
      [1.9, 6.9],
      [2.3, 7.2],
      [1.35, 9],
      [-1.35, 9],
      [-2.3, 7.2],
      [-1.9, 6.9],
      [-1.9, 4.8],
      [-1.05, 4.1],
    ],
    0.8,
    -3.4,
    'y',
  );
  return subtract(
    union(pad, ...fingers, guide),
    ...[1.1, 1.8, 2.5, 3.2].map((y) => box([6.4, 0.25, 0.3], [-3.2, y, -2.55])),
    box([8.8, 0.3, 0.3], [-4.4, -0.25, -2.55]),
    box([0.5, 1.0, 0.65], [-0.25, -3.5, 5.1]),
  );
}

export function ca281aCPA(): Shape {
  // The CA281A sheet shows a transverse rounded push button, not the SQXW stepped pad.
  const pad = roundedRect(12.8, 8, 1.9, 0, 1.2);
  return union(
    pad,
    ...[-1, 1].map((side) =>
      prism(
        [
          [4, 1.1],
          [5, 1.1],
          [5, 8.6],
          [4.8, 9.4],
          [4.8, 10.65],
          [4.25, 10.65],
          [4, 9.4],
        ].map(([x, z]) => [side * x, z] as [number, number]),
        1.5,
        -0.75,
        'y',
      ),
    ),
    box([1.1, 0.75, 6.1], [-0.55, 2.5, 1.1]),
  );
}

export function ca282bCPA(): Shape {
  // Rounded upright pressure tab and its two guide legs, oriented across the axial plug.
  const tab = prism(
    [
      [-4.5, 11.8],
      [4.5, 11.8],
      [4.5, 14.8],
      [4.35, 15.4],
      [3.95, 15.95],
      [3.4, 16.3],
      [-3.4, 16.3],
      [-3.95, 15.95],
      [-4.35, 15.4],
      [-4.5, 14.8],
    ],
    1.2,
    -6,
    'y',
  );
  return union(
    tab,
    box([1.05, 3.8, 6.2], [-4.5, -6, 6]),
    box([1.05, 3.8, 6.2], [3.45, -6, 6]),
    box([9, 1.1, 0.85], [-4.5, -3.3, 6]),
    ...[-1, 1].map((side) => box([0.45, 0.3, 2.6], [side * 3.45 - 0.225, -6.25, 12.7])),
  );
}
