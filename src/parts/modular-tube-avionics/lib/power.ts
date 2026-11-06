import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import ups, { upsInterface } from '../../waveshare-ups-3s/part';
import holder from '../../li-ion-battery-holder/part';
import connector from '../../electrical-connector/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import { at, datums, endDiscs, intersect, purchased, type PrintedItem } from './shared';
import { holderUnitObservation, holderFitAllowances } from './holder-fit';

export const powerLibraries: PartDefinition[] = [ups, holder, connector, bolt, nut, washer];

/** Packing study: 93 mm UPS plus connector bay, end stops and two 10 mm discs. */
export const powerPacking = {
  minimumLength: 130,
  upsLeadingOffset: 22,
  upsLength: 93,
  holderLength: 77.7,
} as const;
const frontX = datums.power.front,
  backX = datums.power.back,
  innerFrontX = frontX + datums.discThickness,
  innerLength = backX - frontX - 2 * datums.discThickness,
  upsFrontX = frontX + powerPacking.upsLeadingOffset,
  upsBackX = upsFrontX + powerPacking.upsLength,
  centerX = (upsFrontX + upsBackX) / 2,
  holderFrontX = centerX - powerPacking.holderLength / 2,
  holderBackX = centerX + powerPacking.holderLength / 2,
  contactFrontX = centerX - 12.5,
  contactLength = 25,
  holderBottomZ = -25.7,
  referenceCellDiameter = 18.6,
  upsPcbUndersideZ = 24.2;
const upsRotation: [number, number, number] = [0, 0, 180];

function installedUpsCellCenter(local: readonly number[]): [number, number, number] {
  const angle = (upsRotation[2] * Math.PI) / 180;
  return [
    centerX + local[0] * Math.cos(angle) - local[1] * Math.sin(angle),
    local[0] * Math.sin(angle) + local[1] * Math.cos(angle),
    upsPcbUndersideZ + local[2],
  ];
}

/** Measured mounting envelope only; the purchased holder proxy is unchanged. */
export const holderMountFit = {
  bodyFrontX: centerX - holderUnitObservation.body.length / 2,
  bodyBackX: centerX + holderUnitObservation.body.length / 2,
  bodyBottomZ: holderBottomZ,
  bodyTopZ: holderBottomZ + holderUnitObservation.body.height,
  cellPitch: (holderUnitObservation.bankOuterWidth - referenceCellDiameter) / 2,
  cellCenterZ:
    holderBottomZ +
    holderUnitObservation.body.height -
    holderUnitObservation.cellTopBelowRim -
    referenceCellDiameter / 2,
  terminalEndZ: holderBottomZ - holderUnitObservation.legs.length,
  slotFrontX:
    centerX - holderUnitObservation.body.length / 2 - holderFitAllowances.terminalSlotEndAllowance,
  slotLength: holderUnitObservation.body.length + 2 * holderFitAllowances.terminalSlotEndAllowance,
  slotWidth: holderFitAllowances.terminalSlotWidth,
  bodyEndGap: holderFitAllowances.axialBodyGap,
  completeProductFitVerified: false,
} as const;

/** Shared rear anchor and its short carrier-side transport stops. */
export const powerRearAnchor = {
  faceX: backX - datums.discThickness,
  axisX: backX - datums.discThickness + datums.anchorOffsetX,
  pocketAF: 5.8,
  pocketInnerY: 34,
  pocketOuterY: 36.8,
  mouthBottomZ: -3.25,
  mouthTopZ: 3.6,
  capInnerY: 30.2,
  capOuterY: 40,
  capBottomZ: 1,
  capTopZ: 9,
  noseInnerY: 34.2,
  noseOuterY: 36.6,
  noseBottomZ: 1,
  noseTopZ: 3.4,
} as const;

