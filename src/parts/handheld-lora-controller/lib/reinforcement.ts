import { prism, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { B, caseOutline, shellLoft, union } from './shapes';
import {
  batteryBridge,
  batteryMount,
  batteryScrews,
  board,
  boardClamps,
  lidMount,
  lidScrews,
  shell,
} from './layout';

/** Intersection with the original case section; reinforcement does not change its exterior. */
function wallX(sign: number, y: number, inset = 0): number {
  const points = caseOutline(inset),
    intersections = points.flatMap(([x, v], i) => {
      const [nextX, nextY] = points[(i + 1) % points.length];
      if (Math.abs(nextY - v) < 1e-9) return [];
      const t = (y - v) / (nextY - v);
      return t >= -1e-9 && t <= 1 + 1e-9 ? [x + t * (nextX - x)] : [];
    });
  return sign > 0 ? Math.max(...intersections) : Math.min(...intersections);
}

// A short U lies in the rounded USB corner, with both mouths accessible from outside.
// The frame is tangent/normal to the original end arc, so it does not follow the
// long palm edge or require the former full-height diagonal wall spine.
const cornerOrigin: Vec = [-7, 39, 6.4];
const cornerTangent: Vec = [Math.SQRT1_2, Math.SQRT1_2, 0];
const cornerOutward: Vec = [-Math.SQRT1_2, Math.SQRT1_2, 0];
const cordBendRadius = 3.5;
const cordBendCenter = 11.7;
const cordRadius = 1.83;
const cordMouthRadius = 2.23;
const cordMouthRelief = 1.2;
const anchorRadius = 7.75;
const anchorTop = 12;
const cornerPoint = (tangent: number, outward: number, height = 0): Vec =>
  cornerOrigin.map(
    (value, i) =>
      value + cornerTangent[i] * tangent + cornerOutward[i] * outward + (i === 2 ? height : 0),
  ) as Vec;

/** Intersect the actual faceted end wall, rather than placing a mouth on an ideal circle. */
function cornerPort(tangent: number): { point: Vec; outward: number } {
  const origin = cornerPoint(tangent, 0),
    points = caseOutline(),
    hits = points.flatMap(([x, y], i) => {
      const [nextX, nextY] = points[(i + 1) % points.length],
        dx = nextX - x,
        dy = nextY - y,
        determinant = cornerOutward[0] * dy - cornerOutward[1] * dx;
      if (Math.abs(determinant) < 1e-9) return [];
      const ox = x - origin[0],
        oy = y - origin[1],
        along = (ox * dy - oy * dx) / determinant,
        edge = (ox * cornerOutward[1] - oy * cornerOutward[0]) / determinant;
      return edge >= -1e-9 && edge <= 1 + 1e-9 ? [along] : [];
    }),
    outward = Math.max(...hits);
  return { point: cornerPoint(tangent, outward), outward };
}
const entry = cornerPort(-cordBendRadius);
const exit = cornerPort(cordBendRadius);
interface CordStation {
  center: Vec;
  direction: Vec;
  radius: number;
}
const legStation = (
  tangent: number,
  outward: number,
  direction: number,
  radius: number,
): CordStation => ({
  center: cornerPoint(tangent, outward),
  direction: cornerOutward.map((value) => direction * value) as Vec,
  radius,
});
const cordStations: CordStation[] = [
  legStation(-cordBendRadius, 18, -1, cordMouthRadius),
  legStation(-cordBendRadius, entry.outward, -1, cordMouthRadius),
  legStation(-cordBendRadius, entry.outward - cordMouthRelief, -1, cordRadius),
  legStation(-cordBendRadius, cordBendCenter, -1, cordRadius),
  ...Array.from({ length: 48 }, (_, i): CordStation => {
    const angle = ((i + 1) * Math.PI) / 48;
    return {
      center: cornerPoint(
        -cordBendRadius * Math.cos(angle),
        cordBendCenter - cordBendRadius * Math.sin(angle),
      ),
      direction: cornerTangent.map(
        (value, axis) => value * Math.sin(angle) - cornerOutward[axis] * Math.cos(angle),
      ) as Vec,
      radius: cordRadius,
    };
  }),
  legStation(cordBendRadius, exit.outward - cordMouthRelief, 1, cordRadius),
  legStation(cordBendRadius, exit.outward, 1, cordMouthRadius),
  legStation(cordBendRadius, 18, 1, cordMouthRadius),
];
/** A circular clearance below two tangent 45-degree roof faces prints without a round bridge. */
function cordProfile(radius: number): [number, number][] {
  return [
    ...Array.from({ length: 37 }, (_, i): [number, number] => {
      const angle = ((45 - (270 * i) / 36) * Math.PI) / 180;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    }),
    [0, radius * Math.SQRT2],
  ];
}

const rearSupportY = board.y - 22.035 - 0.55;
const pcbSites = [
  ...boardClamps.map(({ x, y }) => ({ x: Math.sign(x) * 15.1, y, width: 6 })),
  ...[-15.1, 15.1].map((x) => ({ x, y: rearSupportY, width: 3 })),
];
const pcbRootInnerX = 13.5;
const lidClampSites = boardClamps.map(({ x, y }) => {
  const sign = Math.sign(x),
    availableX = Math.min(
      ...[y - 1.5, y, y + 1.5].map((v) => sign * wallX(sign, v, shell.wall) - 0.5),
    );
  return { x, y, outerX: sign * Math.min(17.9, availableX) };
});

/** Nominal design zones for fit and continuity audits, not a rated strap load. */
export const reinforcement = {
  webThickness: 3,
  embeddedFloorZ: 1.8,
  lidPostTopZ: lidMount.bossBottom,
  lidPostWallTopZ: 14,
  pcbWebTopZ: board.pcbBottom,
  // The Palm Lock loading channel intentionally passes above this guaranteed
  // floor-to-wall root. The full-height stock is relieved by that same channel.
  pcbWallTopZ: 10,
  batteryWebTopZ: batteryBridge.z,
  batteryWallTopZ: 8,
  batteryWebThickness: 6,
  lidPosts: lidScrews.map(([x, y], i) => ({
    id: `lid-post-${i}`,
    x,
    y,
    wallX: wallX(Math.sign(x), y),
    nutLoadingDirection: (y > 0 ? [Math.sign(x), 0, 0] : [0, Math.sign(y), 0]) as Vec,
    nutPlaneZ: 21,
  })),
  pcbSupports: pcbSites.map(({ x, y, width }, i) => ({
    id: `pcb-support-${i}`,
    x,
    y,
    width,
    innerX: Math.sign(x) * pcbRootInnerX,
    topZ: board.pcbBottom,
    rootBottomZ: 1.8,
    wallX: wallX(Math.sign(x), y),
  })),
  batteryPosts: batteryScrews.map(([x, y], i) => ({
    id: `battery-post-${i}`,
    x,
    y,
    wallX: wallX(Math.sign(x), y),
    nutLoadingDirection: [Math.sign(x), 0, 0] as Vec,
    nutPlaneZ: batteryMount.nutPocketBottom,
  })),
  lidClampRoot: {
    thickness: 3,
    columnX: 12.2,
    outerX: 17.9,
    bottomZ: 24,
    topZ: 28.2,
    minimumWallClearance: 0.5,
    sites: lidClampSites,
  },
  lanyard: {
    profile: 'compact-u-teardrop',
    boreDiameter: 3.6,
    mouthDiameter: 4.4,
    profileRadius: cordRadius,
    mouthProfileRadius: cordMouthRadius,
    mouthReliefLength: cordMouthRelief,
    roofAngleDegrees: 45,
    centerZ: cornerOrigin[2],
    bendRadius: cordBendRadius,
    entryPort: entry.point,
    exitPort: exit.point,
    entryDirection: cordStations[0].direction,
    exitDirection: cordStations.at(-1)!.direction,
    portSpacing: Math.hypot(...entry.point.map((value, i) => value - exit.point[i])),
    enclosedLength: entry.outward + exit.outward - 2 * cordBendCenter + Math.PI * cordBendRadius,
    cordPath: cordStations.map(({ center }) => center),
    cordDirections: cordStations.map(({ direction }) => direction),
    boreStations: cordStations,
    bossMin: [-21, 38.8, 1.8] as Vec,
    bossMax: [-9.1, 53, anchorTop] as Vec,
    boreRoofZ: cornerOrigin[2] + cordRadius * Math.SQRT2,
    mouthRoofZ: cornerOrigin[2] + cordMouthRadius * Math.SQRT2,
    nominalMinimumLigament: 2.3,
    topLigament: anchorTop - (cornerOrigin[2] + cordMouthRadius * Math.SQRT2),
    bottomLigament: cornerOrigin[2] - cordMouthRadius - 1.8,
    // The bridge is the material between the two ports, rooted in the corner floor.
    loadedBridgeWitness: cornerPoint(0, 11.95),
    loadedBridgeSegment: [cornerPoint(0, 10.65), cornerPoint(0, 13.05)],
    floorRootWitness: cornerPoint(0, 11.95, -3.5),
    roofWitness: cornerPoint(0, 8.2, 4.15),
  },
};

/** A tapered rib carries the post load into both the floor and the adjacent case wall. */
function baseWeb(
  x: number,
  y: number,
  topZ: number,
  wallTopZ: number,
  width = reinforcement.webThickness,
): Shape {
  const sign = Math.sign(x),
    innerX = x - sign * 0.4,
    outerX = wallX(sign, y) + sign * 0.2;
  return prism(
    [
      [innerX, reinforcement.embeddedFloorZ],
      [innerX, topZ],
      [outerX, wallTopZ],
      [outerX, reinforcement.embeddedFloorZ],
    ],
    width,
    y - width / 2,
    'y',
  );
}

/** The complete bearing width continues into the side shell, rather than ending on a tall fin. */
export function pcbWallReinforcement(): Shape {
  return union(
    ...pcbSites.map(({ x, y, width }) => {
      const sign = Math.sign(x),
        outerX =
          Math.max(...[y - width / 2, y, y + width / 2].map((v) => sign * wallX(sign, v))) + 0.2;
      return B(
        outerX - pcbRootInnerX,
        width,
        board.pcbBottom - reinforcement.embeddedFloorZ,
        (sign * (outerX + pcbRootInnerX)) / 2,
        y,
        reinforcement.embeddedFloorZ,
      );
    }),
  );
}

/** Add before the existing nut pockets and screw bores are subtracted. */
export function baseReinforcement(): Shape {
  const lanyardBoss = lanyardAnchor();
  return {
    kind: 'intersect',
    children: [
      union(
        ...lidScrews.map(([x, y]) =>
          baseWeb(x, y, reinforcement.lidPostTopZ, reinforcement.lidPostWallTopZ),
        ),
        pcbWallReinforcement(),
        ...batteryScrews.map(([x, y]) =>
          baseWeb(
            x,
            y,
            reinforcement.batteryWebTopZ,
            reinforcement.batteryWallTopZ,
            reinforcement.batteryWebThickness,
          ),
        ),
        lanyardBoss,
      ),
      shellLoft([
        // Internal ribs stay buried in the wall instead of duplicating its exterior skin.
        [0, 2.4],
        [5, 0.2],
        [shell.seam, 0.2],
      ]),
    ],
  };
}

/** Roof buttresses end inside the base-wall clearance, leaving the PCB contact toes unchanged. */
export function lidReinforcement(): Shape {
  return union(
    ...lidClampSites.map(({ x, y, outerX }) => {
      const sign = Math.sign(x);
      return prism(
        [
          [sign * 12.2, 24],
          [sign * 12.2, 28.2],
          [outerX, 28.2],
          [outerX, 27.4],
        ],
        3,
        y - 1.5,
        'y',
      );
    }),
  );
}

/** A local rounded anchor, embedded in the same end wall as the shell. */
export function lanyardAnchor(): Shape {
  const footprint = [
    ...Array.from({ length: 49 }, (_, i): [number, number] => {
      const angle = (i * Math.PI) / 48;
      return [-anchorRadius * Math.cos(angle), cordBendCenter - anchorRadius * Math.sin(angle)];
    }),
    [anchorRadius, 18],
    [-anchorRadius, 18],
  ] as [number, number][];
  return {
    kind: 'intersect',
    children: [
      prism(
        footprint.map(([u, v]) => cornerPoint(u, v).slice(0, 2) as [number, number]),
        10.2,
        1.8,
      ),
      // Keep the small bottom-SMA cradle entirely outside the cord passage.
      B(11.9, 14.2, 14, -15.05, 45.9, 0),
    ],
  };
}

/** One swept skin creates two short flared mouths and a smooth, self-supporting U. */
export function reinforcementCutouts(): Shape {
  return {
    kind: 'loft',
    rings: cordStations.map(({ center, direction, radius }) =>
      cordProfile(radius).map(([radial, height]): Vec => [
        center[0] + direction[1] * radial,
        center[1] - direction[0] * radial,
        center[2] + height,
      ]),
    ),
  };
}
