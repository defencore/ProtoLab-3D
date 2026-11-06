import { prism, type Shape } from '../../../core/assembly/boundary/shapes';
import { board, boardClamps } from './layout';
import { union } from './shapes';

/** The board datum stays fixed; the printed seats grow below and outside its edge. */
export const boardSeats = {
  topZ: board.pcbBottom,
  ledgeThickness: 3.5,
  rootX: 13.5,
  outerX: 16.6,
  side: {
    innerX: 12,
    width: 6,
    rootRadius: 1.5,
    guideInnerX: 13.2,
    guideTopZ: 22,
    leadRadius: 0.5,
    sites: boardClamps,
  },
  rear: {
    innerX: 9.4,
    width: 4,
    centerY: board.y - 22.035 - 1.05,
    rootRadius: 4.1,
    stopCenterX: 10.8,
    stopWidth: 3.2,
    stopDepth: 2.4,
    stopFaceY: board.y - 22.035 - 0.25,
    stopTopZ: board.pcbBottom + 1.8,
    leadRadius: 0.5,
  },
};

/** A full-width circular haunch blends the bearing shelf into its existing upright. */
function bearing(sign: number, innerX: number, width: number, y: number): Shape {
  const { topZ, ledgeThickness, rootX, outerX } = boardSeats,
    bottom = topZ - ledgeThickness,
    radius = rootX - innerX;
  return prism(
    [
      [innerX, topZ],
      [outerX, topZ],
      [outerX, bottom - radius],
      ...Array.from({ length: 17 }, (_, i): [number, number] => {
        const a = (i * Math.PI) / 32;
        return [innerX + radius * Math.cos(a), bottom - radius + radius * Math.sin(a)];
      }),
    ].map(([x, z]) => [sign * x, z]),
    width,
    y - width / 2,
    'y',
  );
}

/** Round the insertion edge away from the PCB while retaining a broad, solid root. */
function sideGuide(sign: number, y: number): Shape {
  const { side, outerX, topZ } = boardSeats,
    centerX = side.guideInnerX + side.leadRadius,
    centerZ = side.guideTopZ - side.leadRadius;
  return prism(
    [
      [side.guideInnerX, topZ],
      [outerX, topZ],
      [outerX, side.guideTopZ],
      ...Array.from({ length: 9 }, (_, i): [number, number] => {
        const a = Math.PI / 2 + (i * Math.PI) / 16;
        return [centerX + side.leadRadius * Math.cos(a), centerZ + side.leadRadius * Math.sin(a)];
      }),
    ].map(([x, z]) => [sign * x, z]),
    side.width,
    y - side.width / 2,
    'y',
  );
}

/** The rear stop thickens toward the empty end of the case, preserving PCB clearance. */
function rearStop(sign: number): Shape {
  const { rear, topZ } = boardSeats,
    centerY = rear.stopFaceY - rear.leadRadius,
    centerZ = rear.stopTopZ - rear.leadRadius,
    profile: [number, number][] = [
      [rear.stopFaceY - rear.stopDepth, topZ],
      [rear.stopFaceY, topZ],
      ...Array.from({ length: 9 }, (_, i): [number, number] => {
        const a = (i * Math.PI) / 16;
        return [centerY + rear.leadRadius * Math.cos(a), centerZ + rear.leadRadius * Math.sin(a)];
      }),
      [rear.stopFaceY - rear.stopDepth, rear.stopTopZ],
    ];
  // A Y/Z profile is extruded along X by a rigid rotation of the shared prism.
  return {
    kind: 'transform',
    child: prism(profile, rear.stopWidth, -sign * rear.stopCenterX - rear.stopWidth / 2, 'y'),
    translation: [0, 0, 0],
    rotation: [0, 0, 90],
  };
}

/** Broad saddles replace the former 1.5 mm shelves and 0.8/0.6 mm locator fins. */
export function boardBaseSupports(): Shape {
  const { side, rear } = boardSeats;
  return union(
    ...side.sites.map(({ x, y }) =>
      union(bearing(Math.sign(x), side.innerX, side.width, y), sideGuide(Math.sign(x), y)),
    ),
    ...[-1, 1].map((sign) =>
      union(bearing(sign, rear.innerX, rear.width, rear.centerY), rearStop(sign)),
    ),
  );
}
