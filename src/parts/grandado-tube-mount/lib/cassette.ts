import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import {
  connectorReliefs,
  antennaRelief,
  layout,
  move,
  tubeCylinder,
  type Layout,
  type PrintedPiece,
} from './spec';
import {
  cableClosingReliefs,
  cableRouteEnvelope,
  cassetteCableReliefs,
  upperCageCableReliefs,
} from './cable-routing';

export const cassetteAllowances = {
  cageWall: 3,
  bodyWall: 3,
  bodySeat: 3.2,
  mainStemWidth: 3,
  mainStemHeight: 3.2,
  mainFlangeWidth: 6,
  mainFlangeHeight: 4,
  clearance: 0.2,
  keeperUpright: 3,
  keeperHook: 3,
  keeperGuideRoof: 3,
  holderFloor: 3,
} as const;
const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const cuboid = (min: Vec, max: Vec): Shape =>
  box(max.map((value, index) => value - min[index]) as Vec, min);

export function cassetteContactSpec(p: Parameters) {
  const d = layout(p),
    a = cassetteAllowances;
  const endHalfDepth = Math.min(7, (d.mountPitch - d.boxLength) / 2 - d.fit);
  const coreHalfLength = d.mountPitch / 2 + endHalfDepth;
  const joinZ = d.cassetteJoinZ;
  const roofTop = d.holderTop + 3.2,
    minZ = d.holderBottom + 19.14;
  const wireRadius = d.powerCableDiameter / 2 + d.connectorClearance;
  const beamBottom = d.holderTop - wireRadius - 6.5;
  const beamInnerY = d.holderWidth / 2 + d.fit + 0.3;
  const uprightOuterY = beamInnerY + 3,
    hookOuterY = beamInnerY + 6.75;
  const hookTop = beamBottom + 3,
    gap = a.clearance;
  const flangeTop = joinZ - a.mainStemHeight,
    flangeBottom = flangeTop - a.mainFlangeHeight;
  const trackY = Math.min(
    35,
    Math.sqrt((d.cassetteRadius - 3.1) ** 2 - (flangeTop + gap) ** 2) - a.mainFlangeWidth / 2 - gap,
  );
  const endKeyPockets = ([-1, 1] as const).flatMap((side) =>
    [-25, 25].map((y) => ({
      side,
      min: [side < 0 ? -coreHalfLength - 0.1 : coreHalfLength - 7, y - 4.3, -26.3] as Vec,
      max: [side < 0 ? -coreHalfLength + 7 : coreHalfLength + 0.1, y + 4.3, -17.7] as Vec,
    })),
  );
  return {
    upperHalfId: 'upper-cylinder-shell',
    lowerHalfIds: ['lower-cylinder-negative', 'lower-cylinder-positive'],
    lowerServiceDirections: [
      {
        id: 'lower-cylinder-negative',
        sign: -1,
        approach: [-1, 0, 0] as Vec,
        seatingDirection: [1, 0, 0] as Vec,
      },
      {
        id: 'lower-cylinder-positive',
        sign: 1,
        approach: [1, 0, 0] as Vec,
        seatingDirection: [-1, 0, 0] as Vec,
      },
    ],
    keeperId: 'cell-keeper-bridge',
    coreHalfLength,
    coreClosureRadius: 37.7,
    serviceOvertravel: 0,
    joinZ,
    cageRadius: d.cassetteRadius,
    cageWall: 3,
    floorBottom: roofTop + 0.1,
    floorTop: d.boxBottom,
    earCapture: {
      lowerZ: d.boxBottom,
      upperZ: d.earPocketTop,
      earTop: d.earTop,
      clearance: d.earClearance,
      ceilingThickness: joinZ + 3.2 - d.earPocketTop,
      centersX: d.mountXs,
    },
    trackEngagement: 4,
    trackClearance: gap,
    tracks: {
      centersY: [-trackY, trackY],
      stemWidth: 3,
      stemHeight: 3.2,
      flangeWidth: 6,
      flangeBottom,
      flangeTop,
      maleStartX: -coreHalfLength,
      maleEndX: coreHalfLength,
      channelStartX: -coreHalfLength - 0.2,
      channelEndX: coreHalfLength + 0.2,
    },
    keeperRails: {
      beamInnerY,
      uprightOuterY,
      hookOuterY,
      beamBottom,
      hookTop,
      roofTop,
      hookHalfLength: Math.min(42, coreHalfLength - 12),
      clearance: gap,
      channelBottom: beamBottom - gap,
      channelRoofBottom: hookTop + gap,
      channelRoofTop: hookTop + gap + 3,
      channelInnerTop: roofTop + gap,
      channelStartX: -coreHalfLength - 0.2,
      channelEndX: coreHalfLength + 0.2,
      minimumRoof: 3,
      minimumFloor: 3,
      continuousCableWeb: 6.5,
    },
    keeperClosureFaces: ([-1, 1] as const).flatMap((side) =>
      [-1, 1].map((sy) => ({
        side,
        x: side * coreHalfLength,
        minY: sy < 0 ? -uprightOuterY : beamInnerY,
        maxY: sy < 0 ? -beamInnerY : uprightOuterY,
        minZ: beamBottom,
        maxZ: roofTop,
        area: 3 * (roofTop - beamBottom),
      })),
    ),
    endKeyPockets,
    holderPocket: {
      length: d.holderLength + 2 * d.fit,
      width: d.holderWidth + 2 * d.fit,
      floorBottom: d.holderBottom - 3,
      floorTop: d.holderBottom,
      roofStop: d.holderTop + 0.15,
      endStopXs: [-d.holderLength / 2 - d.fit, d.holderLength / 2 + d.fit],
    },
    cellCenters: [-d.cellPitch, 0, d.cellPitch].map((y) => [0, y, d.cellCenterZ] as Vec),
    cellRadius: d.cellRadius,
    cellLength: d.cellLength,
    cellEndStops: [-d.cellLength / 2 - 0.2, d.cellLength / 2 + 0.2],
    keeperMinZ: minZ,
    cableSkinTies: [-20, 20].map((x) => ({
      min: [x - 3, -3, -d.cassetteRadius] as Vec,
      max: [x + 3, 3, d.holderBottom - 3 + 0.2] as Vec,
    })),
    keeperRoofTop: roofTop,
    keeperArcRadius: d.cellRadius,
    minimumStructure: 3,
  };
}
type Contact = ReturnType<typeof cassetteContactSpec>;