/** Generic fitting witnesses only; no cell manufacturer or procurement is selected. */
export const powerCellFit = {
  referenceDiameter: referenceCellDiameter,
  referenceLength: 65.2,
  smallerDiameter: 18,
  smallerLength: 65,
  terminalExclusion: 8,
  linerLength: contactLength,
  linerBanks: ['holder'] as const,
  contactStartX: contactFrontX,
  contactEndX: contactFrontX + contactLength,
  separatorZ: [-2, 1] as const,
  backupPlanesZ: { ups: 2.5, holder: -3.96 },
  loadingOffsetX: 0,
  seats: [
    // Preserve the global row order while deriving every witness from the
    // purchased library's authored seat datum and its real occurrence pose.
    ...[...upsInterface.cellSeats].reverse().map((seat, i) => ({
      id: `power-ups-cell-reference-${i + 1}`,
      bank: 'ups' as const,
      center: installedUpsCellCenter(seat.center),
      opening: [0, 0, -1] as [number, number, number],
    })),
    ...[-holderMountFit.cellPitch, 0, holderMountFit.cellPitch].map((y, i) => ({
      id: `power-holder-cell-reference-${i + 1}`,
      bank: 'holder' as const,
      center: [centerX, y, holderMountFit.cellCenterZ] as [number, number, number],
      opening: [0, 0, 1] as [number, number, number],
    })),
  ],
} as const;

/** Fixed supplier products remain in their own local frames; X follows the cell axes. */
export const powerInterface = {
  module: { frontX, backX, length: backX - frontX, minimumLength: powerPacking.minimumLength },
  ups: {
    centerX,
    pcbUndersideZ: upsPcbUndersideZ,
    // Proper rotation keeps the source battery face down and puts its sockets
    // at the forward XT60 panel. Never mirror the purchased product geometry.
    rotation: upsRotation,
    bounds: [
      [upsFrontX, -30, 2.7],
      [upsBackX, 30, 30.8],
    ],
  },
  holder: {
    centerX,
    undersideZ: holderBottomZ,
    bounds: [
      [holderFrontX, -29.845, holderBottomZ],
      [holderBackX, 29.845, -4.16],
    ],
  },
  connector: {
    flangeRearX: frontX,
    centersZ: [-10, 14],
    openingWidth: 19.3,
    openingHeight: 11.85,
    openingRadius: 3.9,
    mountingPitch: 25,
    nutBearingX: innerFrontX - 2.8,
    nutPocketAF: 5.8,
  },
  cradleSideInnerY: 30.2,
  cradleSideOuterY: 33.2,
  cellRetention: {
    bank: 'holder',
    nominalRadialInterference: 0.1,
    linerRadius: 9.2,
    contactHalfWidth: 7,
    backupHalfWidth: 4,
    loadingOffsetX: 0,
    lowerSupportTopZ: holderBottomZ,
  },
} as const;

const item = (
  id: string,
  name: string,
  shape: Shape,
  material: PrintedItem['material'] = 'PETG',
  printRotation: PrintedItem['printRotation'] = [0, 0, 0],
): PrintedItem => ({ id, name, shape, material, module: 'power', printRotation });

/** Native straight-sided YZ section extruded along X, independent of preview resolution. */
function axialProfile(points: [number, number][], x: number, length: number): Shape {
  return at(prism(points, length, 0), [x, 0, 0], [90, 0, 90]);
}

/** The connector's local right end maps to -Y and retains two true R3.90 arcs. */
export function powerPanelOpening(x: number, length: number, centerZ: number): Shape {
  const { openingWidth: w, openingHeight: h, openingRadius: r } = powerInterface.connector;
  return union(
    box([length, w - r, h], [x, -w / 2 + r, centerZ - h / 2]),
    box([length, r, h - 2 * r], [x, -w / 2, centerZ - h / 2 + r]),
    ...[-1, 1].map((sign) =>
      cylinder(r, length, [x, -w / 2 + r, centerZ + sign * (h / 2 - r)], 'x'),
    ),
  );
}

