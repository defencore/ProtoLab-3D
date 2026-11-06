import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import {
  tubeReferenceDatums,
  accessWindowDatums,
  at,
  intersect,
} from '../../modular-tube-avionics/lib/shared';
import { holeStations, tubeMounting } from '../../modular-tube-avionics/lib/service';
import {
  defaultTubeProfile,
  resolveTubeProfile,
} from '../../modular-tube-avionics/lib/tube-interface';

// Fixed core offsets belong to this qualified tube profile, not a free resizer.
const qualifiedTube = resolveTubeProfile({ tubeProfile: defaultTubeProfile });

export interface PrintedTool {
  id: string;
  name: string;
  shape: Shape;
  material: 'PETG';
  printRotation: Vec;
  placement: Vec;
}

/** Working X0 is the tube front. Target positions are converted from the source once. */
export const jigDatums = {
  tube: tubeReferenceDatums,
  collar: {
    front: -8,
    back: 20,
    radius: qualifiedTube.outerRadius + 7,
    stopBore: qualifiedTube.innerRadius - 0.5,
  },
  docking: {
    floor: qualifiedTube.outerRadius + 4.8,
    face: qualifiedTube.outerRadius + 9,
    outside: qualifiedTube.outerRadius + 13.2,
    rootFront: 16,
    rootBack: 28,
    keyFront: 19.8,
    keyBack: 27,
    halfWidth: 10,
  },
  clamp: {
    pressureX: 8,
    pressureTipN: qualifiedTube.outerRadius + 4.5,
    pressureHeadN: qualifiedTube.outerRadius + 24.5,
    nutInnerN: qualifiedTube.outerRadius + 16.2,
    nutOuterN: qualifiedTube.outerRadius + 18.6,
    pressureBossOuterN: qualifiedTube.outerRadius + 21.6,
    retainerN: qualifiedTube.outerRadius + 8,
    retainerS: -10,
    retainerHeadX: -2,
    retainerNutX: 18,
    retainerHeadCounterboreRadius: 3,
    retainerNutClearanceRadius: 3.4,
    pressureCupRadius: 2.2,
    pressureCupDepth: 0.5,
    shoeBackN: qualifiedTube.outerRadius + 5,
    guideOuterN: qualifiedTube.outerRadius + 16.2,
    handleMinN: qualifiedTube.outerRadius + 14,
    handleMaxN: qualifiedTube.outerRadius + 29,
    handleMinS: -12,
    handleMaxS: -8,
    earMinS: -16.5,
    earMaxS: -3.5,
    earOuterN: qualifiedTube.outerRadius + 15,
    shoeFront: 2,
    shoeBack: 14,
    release: 1,
    guideHalfWidth: 12,
    slotWidth: 3.4,
    slotHeight: 5.4,
    fixedLandBands: [
      [0, 7],
      [15, 19],
    ],
  },
  registerAnglesDegrees: [0, 90, 180, 270],
  window: {
    front: 20,
    back: 151,
    halfWidth: 40,
    bottom: qualifiedTube.outerRadius - 16,
    outside: qualifiedTube.outerRadius + 13.2,
  },
  rail: {
    front: 20,
    frontBack: 234,
    rearFront: 155,
    back: tubeReferenceDatums.backX - tubeReferenceDatums.frontX,
    halfWidth: 16,
    frontOutside: qualifiedTube.outerRadius + 13.2,
    rearOutside: qualifiedTube.outerRadius + 9,
    keyFront: 188,
    keyBack: 202,
    keyHalfWidth: 8,
    keyFloor: qualifiedTube.outerRadius + 4.8,
    accessDiameter: 6,
  },
  bandLandsX: { window: [45, 146], rail: [195, 240, 330] },
} as const;

export const jigPattern = {
  holeStations: holeStations.map((sourceX) => ({
    sourceX,
    x: sourceX - tubeReferenceDatums.frontX,
  })),
  windowCenterX: accessWindowDatums.x + accessWindowDatums.length / 2 - tubeReferenceDatums.frontX,
  window: accessWindowDatums,
  finishedHoleDiameter: tubeMounting.pilotDiameter,
} as const;

const tubeTool = (p: Parameters, x = -20, length = 410): Shape =>
  cylinder(resolveTubeProfile(p).outerRadius + Number(p.fitAllowance) / 2, length, [x, 0, 0], 'x');