function skin(d: Layout, c: Contact, minZ: number, maxZ: number): Shape {
  return intersect(
    subtract(
      tubeCylinder(d, 2 * c.coreHalfLength),
      tubeCylinder(d, 2 * c.coreHalfLength + 2, d.cassetteRadius - 3),
    ),
    box(
      [2 * c.coreHalfLength + 2, 2 * d.innerRadius + 2, maxZ - minZ],
      [-c.coreHalfLength - 1, -d.innerRadius - 1, minZ],
    ),
  );
}

function bodyWalls(d: Layout): Shape {
  const w = d.boxWidth + 2 * d.fit,
    l = d.boxLength + 2 * d.fit;
  return subtract(
    box([l + 6, w + 6, 10], [-l / 2 - 3, -w / 2 - 3, d.boxBottom]),
    box([l, w, 10.4], [-l / 2, -w / 2, d.boxBottom - 0.2]),
    box([l + 8, 28, 10.4], [-l / 2 - 4, -14, d.boxBottom - 0.2]),
  );
}

function upperCage(p: Parameters, d: Layout, c: Contact): Shape {
  const halfDepth = c.coreHalfLength - d.mountPitch / 2;
  const solids: Shape[] = [skin(d, c, c.joinZ, d.cassetteRadius + 1), bodyWalls(d)];
  for (const side of [-1, 1])
    solids.push(
      box([2 * c.coreHalfLength, 14, 3.2], [-c.coreHalfLength, side < 0 ? -43 : 29, c.joinZ]),
    );
  for (const x of d.mountXs) {
    solids.push(
      intersect(
        tubeCylinder(d, 2 * c.coreHalfLength),
        box(
          [2 * halfDepth, 2 * d.innerRadius, d.innerRadius - c.joinZ + 1],
          [x - halfDepth, -d.innerRadius, c.joinZ],
        ),
      ),
    );
    // Broad ceilings capture the supplied ears; no internal screws or nut pockets.
    solids.push(
      box(
        [2 * halfDepth, 28, c.joinZ + 3.2 - d.earPocketTop],
        [x - halfDepth, -14, d.earPocketTop],
      ),
    );
  }
  const t = c.tracks;
  for (const y of t.centersY)
    solids.push(
      union(
        box(
          [2 * c.coreHalfLength, t.stemWidth, t.stemHeight + 0.2],
          [-c.coreHalfLength, y - t.stemWidth / 2, t.flangeTop - 0.1],
        ),
        box(
          [2 * c.coreHalfLength, t.flangeWidth, 4],
          [-c.coreHalfLength, y - t.flangeWidth / 2, t.flangeBottom],
        ),
      ),
    );
  const raw = intersect(union(...solids), tubeCylinder(d, 2 * c.coreHalfLength));
  return subtract(
    raw,
    box(
      [d.boxLength + 2 * d.fit, d.boxWidth + 2 * d.fit, d.innerRadius + 4],
      [-d.boxLength / 2 - d.fit, -d.boxWidth / 2 - d.fit, d.boxBottom],
    ),
    ...connectorReliefs(d),
    ...antennaRelief(d),
    ...upperCageCableReliefs(p),
  );
}