/** Closed bearing sockets are separate from the unchanged square alignment keys. */
export const powerStructure = {
  bearingPlanesX: [innerFrontX, backX - datums.discThickness] as const,
  collarMaximumSideGap: 0.15,
  collarWall: 3,
  collarTopZ: 5.5,
  seatDepth: 4,
  pocketDepth: 4.4,
  upperPad: { innerY: 16.5, outerY: 24.5, bottomZ: 24.5, topZ: 31.3 },
  lowerPad: { innerY: 18, outerY: 31, bottomZ: -23, topZ: -13.8 },
  crossheadsX: [
    [contactFrontX - 10, contactFrontX],
    [contactFrontX + contactLength, contactFrontX + contactLength + 10],
  ] as const,
  foreEndX: [innerFrontX, innerFrontX + 9] as const,
  aftEndX: [backX - 14.5, backX - 10] as const,
  upperRailProfile: [
    [30.2, 1],
    [33.2, 1],
    [33.2, 26.6],
    [30.9, 28.9],
    [26.5, 28.9],
    [26.5, 25.8],
    [30.2, 25.8],
  ] as [number, number][],
  lowerPanProfile: [
    [-33.2, -2],
    [-33.2, -26.5],
    [-31, -28.7],
    [31, -28.7],
    [33.2, -26.5],
    [33.2, -2],
    [30.2, -2],
    [30.2, holderBottomZ],
    [-30.2, holderBottomZ],
    [-30.2, -2],
  ] as [number, number][],
} as const;

/** Delivered D1.5 insulated wire; two shallow guides retain the upper bearing floor. */
export const powerTerminalWiring = (() => {
  const floorBottomZ = Math.min(...powerStructure.lowerPanProfile.map(([, z]) => z));
  const floorTopZ = holderBottomZ;
  const wireDiameter = 1.5;
  const grooveRadius = 1;
  return {
    wireDiameter,
    grooveRadius,
    radialClearance: grooveRadius - wireDiameter / 2,
    floorBottomZ,
    floorTopZ,
    grooveCenterZ: floorBottomZ,
    grooveDepth: grooveRadius,
    remainingFloor: floorTopZ - floorBottomZ - grooveRadius,
    wireProtrusion: wireDiameter / 2,
    stationsX: [holderMountFit.bodyFrontX + 4, holderMountFit.bodyBackX - 4],
    startY: -holderMountFit.cellPitch,
    endY: holderMountFit.cellPitch,
    scope:
      'User-confirmed insulated wire OD only. Open underside guides link the existing full-length terminal slots; contact positions, solder joints, bend radius, strain relief and electrical circuit remain separate physical checks.',
  };
})();

/** Native semicircular underside grooves, not through-floor cuts. */
export function powerTerminalWireGrooves(): Shape[] {
  const d = powerTerminalWiring;
  return d.stationsX.map((x) =>
    cylinder(d.grooveRadius, d.endY - d.startY, [x, d.startY, d.grooveCenterZ], 'y'),
  );
}

/** D1.5 routing witnesses are fitting references, never purchased wire products. */
export function powerTerminalWireGauges(): { id: string; shape: Shape }[] {
  const d = powerTerminalWiring;
  return d.stationsX.map((x, index) => ({
    id: `power-holder-terminal-wire-${index + 1}`,
    shape: cylinder(d.wireDiameter / 2, d.endY - d.startY, [x, d.startY, d.grooveCenterZ], 'y'),
  }));
}

/** The liner takes up the selected pan-seat gap without changing the rigid fit. */
export function powerPanTakeUp(p?: Parameters) {
  const sideGap = Number(p?.keyClearance ?? 0.3) / 2;
  const residual = 0.1;
  const nominalOverlap = sideGap + residual;
  const bottomZ = -3.96;
  const topZ = -2;
  return {
    x: contactFrontX,
    length: contactLength,
    rootInnerY: 29,
    panInnerY: 30.2,
    outerY: 30.2 + nominalOverlap,
    bottomZ,
    topZ,
    entryRise: nominalOverlap,
    nominalOverlap,
    maximumSeatTravel: sideGap,
    minimumResidualOverlap: residual,
    // Two flat contacts plus their 45-degree lower entry triangles.
    expectedVolume:
      2 * contactLength * (nominalOverlap * (topZ - bottomZ) - nominalOverlap ** 2 / 2),
  };
}

