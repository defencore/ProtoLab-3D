import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import { cylinder, union, type Shape } from '../../../core/assembly/boundary/shapes';
import presets from '../presets.json';

/** Dimensioned extrema from the JCG108 drawing; tolerances remain catalog evidence. */
export const housing = { length: 126, mainHeight: 15.5, overallHeight: 16.2, depth: 8.6 };

/** Undimensioned drawing-traced approximations, never verified supplier dimensions. */
export const outlineReference = {
  upperArcHalfChord: 61.4,
  upperArcSagitta: 4.4,
  endCornerRadius: 1.6,
  lowerHalfWidth: 59.6,
  mainDepth: 7.2,
  bossRadius: 7.2,
};

export function selectedModel(parameters: Parameters) {
  const preset = presets.find((item) => item.parameters.model === parameters.model);
  if (!preset) throw new Error('Select a supported Jinchang JCG108 reference execution.');
  return preset;
}

type Segment = Extract<Shape, { kind: 'curve-loft' }>['segments'][number];
type Point = [number, number];
const line = (a: Point, b: Point): Segment => ({ kind: 'line', points: [a, b] });
const arc = (cx: number, cy: number, radius: number, start: number, end: number): Segment => ({
  kind: 'arc',
  // Preview samples lie on the same circle as the native three-point arc.
  points: Array.from({ length: 33 }, (_, index): Point => {
    const angle = start + ((end - start) * index) / 32;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }),
});

/** Nominal installation reference; the curved/tapered contour is not fully dimensioned. */
export function housingShape(): Shape {
  const top = housing.overallHeight / 2;
  const bottom = top - housing.mainHeight;
  const r = outlineReference.endCornerRadius;
  const a = outlineReference.upperArcHalfChord;
  const sagitta = outlineReference.upperArcSagitta;
  const radius = (a * a + sagitta * sagitta) / (2 * sagitta);
  const centerY = top - radius;
  const angle = Math.atan2(radius - sagitta, a);
  const upper = arc(0, centerY, radius, angle, Math.PI - angle);
  const right = upper.points[0];
  const left = upper.points.at(-1)!;
  const leftEnd = arc(-a, left[1] - r, r, Math.PI / 2, Math.PI);
  const rightEnd = arc(a, right[1] - r, r, 0, Math.PI / 2);
  const lowerLeft: Point = [-outlineReference.lowerHalfWidth, bottom];
  const lowerRight: Point = [outlineReference.lowerHalfWidth, bottom];
  const body: Shape = {
    kind: 'curve-loft',
    segments: [
      upper,
      leftEnd,
      line(leftEnd.points.at(-1)!, lowerLeft),
      line(lowerLeft, lowerRight),
      line(lowerRight, rightEnd.points[0]),
      rightEnd,
    ],
    layers: [
      { scale: 1, angle: 0, z: 0 },
      { scale: 1, angle: 0, z: outlineReference.mainDepth },
    ],
  };
  return union(
    body,
    cylinder(outlineReference.bossRadius, housing.depth, [
      0,
      -housing.overallHeight / 2 + outlineReference.bossRadius,
      0,
    ]),
  );
}

export function pieces(parameters: Parameters): Piece[] {
  selectedModel(parameters);
  return [
    {
      label: 'JCG108 nominal housing reference — undimensioned contour and boss approximate',
      shape: housingShape(),
      color: 0x292b2e,
    },
  ];
}

export function dimensions(parameters: Parameters): [number, number, number] {
  selectedModel(parameters);
  return [housing.length, housing.overallHeight, housing.depth];
}