function lowerCage(p: Parameters, d: Layout, c: Contact): Shape {
  const r = c.keeperRails,
    a = cassetteAllowances,
    h = c.coreHalfLength;
  const pocketHalf = c.holderPocket.width / 2;
  const solids: Shape[] = [
    skin(d, c, -d.cassetteRadius, c.joinZ),
    box(
      [c.holderPocket.length, c.holderPocket.width, 3],
      [-c.holderPocket.length / 2, -pocketHalf, d.holderBottom - 3],
    ),
  ];
  // The two open bottom troughs must not detach the central cylindrical strip.
  // Each lower half is tied into its holder floor with full 6 x 6 mm stock.
  solids.push(...c.cableSkinTies.map((tie) => cuboid(tie.min, tie.max)));
  // Full-height 3 mm webs join the floor side faces into the curved skin; the pocket stays narrow.
  for (const side of [-1, 1]) {
    solids.push(
      box(
        [c.holderPocket.length, 3, 8],
        [-c.holderPocket.length / 2, side < 0 ? -pocketHalf - 3 : pocketHalf, d.holderBottom - 3],
      ),
    );
    solids.push(
      box(
        [2 * h, d.innerRadius - r.beamInnerY + 1, c.joinZ - (r.beamBottom - 3.2)],
        [-h, side < 0 ? -d.innerRadius - 1 : r.beamInnerY, r.beamBottom - 3.2],
      ),
    );
    // Positive support directly below the Grandado floor; the keeper roof passes 0.1 mm below.
    solids.push(
      box(
        [2 * h, 4, d.boxBottom - (c.keeperRoofTop + 0.1)],
        [-h, side < 0 ? -29 : 25, c.keeperRoofTop + 0.1],
      ),
    );
  }
  const halfDepth = h - d.mountPitch / 2;
  for (const x of d.mountXs)
    solids.push(
      box(
        [2 * halfDepth, 2 * (d.innerRadius - 1), d.boxBottom - (c.keeperRoofTop + 0.1)],
        [x - halfDepth, -d.innerRadius + 1, c.keeperRoofTop + 0.1],
      ),
    );
  // Massive torque-key lands: every flat wall around an 8.6 mm pocket is at least 3.2 mm.
  for (const slot of c.endKeyPockets) {
    const y = (slot.min[1] + slot.max[1]) / 2;
    solids.push(box([12, 15, 15], [slot.side < 0 ? -h : h - 12, y - 7.5, -29.5]));
  }
  const cuts: Shape[] = [
    ...connectorReliefs(d),
    ...antennaRelief(d),
    ...cassetteCableReliefs(p),
    ...c.endKeyPockets.map((v) => cuboid(v.min, v.max)),
  ];
  // The full-length body entry also removes the disconnected inboard track lips.
  // Opposed outboard roofs retain the thick male flanges; the floor stays a positive support.
  const t = c.tracks,
    g = c.trackClearance;
  const bodyOuterW = d.boxWidth + 2 * d.fit + 6;
  const entryHalfWidth = Math.max(
    bodyOuterW / 2 + 0.2,
    Math.abs(t.centersY[1]) - t.stemWidth / 2 - g + 0.1,
  );
  cuts.push(
    box(
      [2 * h + 0.4, 2 * entryHalfWidth, c.joinZ + 2 - d.boxBottom],
      [-h - 0.2, -entryHalfWidth, d.boxBottom],
    ),
  );
  for (const y of t.centersY)
    cuts.push(
      box(
        [2 * h + 0.4, t.stemWidth + 2 * g, t.stemHeight + 2 * g],
        [-h - 0.2, y - t.stemWidth / 2 - g, t.flangeTop - g],
      ),
      box(
        [2 * h + 0.4, t.flangeWidth + 2 * g, 4 + 2 * g],
        [-h - 0.2, y - t.flangeWidth / 2 - g, t.flangeBottom - g],
      ),
    );
  for (const side of [-1, 1]) {
    const flangeMin = side < 0 ? -r.hookOuterY - g : r.beamInnerY - g;
    cuts.push(
      box(
        [2 * h + 0.4, r.hookOuterY - r.beamInnerY + 2 * g, 3 + 2 * g],
        [-h - 0.2, flangeMin, r.beamBottom - g],
      ),
    );
    const uprightMin = side < 0 ? -r.uprightOuterY - g : r.beamInnerY - g;
    cuts.push(
      box(
        [2 * h + 0.4, 3 + 2 * g, c.keeperRoofTop + g - (r.hookTop + g)],
        [-h - 0.2, uprightMin, r.hookTop + g],
      ),
    );
  }
  return intersect(subtract(union(...solids), ...cuts), tubeCylinder(d, 2 * h));
}