function bearingPads(upper: boolean): Shape[] {
  const d = upper ? powerStructure.upperPad : powerStructure.lowerPad;
  return [-1, 1].flatMap((sign) =>
    [innerFrontX - 4, backX - 10].map((x) =>
      box(
        [4, d.outerY - d.innerY, d.topZ - d.bottomZ],
        [x, sign > 0 ? d.innerY : -d.outerY, d.bottomZ],
      ),
    ),
  );
}

function carrierSeatCuts(faceX: number, forward: boolean, p: Parameters): Shape[] {
  const fit = Number(p.keyClearance);
  return [powerStructure.upperPad, powerStructure.lowerPad].flatMap((d, index) =>
    [-1, 1].map((sign) =>
      box(
        [4.5, d.outerY - d.innerY + fit, d.topZ - d.bottomZ + fit],
        [
          forward ? faceX - 4.4 : faceX - 0.1,
          sign > 0 ? d.innerY - fit / 2 : -d.outerY - fit / 2,
          // Normal load faces stay at the seated datum; fit opens inward.
          d.bottomZ - (index === 0 ? fit : 0),
        ],
      ),
    ),
  );
}

function forwardDisc(p: Parameters): PrintedItem {
  const base = endDiscs('power', frontX, backX, p)[0];
  // The connector's local X maps to -Y when +Z mating points toward -X.
  const openings = powerInterface.connector.centersZ.map((z) =>
    powerPanelOpening(frontX - 1, 12, z),
  );
  return {
    ...base,
    name: 'Power forward keyed disc with two XT60E-F panel openings',
    shape: subtract(
      base.shape,
      ...openings,
      ...carrierSeatCuts(innerFrontX, true, p),
      ...powerInterface.connector.centersZ.flatMap((z) =>
        [-12.5, 12.5].map((y) => cylinder(1.7, 12, [frontX - 1, y, z], 'x')),
      ),
      // Rear-open seats react nut torque without an inaccessible wrench.
      ...powerInterface.connector.centersZ.flatMap((z) =>
        [-12.5, 12.5].map((y) =>
          axialProfile(
            Array.from({ length: 6 }, (_, i): [number, number] => {
              const angle = ((i + 0.5) * Math.PI) / 3;
              const radius = powerInterface.connector.nutPocketAF / Math.sqrt(3);
              return [y + radius * Math.cos(angle), z + radius * Math.sin(angle)];
            }),
            powerInterface.connector.nutBearingX,
            innerFrontX - powerInterface.connector.nutBearingX + 0.2,
          ),
        ),
      ),
    ),
  };
}

/** Power-facing bearing interfaces; the service hook rebuilds the integrated tail stock. */
function aftDisc(p: Parameters): PrintedItem {
  const base = endDiscs('power', frontX, backX, p)[1];
  return {
    ...base,
    name: 'Integrated 17 mm power aft closure and tail shield',
    shape: subtract(base.shape, ...carrierSeatCuts(backX - 10, false, p)),
  };
}

/** Source-relative plug/press envelopes, not selected mating connector products. */
export function powerServiceGauges(): { id: string; shape: Shape }[] {
  const local = [
    ...[15, 5, -5, -15].map((y, i) => ({
      id: `power-ups-socket-approach-${i + 1}`,
      shape: box([5.6, 6.6, 20], [40.7, y - 3.3, -27]),
    })),
    { id: 'power-ups-header-approach', shape: box([5.8, 10.8, 20], [-45.6, -17, -29]) },
    { id: 'power-ups-boot-approach', shape: cylinder(2.5, 20, [-42.7, 0.4, -22.6]) },
  ];
  return local.map(({ id, shape }) => ({
    id,
    shape: at(shape, [centerX, 0, powerInterface.ups.pcbUndersideZ], powerInterface.ups.rotation),
  }));
}

