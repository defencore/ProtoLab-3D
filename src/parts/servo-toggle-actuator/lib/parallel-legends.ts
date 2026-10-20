import type { Shape } from '../../../core/assembly/boundary/shapes';

type Point = [number, number];
type Glyph = { outline: Point[]; holes?: Point[][] };

// Fixed vector outlines keep exported lettering independent of installed system fonts.
const glyphs: Record<string, Glyph> = {
  A: {
    outline: [
      [0.2, 0],
      [1.1, 0],
      [1.65, 1.7],
      [3.35, 1.7],
      [3.9, 0],
      [4.8, 0],
      [2.95, 5.6],
      [2.05, 5.6],
    ],
    // Plate holes are standalone polygons before subtraction; they also require CCW winding.
    holes: [
      [
        [1.9, 2.5],
        [3.1, 2.5],
        [2.5, 4.4],
      ],
    ],
  },
  R: {
    outline: [
      [0.1, 0],
      [1, 0],
      [1, 2.2],
      [2.4, 2.2],
      [3.8, 0],
      [4.9, 0],
      [3.35, 2.45],
      [4.3, 3.1],
      [4.6, 3.8],
      [4.6, 4.5],
      [4.25, 5.15],
      [3.6, 5.6],
      [0.1, 5.6],
    ],
    holes: [
      [
        [1, 3],
        [3.2, 3],
        [3.7, 3.4],
        [3.7, 4.25],
        [3.2, 4.75],
        [1, 4.75],
      ],
    ],
  },
  M: {
    outline: [
      [0.05, 0],
      [0.95, 0],
      [0.95, 3.8],
      [2.15, 1.9],
      [2.85, 1.9],
      [4.05, 3.8],
      [4.05, 0],
      [4.95, 0],
      [4.95, 5.6],
      [4.05, 5.6],
      [2.5, 3.05],
      [0.95, 5.6],
      [0.05, 5.6],
    ],
  },
  '1': {
    outline: [
      [0.2, 0],
      [4.8, 0],
      [4.8, 0.85],
      [3, 0.85],
      [3, 5.6],
      [2.1, 5.6],
      [0.55, 4.4],
      [1.05, 3.7],
      [2.1, 4.5],
      [2.1, 0.85],
      [0.2, 0.85],
    ],
  },
  '2': {
    outline: [
      [0.2, 0],
      [4.8, 0],
      [4.8, 0.85],
      [1.6, 0.85],
      [4.25, 3.15],
      [4.8, 3.9],
      [4.8, 4.65],
      [4.25, 5.35],
      [3.65, 5.6],
      [1.25, 5.6],
      [0.65, 5.35],
      [0.2, 4.65],
      [0.2, 3.9],
      [1.1, 3.9],
      [1.1, 4.3],
      [1.55, 4.75],
      [3.35, 4.75],
      [3.9, 4.3],
      [3.9, 4.05],
      [3.6, 3.65],
      [0.2, 0.75],
    ],
  },
};

/** Canonical coordinates precede the complete dual assembly's clockwise quarter-turn. */
export const parallelLegendLayout = [
  { text: 'ARM 1', centre: [36, -90], rotation: 90, width: 23.75, height: 5.6, depth: 0.6 },
  { text: 'ARM 2', centre: [36, 0], rotation: 90, width: 23.75, height: 5.6, depth: 0.6 },
] as const;

/** Eight shallow glyph cutters: the space is a real 2 mm gap between M and the digit. */
export function parallelLegendCutters(): Shape[] {
  const starts = [0, 6.2, 12.4, 19.15],
    centreX = (0.2 + 19.15 + 4.8) / 2;
  return parallelLegendLayout.flatMap((legend) =>
    [...legend.text.replace(' ', '')].map((letter, i): Shape => {
      const glyph = glyphs[letter],
        move = ([x, y]: Point): Point => [x + starts[i] - centreX, y - 2.8];
      return {
        kind: 'transform',
        child: {
          kind: 'plate',
          outline: glyph.outline.map(move),
          holes: (glyph.holes ?? []).map((hole) => hole.map(move)),
          z: 6 - legend.depth,
          height: legend.depth + 0.1,
        },
        translation: [legend.centre[0], legend.centre[1], 0],
        rotation: [0, 0, legend.rotation],
      };
    }),
  );
}
