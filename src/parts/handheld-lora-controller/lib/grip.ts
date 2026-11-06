import type { Parameters } from '../../../core/types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { B, caseOutline, move, rounded, union } from './shapes';

export const grip = { soleDrop: 2.2, palmSwell: 2.8, upperRest: 1.4, textureDepth: 0.4 };
const lobe = (y: number, from: number, to: number) =>
  y <= from || y >= to ? 0 : Math.sin((Math.PI * (y - from)) / (to - from)) ** 2;
const swell = (y: number) => grip.palmSwell * lobe(y, -5, 40) + grip.upperRest * lobe(y, -43, -23);
export const bottomRound = { palmRadius: 5, straightRadius: 4, stockClipTopZ: 5 };
/** Shared cap datum lies inside the visibility kernel of every authored case ring. */
export const floorCapCenter = [2, 0] as const;
const anchors = [
  [5, 0, 1],
  [14, 0, 0.85],
  [23, 0, 0.35],
  [28, 0, 0],
];

/** Shape-preserving cubic slopes avoid horizontal folds between grip sections. */
const slopes = [1, 2].map((axis) => {
  const secants = anchors
    .slice(1)
    .map((row, i) => (row[axis] - anchors[i][axis]) / (row[0] - anchors[i][0]));
  return anchors.map((_, i) => {
    if (i === 0) return 0;
    if (i === anchors.length - 1) return 0;
    const before = secants[i - 1],
      after = secants[i];
    if (before * after <= 0) return 0;
    const previous = anchors[i][0] - anchors[i - 1][0],
      next = anchors[i + 1][0] - anchors[i][0],
      a = 2 * next + previous,
      b = next + 2 * previous;
    return (a + b) / (a / before + b / after);
  });
});
/** Exterior-only inset and palm swell; cubic joins retain every fit datum. */
export function gripProfile(z: number): [number, number] {
  const tangentZ = -grip.soleDrop + bottomRound.palmRadius;
  if (z < tangentZ) {
    const height = Math.max(-bottomRound.palmRadius, z - tangentZ);
    return [
      bottomRound.palmRadius - Math.sqrt(Math.max(0, bottomRound.palmRadius ** 2 - height ** 2)),
      1,
    ];
  }
  if (z <= anchors[0][0]) return [anchors[0][1], anchors[0][2]];
  if (z >= anchors.at(-1)![0]) return [anchors.at(-1)![1], anchors.at(-1)![2]];
  const i = anchors.findIndex(
      (_, index) => index + 1 < anchors.length && z < anchors[index + 1][0],
    ),
    anchor = anchors[i],
    next = anchors[i + 1],
    height = next[0] - anchor[0],
    t = (z - anchor[0]) / height,
    q = t * t,
    cube = q * t;
  return [1, 2].map(
    (axis) =>
      (2 * cube - 3 * q + 1) * anchor[axis] +
      (cube - 2 * q + t) * height * slopes[axis - 1][i] +
      (-2 * cube + 3 * q) * next[axis] +
      (cube - q) * height * slopes[axis - 1][i + 1],
  ) as [number, number];
}
const roundLevels = (bottom: number, radius: number, scale: number) =>
  Array.from({ length: 25 }, (_, i) => {
    const angle = (i * Math.PI) / 48;
    return [bottom + radius * (1 - Math.cos(angle)), radius * (1 - Math.sin(angle)), scale];
  });
const levels = [
  ...roundLevels(-grip.soleDrop, bottomRound.palmRadius, 1),
  ...anchors.flatMap((anchor, i) => {
    if (i === anchors.length - 1) return [anchor];
    const height = anchors[i + 1][0] - anchor[0],
      // Share upper stations with the guard skin; near-coincident rows create
      // sliver triangles even when both source curves are individually smooth.
      steps = anchor[0] >= 23 ? 10 : Math.ceil(height / (anchor[0] < 5 ? 0.25 : 0.6));
    return Array.from({ length: steps }, (_, sample) => {
      const z = anchor[0] + (height * sample) / steps;
      return [z, ...gripProfile(z)];
    });
  }),
];

function section(inset: number, scale: number): [number, number][] {
  // Add stations to the planar palm side so the swell is a curve, rather than one long facet.
  return caseOutline(inset, true).map(([x, y]) => [x - (x < -2 ? scale * swell(y) : 0), y]);
}
/** Exact host ring vertices retained by the sewn case and guard exterior. */
export function gripRings(p: Parameters): Vec[][] {
  const stations =
    p.bodyModel === 'original'
      ? [...roundLevels(0, bottomRound.straightRadius, 0), [5, 0, 0], [28, 0, 0]]
      : levels;
  return stations.map(([z, inset, scale]) =>
    (p.bodyModel === 'original' ? caseOutline(inset) : section(inset, scale)).map(([x, y]): Vec => [
      x,
      y,
      z,
    ]),
  );
}

/** Limit floor-rooted stock to the rounded skin; stock above Z=5 stays untouched. */
export function roundedFloorEnvelope(p: Parameters): Shape {
  const rings = gripRings(p).filter((ring) => ring[0][2] <= bottomRound.stockClipTopZ),
    stride = rings[0].length,
    points: Vec[] = rings.flat(),
    faces: number[][] = [];
  for (let layer = 0; layer + 1 < rings.length; layer++)
    for (let i = 0; i < stride; i++) {
      const a = layer * stride + i,
        b = layer * stride + ((i + 1) % stride);
      faces.push([a, b, b + stride], [a, b + stride, a + stride]);
    }
  // All rounded case rings are star-shaped about the shared cap datum. Explicit
  // nonzero cap triangles retain every perimeter vertex in native CAD as well.
  for (const [layer, top] of [
    [0, false],
    [rings.length - 1, true],
  ] as const) {
    points.push([...floorCapCenter, rings[layer][0][2]]);
    const center = points.length - 1;
    for (let i = 0; i < stride; i++) {
      const a = layer * stride + i,
        b = layer * stride + ((i + 1) % stride);
      faces.push(top ? [center, a, b] : [center, b, a]);
    }
  }
  return union(
    { kind: 'boundary', points, faces },
    B(200, 240, 60, 0, 0, bottomRound.stockClipTopZ - 0.01),
  );
}
function leftX(y: number): number {
  const points = caseOutline();
  return Math.min(
    ...points.flatMap(([x, v], i) => {
      const [nx, ny] = points[(i + 1) % points.length];
      if (Math.abs(ny - v) < 1e-8) return [];
      const t = (y - v) / (ny - v);
      return t >= 0 && t <= 1 ? [x + t * (nx - x)] : [];
    }),
  );
}
export function palmTexture(): Shape {
  return union(
    ...[0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33].map((y) => {
      const end = leftX(y) - 0.9 * swell(y) + grip.textureDepth;
      return B(10, 1.1, 6, end - 5, y, 10);
    }),
  );
}
export function lidTexture(): Shape {
  return union(
    ...[-35, -30.5, -26, -21.5, -17, -12.5, -8].flatMap((y) =>
      [-1, 1].map((sign) =>
        move(rounded(8.8, 0.8, 0.38, 28.7, 1), [sign * 5.2, y, 0], [0, 0, sign * 22]),
      ),
    ),
  );
}