/** The stiff crossheads deliver barrel reactions to both continuous carrier walls. */
function mainFrame(p: Parameters): PrintedItem {
  const sideGap = Math.min(Number(p.keyClearance) / 2, powerStructure.collarMaximumSideGap);
  const outerY = 33.2 + sideGap + powerStructure.collarWall;
  const separator = box([innerLength, 66.4, 3], [innerFrontX, -33.2, -2]);
  const crossheads = powerStructure.crossheadsX.map(([a, b]) =>
    box([b - a, 2 * outerY, 6.46], [a, -outerY, -3.96]),
  );
  const collars = powerStructure.crossheadsX.flatMap(([a, b]) =>
    [-1, 1].map((sign) =>
      box(
        [b - a, powerStructure.collarWall, 9.46],
        [a, sign > 0 ? 33.2 + sideGap : -outerY, -3.96],
      ),
    ),
  );
  const backups = [
    ...[-19.5, 0, 19.5].map((y) => box([contactLength, 8, 1.5], [contactFrontX, y - 4, 1])),
    ...[-holderMountFit.cellPitch, 0, holderMountFit.cellPitch].map((y) =>
      box([contactLength, 8, 1.96], [contactFrontX, y - 4, -3.96]),
    ),
  ];
  // Thick side-box stops leave the actual underside sockets/header accessible.
  const stopStations: [number, number][] = [
    [holderFrontX - 10.35, 10],
    [holderBackX + 0.4, 7.4],
  ];
  const stops = stopStations.flatMap(([x, length]) =>
    [-1, 1].map((sign) => box([length, 9.2, 15.8], [x, sign > 0 ? 21 : -30.2, 1])),
  );
  const forwardNutCaps = [-1, 1].map((sign) =>
    union(
      box([3, 8.2, 7.66], [innerFrontX, sign > 0 ? 31.8 : -40, -3.96]),
      box([1.2, 2.4, 6], [innerFrontX - 1, sign > 0 ? 34.2 : -36.6, -3]),
    ),
  );
  return item(
    'power-main-frame',
    'Power separator spine with full-width bearing crossheads',
    subtract(
      union(separator, ...crossheads, ...collars, ...backups, ...stops, ...forwardNutCaps),
      ...powerServiceGauges().map((g) => g.shape),
    ),
    'PETG',
    [0, 0, 0],
  );
}