const transfer = (x: number, diameter: number, y = -90, length = 180): Shape =>
  cylinder(diameter / 2, length, [x, y, 0], 'y');

/** Coordinates: N=(Y+Z)/sqrt(2), S=(-Y+Z)/sqrt(2). */
export const diagonal = (shape: Shape): Shape => at(shape, [0, 0, 0], [45, 0, 0]);
export const diagonalPoint = (x: number, n: number, tangent: number): Vec => [
  x,
  (n - tangent) / Math.SQRT2,
  (n + tangent) / Math.SQRT2,
];

/** One fixed master generates all opposed registers, including its open centre. */
export function registerStock(angle: number): Shape {
  const d = jigDatums.docking;
  const master = subtract(
    union(
      box([28, 32, 9], [-8, -16, qualifiedTube.outerRadius]),
      box([12, 20, d.floor - qualifiedTube.outerRadius], [16, -10, qualifiedTube.outerRadius]),
      box([7.2, 20, 4.2], [19.8, -10, d.floor]),
    ),
    box([9, 8, 30], [20, -4, qualifiedTube.outerRadius - 5]),
  );
  return at(master, [0, 0, 0], [angle, 0, 0]);
}

function tangentLand(front: number, back: number): Shape {
  const lead = 0.6;
  return {
    kind: 'prism',
    axis: 'z',
    origin: -8,
    depth: 16,
    points: [
      [front, -qualifiedTube.outerRadius - 4],
      [back, -qualifiedTube.outerRadius - 4],
      [back, -qualifiedTube.outerRadius - 0.6],
      [back - lead, -qualifiedTube.outerRadius],
      [front + lead, -qualifiedTube.outerRadius],
      [front, -qualifiedTube.outerRadius - 0.6],
    ],
  };
}

function fixedFrame(p: Parameters): Shape {
  const d = jigDatums.clamp,
    c = Number(p.jointAllowance);
  const stock = union(
    cylinder(jigDatums.collar.radius, 28, [-8, 0, 0], 'x'),
    ...jigDatums.registerAnglesDegrees.map(registerStock),
    diagonal(
      box(
        [26, d.pressureBossOuterN - (qualifiedTube.outerRadius - 2), 44],
        [-8, qualifiedTube.outerRadius - 2, -22],
      ),
    ),
  );
  const hex = {
    kind: 'prism',
    axis: 'y',
    origin: d.nutInnerN - 0.2,
    depth: d.nutOuterN - d.nutInnerN + 0.2,
    points: Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = ((i + 0.5) * Math.PI) / 3,
        r = 5.8 / Math.sqrt(3);
      return [d.pressureX + r * Math.cos(a), r * Math.sin(a)];
    }),
  } as Shape;
  const base = subtract(
    stock,
    tubeTool(p, 0, 40),
    cylinder(jigDatums.collar.stopBore, 12, [-10, 0, 0], 'x'),
    transfer(jigPattern.holeStations[0].x, Number(p.markDiameter)),
    diagonal(box([12, d.guideOuterN, 28.5 + c], [2, 0, -16.5 - c / 2])),
    // Open radial access to the broad manual release handle.
    diagonal(box([16.2, 20.5, 4.4], [2, qualifiedTube.outerRadius + 14.5, -12.2])),
    diagonal(cylinder(1.7, 45, [d.pressureX, qualifiedTube.outerRadius - 5, 0], 'y')),
    diagonal(hex),
    // Lateral loading, with its outer nut-reaction wall closed.
    diagonal(box([10.2, d.nutOuterN - d.nutInnerN + 0.2, 7], [8, d.nutInnerN - 0.2, -3.5])),
    diagonal(cylinder(1.7, 40, [-10, d.retainerN, d.retainerS], 'x')),
    // The retainer head bears at X-2, clear of the surrounding front boss.
    diagonal(cylinder(d.retainerHeadCounterboreRadius, 8, [-10, d.retainerN, d.retainerS], 'x')),
    // The annulus continues to X20; clear its rim behind the nut's X18 seat.
    diagonal(
      cylinder(d.retainerNutClearanceRadius, 8, [d.retainerNutX, d.retainerN, d.retainerS], 'x'),
    ),
  );
  const lands = jigDatums.clamp.fixedLandBands.flatMap(([a, b]) => {
    const land = tangentLand(a, b);
    return [land, at(land, [0, 0, 0], [90, 0, 0])];
  });
  return union(base, ...lands);
}