function keeperBridge(p: Parameters, d: Layout, c: Contact): Shape {
  const r = c.keeperRails,
    h = c.coreHalfLength;
  const halfHolder = d.holderLength / 2 + d.fit,
    endWallOuter = halfHolder + 3;
  const halfPlate = r.beamInnerY + 0.1;
  const solids: Shape[] = [
    box(
      [2 * endWallOuter, 2 * halfPlate, c.keeperRoofTop - c.holderPocket.roofStop],
      [-endWallOuter, -halfPlate, c.holderPocket.roofStop],
    ),
  ];
  for (const side of [-1, 1]) {
    // Full-length massive upright tails are inside the R37.7 disc shoulders.
    solids.push(
      box(
        [2 * h, 3, c.keeperRoofTop - r.beamBottom],
        [-h, side < 0 ? -r.uprightOuterY : r.beamInnerY, r.beamBottom],
      ),
    );
    // Hook engagement is central; the end tails need no outboard projection beyond the solid disc shoulder.
    solids.push(
      box(
        [2 * r.hookHalfLength, r.hookOuterY - r.beamInnerY, 3],
        [-r.hookHalfLength, side < 0 ? -r.hookOuterY : r.beamInnerY, r.beamBottom],
      ),
    );
    const minX = side < 0 ? -35.8 : 24.5,
      maxX = side < 0 ? -24.5 : 35.8;
    solids.push(
      box(
        [maxX - minX, 2 * halfPlate, c.keeperRoofTop - c.keeperMinZ],
        [minX, -halfPlate, c.keeperMinZ],
      ),
    );
    // End walls retain the holder independently of its springs and of cell-to-holder friction.
    solids.push(
      box(
        [3, c.holderPocket.width - 0.4, c.keeperRoofTop - (d.holderBottom + 3)],
        [
          side < 0 ? -endWallOuter : halfHolder,
          -(c.holderPocket.width - 0.4) / 2,
          d.holderBottom + 3,
        ],
      ),
    );
  }
  const raw = union(...solids);
  const cuts: Shape[] = [
    ...connectorReliefs(d),
    cableRouteEnvelope(p),
    cableClosingReliefs(p),
    ...c.cellCenters.map(([, y, z]) => cylinder(c.keeperArcRadius, 65.6, [-32.8, y, z], 'x')),
    box([3.4, 8, 11], [-endWallOuter - 0.2, -4, d.holderBottom - 1]),
  ];
  return subtract(raw, ...cuts);
}

export function cassettePieces(p: Parameters): PrintedPiece[] {
  const d = layout(p),
    c = cassetteContactSpec(p),
    upper = upperCage(p, d, c),
    lower = lowerCage(p, d, c),
    keeper = keeperBridge(p, d, c);
  return [
    {
      id: c.upperHalfId,
      label: 'Upper cylindrical body cage · massive passive ear ceilings',
      shape: upper,
      printShape: move(upper, [0, 0, c.coreHalfLength], [0, -90, 0]),
      color: 0x7795aa,
      role: 'cassette',
    },
    ...([-1, 1] as const).map((sign, index): PrintedPiece => {
      const shape = intersect(
        lower,
        box(
          [c.coreHalfLength, 2 * d.innerRadius + 2, 2 * d.innerRadius + 2],
          [sign < 0 ? -c.coreHalfLength : 0, -d.innerRadius - 1, -d.innerRadius - 1],
        ),
      );
      return {
        id: c.lowerHalfIds[index],
        label:
          sign < 0
            ? 'Negative-X lower cylinder · integrated holder floor'
            : 'Positive-X lower cylinder · integrated holder floor',
        shape,
        printShape: move(shape, [0, 0, c.coreHalfLength], [0, sign < 0 ? -90 : 90, 0]),
        color: 0x4f6f82,
        role: 'cassette',
      };
    }),
    {
      id: c.keeperId,
      label: 'Screw-free battery keeper lid · rigid can roofs, end stops and L rails',
      shape: keeper,
      printShape: move(keeper, [0, 0, c.keeperRoofTop], [180, 0, 0]),
      color: 0xc5a86b,
      role: 'cassette',
    },
  ];
}