function upperCage(p: Parameters): PrintedItem {
  const fit = Number(p.keyClearance);
  const rails = [-1, 1].map((sign) =>
    axialProfile(
      sign > 0
        ? powerStructure.upperRailProfile
        : powerStructure.upperRailProfile.map(([y, z]): [number, number] => [-y, z]).reverse(),
      innerFrontX,
      innerLength,
    ),
  );
  const hoops = [powerStructure.foreEndX, powerStructure.aftEndX].map(([a, b]) => {
    const outer = cylinder(datums.radius, b - a, [a, 0, 0], 'x');
    const crown = intersect(
      subtract(outer, cylinder(datums.radius - 3, b - a + 2, [a - 1, 0, 0], 'x')),
      box([b - a, 66.4, 18.3], [a, -33.2, 24.5]),
    );
    const wings = [-1, 1].map((sign) =>
      intersect(outer, box([b - a, 16.7, 18.3], [a, sign > 0 ? 16.5 : -33.2, 24.5])),
    );
    const feet = [-1, 1].map((sign) => box([b - a, 13.2, 24.8], [a, sign > 0 ? 20 : -33.2, 1]));
    return union(crown, ...wings, ...feet);
  });
  const keySockets = [-1, 1].map((sign) =>
    box([4.5, 6 + fit, 6 + fit], [innerFrontX - 0.1, sign * 26 - 3 - fit / 2, 15 - fit / 2]),
  );
  const aftKeys = [-1, 1].map((sign) => box([4.2, 6, 6], [backX - 10.2, sign * 26 - 3, 15]));
  const crossheadSeats = powerStructure.crossheadsX.map(([a, b]) =>
    box([b - a, 80, 1.6], [a, -40, 0.9]),
  );
  const rearNutStops = [-1, 1].flatMap((sign) => {
    const d = powerRearAnchor;
    const [a, b] = powerStructure.aftEndX;
    const cap = box(
      [b - a, d.capOuterY - d.capInnerY, d.capTopZ - d.capBottomZ],
      [a, sign > 0 ? d.capInnerY : -d.capOuterY, d.capBottomZ],
    );
    // A single supporting hex flank gives a broad planar stop, without a thin
    // remnant above a copied hex cavity. The existing flat print datum is kept.
    const angle = ((sign > 0 ? 165 : 135) * Math.PI) / 180;
    const nx = Math.cos(angle),
      nz = Math.sin(angle);
    const endX = (z: number) => d.axisX + (d.pocketAF / 2 - nz * z) / nx;
    const nose = prism(
      [
        [d.faceX - 0.2, d.noseBottomZ],
        [endX(d.noseBottomZ), d.noseBottomZ],
        [endX(d.noseTopZ), d.noseTopZ],
        [d.faceX - 0.2, d.noseTopZ],
      ],
      d.noseOuterY - d.noseInnerY,
      sign > 0 ? d.noseInnerY : -d.noseOuterY,
      'y',
    );
    return [cap, nose];
  });
  return item(
    'power-upper-cage',
    'Power continuous upper Omega edge cage',
    subtract(
      union(...rails, ...hoops, ...aftKeys, ...bearingPads(true), ...rearNutStops),
      ...keySockets,
      ...crossheadSeats,
      box([4.6, 80, 5.3], [innerFrontX, -40, 0.9]),
    ),
    'PETG',
    [0, 0, 0],
  );
}

/** A full floor and two long walls replace all short holder-bearing fingers. */
function lowerPan(p: Parameters): PrintedItem {
  const fit = Number(p.keyClearance);
  const shell = axialProfile(powerStructure.lowerPanProfile, innerFrontX, innerLength);
  // Sink box roots inside both floor and walls; the finished envelope is unchanged.
  const endWalls = [powerStructure.foreEndX, powerStructure.aftEndX].map(([a, b]) =>
    box([b - a, 62.4, 25.2], [a, -31.2, -27.2]),
  );
  const bodyStops = [
    [
      powerStructure.foreEndX[1],
      holderMountFit.bodyFrontX - holderMountFit.bodyEndGap - powerStructure.foreEndX[1],
    ],
    [
      holderMountFit.bodyBackX + holderMountFit.bodyEndGap,
      powerStructure.aftEndX[0] - holderMountFit.bodyBackX - holderMountFit.bodyEndGap,
    ],
  ].flatMap(([x, length]) =>
    [-1, 1].map((sign) => box([length, 10.2, 25.2], [x, sign > 0 ? 21 : -31.2, -27.2])),
  );
  const foreKeyBoss = box([9, 12, 11.4], [innerFrontX, -6, -27.7]);
  const aftKey = box([4.2, 6, 6], [backX - 10.2, -3, -25]);
  const crossheadSeats = powerStructure.crossheadsX.map(([a, b]) =>
    box([b - a, 80, 2.06], [a, -40, -3.96]),
  );
  const portal = box([9.1, 33, 20], [innerFrontX - 0.05, -16.5, -21]);
  const terminalSlots = [-holderMountFit.cellPitch, 0, holderMountFit.cellPitch].map((y) =>
    box(
      [holderMountFit.slotLength, holderMountFit.slotWidth, holderUnitObservation.legs.length + 2],
      [
        holderMountFit.slotFrontX,
        y - holderMountFit.slotWidth / 2,
        holderMountFit.terminalEndZ - 1,
      ],
    ),
  );
  const base = subtract(
    union(shell, ...endWalls, ...bodyStops, ...bearingPads(false)),
    portal,
    ...crossheadSeats,
    box([4.6, 80, 4.3], [innerFrontX, -40, -6.2]),
    ...terminalSlots,
    ...powerTerminalWireGrooves(),
  );
  return item(
    'power-lower-pan',
    'Power continuous lower U pan with bearing end hoops',
    subtract(
      union(base, foreKeyBoss, aftKey),
      box([4.5, 6 + fit, 6 + fit], [innerFrontX - 0.1, -3 - fit / 2, -25 - fit / 2]),
    ),
    'PETG',
    [0, 0, 0],
  );
}