function pressureShoe(p: Parameters): Shape {
  const d = jigDatums.clamp,
    c = Number(p.jointAllowance),
    x = d.shoeFront + c / 2,
    length = d.shoeBack - d.shoeFront - c;
  const slot = union(
    box([32, 2, 3.4], [-8, d.retainerN - 1, d.retainerS - 1.7]),
    ...[d.retainerN - 1, d.retainerN + 1].map((n) => cylinder(1.7, 32, [-8, n, d.retainerS], 'x')),
  );
  return diagonal(
    subtract(
      union(
        box([length, 7, 24], [x, qualifiedTube.outerRadius - 2, -12]),
        box([length, 10.5, 13], [x, d.shoeBackN - 0.5, -16.5]),
        // Constant axial section: a short thick handle starts on the first layer.
        box(
          [length, d.handleMaxN - d.handleMinN, d.handleMaxS - d.handleMinS],
          [x, d.handleMinN, d.handleMinS],
        ),
      ),
      cylinder(qualifiedTube.outerRadius, 32, [-8, 0, 0], 'x'),
      slot,
      cylinder(d.pressureCupRadius, 3, [d.pressureX, d.shoeBackN - d.pressureCupDepth, 0], 'y'),
    ),
  );
}

/** Radially loaded blind-top register; its normal face is not loosened by joint fit. */
function dockingCuts(p: Parameters, top: boolean): Shape[] {
  const c = Number(p.jointAllowance),
    d = jigDatums.docking;
  const relief = box([8.3, 20 + c, 120], [19.9, -10 - c / 2, d.floor - 120]);
  const key = box([7.2 + c, 20 + c, 120], [19.8 - c / 2, -10 - c / 2, d.face - 120]);
  return top ? [relief, key] : [relief, key].map((s) => at(s, [0, 0, 0], [-90, 0, 0]));
}

function windowStencil(p: Parameters): Shape {
  const d = jigDatums.window;
  return subtract(
    box(
      [d.back - d.front, 2 * d.halfWidth, d.outside - d.bottom],
      [d.front, -d.halfWidth, d.bottom],
    ),
    tubeTool(p),
    at(
      roundedRect(
        accessWindowDatums.length,
        accessWindowDatums.width,
        accessWindowDatums.cornerRadius,
        -5,
        100,
      ),
      [jigPattern.windowCenterX, 0, 0],
    ),
    ...dockingCuts(p, true),
    // A true 100 mm check rule, shallow enough to leave all structural roots intact.
    box([100, 0.6, 0.5], [40, 35.7, d.outside - 0.4]),
    ...[40, 140].map((x) => box([0.6, 5, 0.5], [x - 0.3, 33.5, d.outside - 0.4])),
  );
}

function frontRail(p: Parameters): Shape {
  const d = jigDatums.rail;
  const lap = box(
    [d.frontBack - d.rearFront + 1, 120, 34],
    [d.rearFront, d.rearOutside - 120, -17],
  );
  const key = box(
    [d.keyBack - d.keyFront, d.rearOutside - d.keyFloor, 2 * d.keyHalfWidth],
    [d.keyFront, d.keyFloor, -d.keyHalfWidth],
  );
  const body = subtract(
    box([d.frontBack - d.front, d.frontOutside, 32], [d.front, 0, -16]),
    tubeTool(p),
    lap,
    ...dockingCuts(p, false),
  );
  return subtract(
    union(body, key),
    ...jigPattern.holeStations
      .filter((s) => s.x > 20 && s.x < d.frontBack)
      .map((s) => transfer(s.x, s.x >= d.rearFront ? d.accessDiameter : Number(p.markDiameter))),
    box([100, 0.5, 0.6], [40, d.frontOutside - 0.4, 11.7]),
    ...[40, 140].map((x) => box([0.6, 0.5, 5], [x - 0.3, d.frontOutside - 0.4, 9.5])),
  );
}

