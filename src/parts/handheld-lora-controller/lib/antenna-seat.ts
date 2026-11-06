import { type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { B, C, move, rounded, subtract, union } from './shapes';
import type { Parameters } from '../../../core/types';
import { floorRootZ } from './case-datums';
import { article } from '../../rf-pigtail/lib/model';
import { casePrism, hex } from './shapes';

/** The keyed front flange sits inside the end wall; its mating thread remains exposed. */
export const antenna = {
  model: 'amphenol-095-902-545-100',
  position: [0, 50.2, 13] as Vec,
  rotation: [-90, 0, 0] as Vec,
  holeDiameter: 6.6,
  holeFlatHeight: 6.1,
  holeFlatOffset: 2.8,
  flatSide: 'bottom',
  seatOuterY: 50.2,
  seatInnerY: 48,
  panelThickness: 2.2,
  flangeAF: article.flangeAF,
  flangeThickness: article.flangeThickness,
  flangePocketAF: 11.4,
  flangePocketDepth: 2.4,
  flangePocketLeadAF: 12.2,
  flangePocketLeadDepth: 0.6,
  flangeSideClearance: 0.2,
  matingToolDiameter: 11,
  cradleOuterWidth: 22.2,
  cradleInnerWidth: 18,
  cradleBackY: 45.8,
  cradleFrontY: 48,
  recessMouthY: 52.6,
  cradleBottomZ: 1.8,
  cradleTopZ: 21,
  cradleWall: 2.1,
  toolWidth: 17,
  toolBackY: 45.4,
  toolFrontY: 47.45,
  toolBottomZ: 8.5,
  metalRearY: 40.19,
  shrinkLength: 12.7,
  shrinkClearanceDiameter: 3.1,
  routeBendRadius: 8,
  routeRise: 3.2,
  routeStartY: 39.99,
  routeEndZ: 16.2,
};

export const internalFpc = {
  id: 'internal-fpc-reference',
  frequencyMHz: 928,
  x: -6.2,
  y: -17.5,
  length: 38,
  width: 10,
  filmBottomZ: 27.3,
  filmTopZ: 27.6,
  filmThickness: 0.3,
  feedY: -34.5,
  feedWidth: 3,
  feedLength: 4,
  feedBottomZ: 25.6,
  feedThickness: 2,
};

export function internalFpcLayout(p: Parameters) {
  return { ...internalFpc, x: p.bodyModel === 'web-grip' ? 2.4 : internalFpc.x };
}

export function antennaLayout(p: Parameters) {
  const external = p.antennaType === 'external',
    top = external && p.externalMount !== 'bottom',
    compact = top && p.externalMount === 'compact-top',
    seatY = top ? -50 : antenna.seatOuterY,
    innerY = seatY + 2.2;
  return {
    ...antenna,
    mode: String(p.antennaType),
    mount: String(p.externalMount),
    external,
    top,
    compact,
    position: (top ? [0, seatY, 7.8] : antenna.position) as Vec,
    rotation: (top ? [90, -30, 0] : antenna.rotation) as Vec,
    flatSide: top ? 'upper-left · rotated 30 degrees' : 'bottom',
    seatOuterY: seatY,
    seatInnerY: top ? innerY : antenna.seatInnerY,
    recessMouthY: top ? -52.6 : antenna.recessMouthY,
    flangeFrontY: top ? seatY - article.flangeThickness : seatY + article.flangeThickness,
    minimumFlangeRecess: 0.4,
    matingFaceY: top ? seatY - article.front : seatY + article.front,
    minimumMatingThreadStandout: article.front - (top ? 3 : 2.8),
    retainerRelief:
      external && !top
        ? { width: 4.2, length: 11, radius: 2.1, x: 0, y: 32.45, z: 11.8, height: 4 }
        : null,
    cradleLoadPaths:
      external && !top
        ? [
            {
              id: 'left-lower-inner',
              min: [-9.6, 45.9, 2.1] as Vec,
              max: [-7.5, 47.9, 8.45] as Vec,
              minimumWidth: 2.1,
            },
            {
              id: 'left-upper-original',
              min: [-11.1, 45.9, 8.45] as Vec,
              max: [-9, 47.9, 19.4] as Vec,
              minimumWidth: 2.1,
            },
            {
              id: 'right-original',
              min: [9, 45.9, 2.1] as Vec,
              max: [11.1, 47.9, 19.4] as Vec,
              minimumWidth: 2.1,
            },
          ]
        : null,
    cradleBackY: top ? innerY : antenna.cradleBackY,
    cradleFrontY: top ? -45.5 : antenna.cradleFrontY,
    cradleOuterWidth: top ? 18.2 : antenna.cradleOuterWidth,
    cradleInnerWidth: top ? 12.6 : antenna.cradleInnerWidth,
    cradleTopZ: top ? 15.8 : antenna.cradleTopZ,
    cradleRearTopZ: top ? 14 : 19.5,
    toolBackY: top ? -47.7 : antenna.toolBackY,
    toolFrontY: top ? -45.5 : antenna.toolFrontY,
    toolBottomZ: top ? 4 : antenna.toolBottomZ,
    toolAxis: top ? 'y' : 'z',
    toolOuterDiameter: top ? 11 : 0,
    axialTool: {
      outerDiameter: 11,
      innerDiameter: 6.6,
      startY: innerY + 2.1,
      endY: -38,
      centerX: 0,
      centerZ: 7.8,
    },
    tunnelDiameter: top ? 11.4 : 0,
    tunnelStartY: innerY,
    tunnelEndY: -38,
    metalRearY: top ? seatY + 10.01 : antenna.metalRearY,
    internalFpc: internalFpcLayout(p),
    shrinkPath: antennaShrinkPath().map(([x, y, z]): Vec =>
      top ? [x, -y + (seatY + antenna.seatOuterY), z + 7.8 - antenna.position[2]] : [x, y, z],
    ),
  };
}

/** Illustrative film and local feed envelope; not a selected purchased antenna. */
export function internalFpcEnvelope(p: Parameters): Shape {
  const a = internalFpcLayout(p);
  return union(
    B(a.width, a.length, a.filmThickness, a.x, a.y, a.filmBottomZ),
    B(a.feedWidth, a.feedLength, a.feedThickness, a.x, a.feedY, a.feedBottomZ),
  );
}

/** Internal stock supports a recessed keyed flange without an exterior mounting collar. */
export function antennaCradle(p: Parameters): Shape {
  const d = antennaLayout(p);
  const rearEndY = d.top ? d.cradleFrontY : d.cradleBackY,
    frontY = (d.recessMouthY + d.seatInnerY) / 2,
    frontDepth = Math.abs(d.recessMouthY - d.seatInnerY),
    backY = (rearEndY + d.seatInnerY) / 2,
    backDepth = Math.abs(rearEndY - d.seatInnerY) + 0.2,
    cheekWidth = (d.cradleOuterWidth - d.cradleInnerWidth) / 2,
    stock = union(
      B(d.cradleOuterWidth, frontDepth, d.cradleTopZ - floorRootZ, 0, frontY, floorRootZ),
      B(d.cradleOuterWidth, backDepth, 2.1, 0, backY, floorRootZ),
      ...[-1, 1].map((sign) =>
        B(
          cheekWidth,
          backDepth,
          d.cradleRearTopZ - floorRootZ,
          (sign * (d.cradleInnerWidth + cheekWidth)) / 2,
          backY,
          floorRootZ,
        ),
      ),
      // The adjacent lanyard U removes the outboard part of the left cheek.
      // Root its lower load path inboard while retaining the spanner approach
      // above Z=8.5; the original full-width cheek resumes above the U roof.
      ...(!d.top ? [B(1.7, backDepth, 8.45 - floorRootZ, -8.35, backY, floorRootZ)] : []),
    );
  return {
    kind: 'intersect',
    children: [stock, casePrism(0, floorRootZ, d.cradleTopZ - floorRootZ)],
  };
}

/** A full-depth hex pocket resists antenna torque; the barrel retains its drawing D key. */
export function antennaCutout(p: Parameters): Shape {
  const d = antennaLayout(p);
  return move(
    union(
      subtract(C(antenna.holeDiameter, 8, -4), B(16, 16, 12, 0, 10.8, -6)),
      hex(antenna.flangePocketAF, 0, 10, 0, 0),
      {
        kind: 'loft',
        rings: [
          [2, antenna.flangePocketAF],
          [2.6, antenna.flangePocketLeadAF],
          [10, antenna.flangePocketLeadAF],
        ].map(([z, af]) =>
          Array.from({ length: 6 }, (_, i): Vec => {
            const a = Math.PI / 6 + (i * Math.PI) / 3;
            return [(af / Math.sqrt(3)) * Math.cos(a), (af / Math.sqrt(3)) * Math.sin(a), z];
          }),
        ),
      },
    ),
    d.position,
    d.rotation,
  );
}

/** Axial washer/nut-driver clearance preserves the keyed seat and power-key retaining web. */
export function upperAntennaTunnel(p: Parameters): Shape {
  const d = antennaLayout(p);
  return move(
    C(d.tunnelDiameter, d.tunnelEndY - d.tunnelStartY, 0),
    [0, d.tunnelEndY, 7.8],
    [90, 0, 0],
  );
}

/** The USB-end pigtail passes the removable retainer through a rounded centre notch. */
export function antennaRetainerRelief(p: Parameters): Shape | null {
  const d = antennaLayout(p).retainerRelief;
  return d ? rounded(d.width, d.length, d.radius, d.z, d.height, d.x, d.y) : null;
}

/** Authored clearance reservation for the flexible shrink, not a supplier bend-radius rating. */
export function antennaShrinkPath(): Vec[] {
  const radius = antenna.routeBendRadius,
    angle = Math.acos(1 - antenna.routeRise / (2 * radius)),
    halfRun = radius * Math.sin(angle),
    points: Vec[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (angle * i) / 24;
    points.push([
      0,
      antenna.routeStartY - radius * Math.sin(a),
      antenna.position[2] + radius * (1 - Math.cos(a)),
    ]);
  }
  for (let i = 1; i <= 24; i++) {
    const a = angle * (1 - i / 24);
    points.push([
      0,
      antenna.routeStartY - 2 * halfRun + radius * Math.sin(a),
      antenna.routeEndZ - radius * (1 - Math.cos(a)),
    ]);
  }
  const arcLength = 2 * radius * angle;
  points.push([
    0,
    antenna.routeStartY - 2 * halfRun - (antenna.shrinkLength - arcLength),
    antenna.routeEndZ,
  ]);
  return points;
}