/** A continuous axial section has no free clips or unsupported inter-band bridges. */
function holderCellLiner(p: Parameters): PrintedItem {
  const seatsForBank = powerCellFit.seats.filter((seat) => seat.bank === 'holder');
  const ys = seatsForBank.map((seat) => seat.center[1]);
  const centerZ = seatsForBank[0].center[2];
  const takeUp = powerPanTakeUp(p);
  const heels = [-1, 1].map((sign) =>
    axialProfile(
      [
        [takeUp.rootInnerY, takeUp.bottomZ],
        [takeUp.panInnerY, takeUp.bottomZ],
        [takeUp.outerY, takeUp.bottomZ + takeUp.entryRise],
        [takeUp.outerY, takeUp.topZ],
        [takeUp.rootInnerY, takeUp.topZ],
      ].map(([y, z]): [number, number] => [sign * y, z]),
      takeUp.x,
      takeUp.length,
    ),
  );
  const base = box([contactLength, 60, 1.96], [contactFrontX, -30, -3.96]);
  const saddleBottomZ = centerZ + powerCellFit.referenceDiameter / 2 - 1.8;
  const saddleTopZ = -2;
  const saddles = ys.map((y) =>
    box([contactLength, 14, saddleTopZ - saddleBottomZ], [contactFrontX, y - 7, saddleBottomZ]),
  );
  const seats = ys.map((y) =>
    cylinder(
      powerInterface.cellRetention.linerRadius,
      contactLength + 2,
      [contactFrontX - 1, y, centerZ],
      'x',
    ),
  );
  // The full-width hard backups meet these sockets at the root of each soft seat.
  const backupSockets = ys.map((y) =>
    box([contactLength + 2, 8, 5], [contactFrontX - 1, y - 4, -3.96]),
  );
  return item(
    'power-holder-cell-liner',
    'Power holder upward cell barrel liner',
    subtract(union(base, ...saddles, ...heels), ...seats, ...backupSockets),
    'TPU',
    [0, -90, 0],
  );
}

/** Close the spine, cage and pan radially around the banks; fit both discs axially last. */
export function powerPrinted(p: Parameters): PrintedItem[] {
  return [
    forwardDisc(p),
    aftDisc(p),
    mainFrame(p),
    upperCage(p),
    lowerPan(p),
    // The delivered UPS dry fit already bears against the rigid spine. Added
    // TPU prevents closure; generic source-seat witnesses do not assert preload.
    holderCellLiner(p),
  ];
}