function rearRail(p: Parameters): Shape {
  const d = jigDatums.rail,
    c = Number(p.jointAllowance);
  return subtract(
    box([d.back - d.rearFront, d.rearOutside, 32], [d.rearFront, 0, -16]),
    tubeTool(p),
    // Through rather than blind: no roof closes over a support-trapping key recess.
    box(
      [d.keyBack - d.keyFront + c, 120, 2 * d.keyHalfWidth + c],
      [d.keyFront - c / 2, -10, -d.keyHalfWidth - c / 2],
    ),
    ...jigPattern.holeStations
      .filter((s) => s.x > d.rearFront)
      .map((s) => transfer(s.x, Number(p.markDiameter))),
    box([100, 0.5, 0.6], [250, d.rearOutside - 0.4, 11.7]),
    ...[250, 350].map((x) => box([0.6, 0.5, 5], [x - 0.3, d.rearOutside - 0.4, 9.5])),
  );
}

/** Every tool has its own local X recipe and an explicit working placement. */
export function jigPrinted(p: Parameters): PrintedTool[] {
  resolveTubeProfile(p);
  const item = (
    id: string,
    name: string,
    shape: Shape,
    x: number,
    printRotation: Vec,
  ): PrintedTool => ({
    id,
    name,
    shape: at(shape, [-x, 0, 0]),
    placement: [x, 0, 0],
    material: 'PETG',
    printRotation,
  });
  return [
    item(
      'modular-tube-jig-collar-a',
      'Fixed front datum frame · four opposed registers',
      fixedFrame(p),
      -8,
      [0, -90, 0],
    ),
    item(
      'modular-tube-jig-clamp-shoe',
      'Captive diagonal pressure shoe · manual release',
      pressureShoe(p),
      2 + Number(p.jointAllowance) / 2,
      [0, -90, 0],
    ),
    item(
      'modular-tube-jig-window-stencil',
      'Projected R2.5 window saddle · two passes',
      windowStencil(p),
      20,
      [180, 0, 0],
    ),
    item(
      'modular-tube-jig-rail-front',
      'Front station rail · stopped lap',
      frontRail(p),
      20,
      [-90, 0, 0],
    ),
    item(
      'modular-tube-jig-rail-rear',
      'Rear station rail · through register',
      rearRail(p),
      155,
      [-90, 0, 0],
    ),
  ];
}

export function jigLayout(p: Parameters) {
  const tube = resolveTubeProfile(p),
    d = jigDatums.clamp;
  return {
    ...jigDatums,
    pattern: jigPattern,
    tubeProfile: tube.id,
    fitRadius: resolveTubeProfile(p).outerRadius + Number(p.fitAllowance) / 2,
    jointAllowance: Number(p.jointAllowance),
    transferDiameter: Number(p.markDiameter),
    side: p.side,
    toolAngleDegrees: p.side === 'opposite' ? 180 : 0,
    baseAngleDegrees: 0,
    registerAnglesDegrees: [...jigDatums.registerAnglesDegrees],
    registers: jigDatums.registerAnglesDegrees.map((angle) => ({ angle, rotation: [angle, 0, 0] })),
    clamp: {
      ...d,
      normal: [0, Math.SQRT1_2, Math.SQRT1_2],
      tangent: [0, -Math.SQRT1_2, Math.SQRT1_2],
      releaseVector: diagonalPoint(0, 1, 0),
      releaseMembers: ['modular-tube-jig-clamp-shoe', 'modular-tube-jig-pressure-screw'],
      operatingTravel: [-0.25, 1],
      retainedTravel: [-1.2, 1.2],
      contacts: [
        { normal: [0, 1, 0], plane: `Y=-${tube.outerRadius}` },
        { normal: [0, 0, 1], plane: `Z=-${tube.outerRadius}` },
      ],
      forcePath:
        'Pressure tip → solid shoe → tube → two fixed tangent lands → single rigid frame; retainer bolt only captures/guides the released shoe.',
      retraction:
        'Back off the pressure screw two turns, then pull the thick accessible handle against the backed-off tip for the 1 mm released pose. The retainer has 0.2 mm additional travel reserve; no automatic spring return.',
    },
    minimumClearRootAtMaximumFit: jigDatums.docking.floor - (tube.outerRadius + 0.5),
    lapLayerStock: jigDatums.rail.frontOutside - jigDatums.rail.rearOutside,
    scriberDepthAtWindowSide:
      jigDatums.window.outside -
      Math.sqrt(tube.outerRadius ** 2 - (accessWindowDatums.width / 2) ** 2),
  };
}