/** Cell-reference preload and physical pan take-up are separate, explicitly bounded contacts. */
export function powerContactSpecs(p?: Parameters) {
  const takeUp = powerPanTakeUp(p);
  return [
    ...powerCellFit.seats
      .filter((seat) => seat.bank === 'holder')
      .map((seat) => ({
        ids: ['power-holder-cell-liner', seat.id],
        expectedVolume: 28.91768848826,
        maximumVolume: 28.94,
        interference: 0.1,
        direction:
          'Nominal D18.6 barrel, R9.2 formed TPU seat; user-measured rim-recess fitting datum',
        scope:
          'Generic reference only. Smaller cans require a physical fit coupon/liner adjustment for preload.',
      })),
    {
      ids: ['power-holder-cell-liner', 'power-lower-pan'],
      expectedVolume: takeUp.expectedVolume,
      maximumVolume: takeUp.expectedVolume + 0.03,
      interference: takeUp.nominalOverlap,
      minimumResidualInterference: takeUp.minimumResidualOverlap,
      direction: 'Opposed Y side heels, backed by the existing liner and hard backup sockets',
      scope:
        'Physical liner-to-pan contact, separate from cell fitting references. The lower entry is 45 degrees. Hard PETG seats still carry the bank loads; TPU takes up the selected lateral gap. Qualify force, strain, creep and printing tolerances physically.',
    },
  ];
}

export function powerPayload(_p: Parameters): ConfiguredPiece[] {
  return [
    purchased(
      ups,
      'power-ups-3s',
      'ups-module-3s',
      [centerX, 0, powerInterface.ups.pcbUndersideZ],
      powerInterface.ups.rotation,
      'default',
    ),
    purchased(holder, 'power-extra-3s-holder', 'beilamoo-3s', [centerX, 0, holderBottomZ]),
    ...powerInterface.connector.centersZ.flatMap((z, index) => [
      purchased(connector, `power-xt60e-f-${index + 1}`, 'xt60e-f', [frontX, 0, z], [90, 0, -90]),
      ...[-12.5, 12.5].flatMap((y, hole) => [
        // The bolt library is centred on its 21 mm total length: its bearing
        // plane is local Z=7.5. The head bears on the broad washer at frontX-4.9;
        // its tip remains 3.5 mm beyond the complete 2.4 mm recessed nut.
        purchased(
          bolt,
          `power-xt60-screw-${index + 1}-${hole + 1}`,
          'gvyntok-040-220-051',
          [frontX + 2.6, y, z],
          [0, -90, 0],
          'default',
        ),
        purchased(
          washer,
          `power-xt60-washer-${index + 1}-${hole + 1}`,
          'gvyntok-e3f364f222e0',
          [frontX - 4.5, y, z],
          [0, 90, 0],
          'default',
        ),
        purchased(
          nut,
          `power-xt60-nut-${index + 1}-${hole + 1}`,
          'gvyntok-474adfbe1cd7',
          [powerInterface.connector.nutBearingX, y, z],
          [90, 0, 90],
          'default',
        ),
      ]),
    ]),
  ];
}

/** Conservative envelope checks exclude the intentional TPU compression contacts. */
export function powerEnvelopeChecks(): string[] {
  const failures: string[] = [];
  if (backX - frontX < powerPacking.minimumLength)
    failures.push(
      'Keep at least 130 mm power-module length until real harness clearances are measured.',
    );
  if (upsBackX + 3.3 > backX - datums.discThickness)
    failures.push('The UPS end stop must remain ahead of the aft disc.');
  for (const [id, bounds] of [['holder', powerInterface.holder.bounds]] as const) {
    const radial = Math.max(
      ...bounds.flatMap((corner) => bounds.map((other) => Math.hypot(corner[1], other[2]))),
    );
    if (radial > datums.radius)
      failures.push(`${id} envelope exceeds the 85.6 mm sliding diameter.`);
  }
  // The UPS overall box includes empty corners above the PCB. Check its actual
  // source-model regions instead of treating that empty space as solid stock.
  for (const [id, y, z] of [
    ['UPS PCB', 30, 25.8],
    ['UPS fitted holder', 30, 24.2],
    ['UPS inductor', 18, 30.8],
    ['UPS control package', 7, 27.8],
    ['UPS terminals', 18, 24.2],
  ] as const)
    if (Math.hypot(y, z) > datums.radius) failures.push(`${id} exceeds the sliding diameter.`);

  return failures;
}
