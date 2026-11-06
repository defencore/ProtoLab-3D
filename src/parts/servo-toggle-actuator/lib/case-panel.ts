import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { parallelDetails } from './parallel';
import { parallelLegendCutters } from './parallel-legends';
import { roundedPlate } from './parallel-installation';
import { screw } from './hardware';
import type { DetailSpec } from './types';
import {
  caseBatteryPockets,
  caseBatteryPocketStructure,
  caseElectronicsFloor,
  caseElectronicsPanelCuts,
} from './case-electronics';
import { caseModularElectronics, electronicsAdapterIds } from './case-electronics-grid';
import { caseBodyMountAxes } from './case-mechanical-layout';
import {
  caseLowerCarrierSupportStructure,
  caseLowerCarrierSupportLadder,
  caseLowerCradlePostCuts,
  caseLowerCradlePosts,
  caseLowerFourPostCapture,
  caseLowerSplitStructure,
} from './case-lower-split';
import {
  casePwmBacking,
  casePwmCarrierCuts,
  casePwmKeeper,
  casePwmStructure,
  casePwmTies,
} from './case-pwm-support';
import {
  caseBrassFloorSeats,
  caseBrassFloorCutters,
  caseBrassUpperCutters,
  caseBrassHardware,
  caseBrassStructure,
} from './case-brass-supports';
import {
  caseWallMountCutters,
  caseWallMountHardware,
  caseWallMountShapes,
} from './case-wall-mounts';

type Point = readonly [number, number];
/** Dimensions are operator-facing; the existing assembly applies its final -90° rotation. */
export function casePanelLayout(p: Parameters) {
  const width = Number(p.baseLength) || 214,
    height = Number(p.baseWidth) || 150.6,
    sp20Connectors = [
      [174, 127.75],
      [174, 87.75],
    ] as const,
    sp20LabelTexts = ['TS', 'PS'] as const,
    indicators = [
      [136, 130.75],
      [136, 107.75],
      [136, 84.75],
    ] as const,
    indicatorLabelTexts = ['I', 'R', 'P'] as const;
  return {
    width,
    height,
    centre: [107, 75] as const,
    min: [107 - width / 2, 75 - height / 2] as const,
    max: [107 + width / 2, 75 + height / 2] as const,
    panelBottom: 1.5,
    panelTop: 7.5,
    panelThickness: 6,
    panelCornerRadius: 4,
    arm1: [42, 35] as const,
    arm2: [124, 35] as const,
    arm1Legend: [42, 9.5] as const,
    arm2Legend: [124, 9.5] as const,
    mechanismLegendHost: 'case-top-bridge' as const,
    mechanismLegendTopZ: 9.5,
    cassetteFrontFlange: { min: [26, 3.5] as const, max: [140, 73] as const },
    sp20Legends: sp20Connectors.map(([x, y], i) => ({
      text: sp20LabelTexts[i],
      centre: [x + 24, y] as const,
    })),
    connectors: [
      [12.3, 94],
      [12.3, 124.5],
    ] as const,
    connectorSeatZ: 0.5,
    connectorFlangeSeatZ: 4.5,
    connectorMatingZ: 7.5,
    connectorRearPocketSize: [12.7, 27.7] as const,
    connectorHeadSeatZ: 6,
    connectorHeadRecessDepth: 1.5,
    connectorRotation: 90,
    indicators,
    indicatorLabelTexts,
    indicatorLegends: indicators.map(([x, y], i) => ({
      text: indicatorLabelTexts[i],
      centre: [x + 16, y] as const,
    })),
    clipLegend: { text: 'ICT', centre: [180.5, 62.5] as const },
    indicatorSeatZ: 7.5,
    indicatorHoleDiameter: 16,
    sp20Connectors,
    sp20LabelTexts,
    sp20SeatZ: 7.5,
    sp20PanelThickness: 4,
    sp20NutToolRadius: 17.5,
    batteries: [
      [65, 91],
      [65, 124.5],
    ] as const,
    batterySize: [88, 24, 74] as const,
    batteryBottom: -53.1,
    batteryTop: 20.9,
    batteryPocket: [89, 25] as const,
    batteryHolderSize: [95, 31] as const,
    batteryBankCentre: [65, 107.75] as const,
    batteryBankSize: [95, 64.5] as const,
    batteryFloorBottom: -55.5,
    batteryWallTop: 1.5,
    batteryWallHeight: 54.6,
    batteryPocketDepth: 63,
    batteryLabels: [
      [116, 91],
      [116, 124.5],
    ] as const,
    batteryLabelTexts: ['B2', 'B1'] as const,
    bodyMountAxes: caseBodyMountAxes,
    testClips: [
      [179, 23],
      [179, 41],
    ] as const,
    testClipSeatZ: -7,
    testClipCarrierCentre: [180.5, 32] as const,
    testClipCarrierSize: [61, 44] as const,
    testClipFloorBottom: -12,
    testClipBodySeatZ: -12,
    testClipBodyKeys: [
      [154, 12],
      [154, 52],
    ] as const,
    testClipCarrierTieCentres: [11.8, 52.1] as const,
    testClipHousingTieCentres: [23, 41] as const,
    mountingHoles: [
      [7, 7],
      [7, 143],
      [207, 7],
      [207, 143],
    ] as const,
  };
}
/** Source purchased parts and main hardware alone need this canonical offset. */
export function casePanelPose(p: Parameters, id: string): Vec {
  const m = casePanelLayout(p);
  if (id === 'manual-toggle-switch') return casePanelCanonicalPoint([m.arm1[0] + 90, m.arm1[1], 0]);
  if (
    id === 'drive-servo' ||
    id === 'toggle-switch' ||
    id.startsWith('parallel-clamp-') ||
    id.startsWith('parallel-disc-')
  )
    return casePanelCanonicalPoint([m.arm2[0], m.arm2[1], 0]);
  return [0, 0, 0];
}
/** Convert operator X/Y to the canonical coordinates used by the inherited mechanism. */
export const casePanelCanonicalPoint = ([x, y, z]: readonly [number, number, number]): Vec => [
  -y,
  x,
  z,
];
const operator = (child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [0, 0, 90],
});
const moved = (child: Shape, translation: Vec): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation: [0, 0, 0],
});
const intersection = (a: Shape, b: Shape): Shape => ({ kind: 'intersect', children: [a, b] });
const nativeServo = (child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: [0, -28, -15.2],
  rotation: [0, 0, -90],
});
/** Extract the inherited sleeve itself, excluding the flange's coplanar top face. */
function inheritedSleeve(shape: Shape): Shape | undefined {
  if (shape.kind === 'transform') {
    if (
      shape.translation[0] === 0 &&
      shape.translation[1] === -28 &&
      shape.translation[2] === -15.2 &&
      shape.rotation[2] === -90
    )
      return shape;
    return inheritedSleeve(shape.child);
  }
  if ('children' in shape)
    for (const child of shape.children) {
      const sleeve = inheritedSleeve(child);
      if (sleeve) return sleeve;
    }
  return undefined;
}
const servoTieAxes: Point[] = [-10, 35].flatMap((x) => [-20, 20].map((y): Point => [y, -28 - x]));
const petg = (
  id: string,
  label: string,
  shape: Shape,
  blank: string,
  requirements: string[],
  color = 0x526477,
): DetailSpec => ({
  id,
  label,
  shape,
  blank,
  requirements,
  color,
  material: 'PETG; fit the printed prototype to delivered hardware',
  processes: ['printing', 'drilling'],
});
const tpu = (
  id: string,
  label: string,
  shape: Shape,
  blank: string,
  requirements: string[],
): DetailSpec => ({
  id,
  label,
  shape,
  blank,
  requirements,
  color: 0x3e565c,
  material: 'TPU; verify printed thickness and fit',
  processes: ['printing'],
});

// Small open block lettering has no dependency on an installed font or an external asset.
const letters: Record<string, string[]> = {
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
};
function textCut(text: string, centre: Point, top: number): Shape {
  const pitch = 0.82,
    cell = 0.76,
    width = (text.length * 6 - 1) * pitch;
  return union(
    ...[...text].flatMap((letter, i) =>
      (letters[letter] ?? []).flatMap((row, y) =>
        [...row].flatMap((value, x) =>
          value === '1'
            ? [
                box(
                  [cell, cell, 0.7],
                  [
                    centre[0] - width / 2 + (i * 6 + x) * pitch,
                    centre[1] + (3 - y) * pitch - cell / 2,
                    top - 0.6,
                  ],
                ),
              ]
            : [],
        ),
      ),
    ),
  );
}
const rectangularKeySlot = ([x, y]: Point, size: Point, z: number, height: number): Shape =>
  box([size[0] + 0.3, size[1] + 0.3, height], [x - size[0] / 2 - 0.15, y - size[1] / 2 - 0.15, z]);

/** AMASS XT60E-M keyed opening, rotated with the pin axis toward operator +Y. */
export function casePanelXtCutout([x, y]: Point, z: number, height: number): Shape {
  const w = 15.7,
    h = 8.3,
    bevel = h * 0.25;
  const points: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2 - bevel, -h / 2],
    [w / 2, -h / 2 + bevel],
    [w / 2, h / 2 - bevel],
    [w / 2 - bevel, h / 2],
    [-w / 2, h / 2],
  ];
  return { kind: 'plate', outline: points.map(([u, v]) => [x - v, y + u]), holes: [], z, height };
}

function guardSeatShape([x, y]: Point): Shape {
  return subtract(
    roundedPlate(24, 50, 3, [x, y + 7], 7.5, 2.6),
    roundedPlate(17.4, 41, 0.2, [x, y + 7], 9.5, 3),
    cylinder(9.4, 8, [x, y, 6.5]),
  );
}

const toOperator = (child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [0, 0, -90],
});
const keyedToggle = ([x, y]: Point, z: number, height: number): Shape =>
  subtract(cylinder(6.1, height, [x, y, z]), box([1.9, 1, height], [x - 0.95, y - 6.2, z]));

function mechanismShapes(p: Parameters) {
  const m = casePanelLayout(p);
  const inherited = parallelDetails({
    ...p,
    mechanism: 'parallel',
    baseLength: 100,
    baseWidth: 150,
  });
  const main = (shape: Shape) => moved(shape, casePanelCanonicalPoint([...m.arm2, 0]));
  const relief = nativeServo(box([0.4, 25.6, 40], [-10.9, -12.8, -5]));
  const base = inherited.find((d) => d.id === 'parallel-base')!;
  const sleeve = toOperator(
    main(
      subtract(
        union(
          intersection(inheritedSleeve(base.shape)!, box([80, 70, 20], [-40, -73, 7.5])),
          ...servoTieAxes.map(([x, y]) => cylinder(4.2, 6.1, [x, y, 1.5])),
        ),
        ...servoTieAxes.map(([x, y]) => cylinder(1.7, 25, [x, y, 0.5])),
        relief,
      ),
    ),
  );
  const cradle = toOperator(
    main(
      union(
        subtract(inherited.find((d) => d.id === 'parallel-cradle')!.shape, relief),
        ...servoTieAxes.map(([x, y]) => cylinder(6, 2.5, [x, y, -14.1])),
      ),
    ),
  );
  return { inherited, main, sleeve, cradle };
}

/** The original fitted parallel cradle, on direct straight load walls and columns. */
export function casePanelLowerWalls(p: Parameters): Shape {
  const m = casePanelLayout(p),
    { cradle } = mechanismShapes(p);
  const [x, y] = m.arm1;
  const flare: Shape = {
    kind: 'loft',
    rings: [
      [
        [x - 10, y - 16, -19.8],
        [x + 10, y - 16, -19.8],
        [x + 10, y + 16, -19.8],
        [x - 10, y + 16, -19.8],
      ],
      [
        [x - 8.4, y - 14.4, -17],
        [x + 8.4, y - 14.4, -17],
        [x + 8.4, y + 14.4, -17],
        [x - 8.4, y + 14.4, -17],
      ],
    ] as Vec[][],
  };
  const manualPocket = subtract(
    roundedPlate(24, 36.8, 3, m.arm1, -19.7, 21.2),
    box([16.8, 28.8, 18.61], [x - 8.4, y - 14.4, -17.01]),
    flare,
    box([18.4, 20, 8], [x - 9.2, y - 25, -6]),
  );
  return union(
    cradle,
    manualPocket,
    ...[16.6, 49.4].map((yy) => box([8, 4, 21.2], [51, yy, -19.7])),
    // Retain the accepted upper wall strips; the separate tray owns their below-seam halves.
    ...[17.2, 50].map((yy) => box([55, 2.4, 21.2], [56, yy, -19.7])),
  );
}

const servoIslandCentre: Point = [83.5, 35];

/** One continuous outline; source working geometry retains its original datum. */
function controlOutline(p: Parameters, outset: number, z: number, h: number): Shape {
  const m = casePanelLayout(p);
  return union(
    roundedPlate(110 + 2 * outset, 54 + 2 * outset, Math.max(0.5, 4 + outset), [83, 39], z, h),
    roundedPlate(
      57 + 2 * outset,
      58 + 2 * outset,
      Math.max(0.5, 3 + outset),
      servoIslandCentre,
      z,
      h,
    ),
    roundedPlate(
      24 + 2 * outset,
      50 + 2 * outset,
      Math.max(0.5, 3 + outset),
      [m.arm1[0], m.arm1[1] + 7],
      z,
      h,
    ),
  );
}
function controlRing(p: Parameters, outside: number, inside: number, z: number, h: number): Shape {
  return subtract(controlOutline(p, outside, z, h), controlOutline(p, inside, z - 0.1, h + 0.2));
}

function topCassette(p: Parameters, sleeve: Shape): Shape {
  const m = casePanelLayout(p);
  const guardStem = ([x, y]: Point) =>
    subtract(
      roundedPlate(24, 50, 3, [x, y + 7], 1.5, 6.1),
      roundedPlate(17.4, 41, 0.2, [x, y + 7], 1.4, 6.2),
    );
  const collar = (pt: Point) => cylinder(11, 6.1, [...pt, 1.5]);
  const servoBase = subtract(
    roundedPlate(56, 35.6, 3, servoIslandCentre, 1.5, 6.1),
    box([46.4, 25.6, 8], [60.5, 22.2, 0.5]),
  );
  return subtract(
    union(
      sleeve,
      roundedPlate(114, 69.5, 4, [83, 38.25], 7.5, 2),
      controlRing(p, 0, -3, 1.5, 6.1),
      servoBase,
      ...m.bodyMountAxes.map(([x, y]) => cylinder(6, 6.1, [x, y, 1.5])),
      ...[m.arm1].flatMap(([x, y]) => [
        guardStem([x, y]),
        guardSeatShape([x, y]),
        box([13, 1.5, 3], [x - 6.5, y - 15.05, 9.5]),
        box([11, 1.5, 3], [x - 5.5, y + 27.55, 9.5]),
      ]),
      ...[m.arm1, m.arm2].map(collar),
      // ARM2's circular collar otherwise only touches the inner perimeter at one point.
      box([5, 6, 6.1], [132, 32, 1.5]),
      ...[61, 106].map((x) => box([6, 3, 6.1], [x - 3, 8, 1.5])),
    ),
    box([46.4, 25.6, 12], [60.5, 22.2, 0.5]),
    ...[m.arm1, m.arm2].flatMap((pt) => [keyedToggle(pt, 0.5, 10), cylinder(9.4, 5, [...pt, 6.8])]),
    ...m.bodyMountAxes.flatMap(([x, y]) => [cylinder(1.7, 30, [x, y, 0.5])]),
    ...caseBrassUpperCutters('main'),
    ...parallelLegendCutters(9.5).map((shape, i) =>
      toOperator(
        moved(
          shape,
          casePanelCanonicalPoint(
            i < 4
              ? [m.arm1Legend[0] + 90, m.arm1Legend[1] + 36, 0]
              : [m.arm2Legend[0], m.arm2Legend[1] + 36, 0],
          ),
        ),
      ),
    ),
  );
}

/** Actual panel-bearing lands are divided so battery contact cannot conceal a missing cradle land. */
export function casePanelBearingApronStructure() {
  const bounds = (min: Vec, max: Vec) => ({ min, max });
  const straightLands: Record<string, { min: Vec; max: Vec }> = {
    'front-arm1': bounds([39, 5.7, 1.49], [50.5, 9.8, 1.51]),
    'front-servo': bounds([65, 2.2, 1.49], [101, 5.7, 1.51]),
    'front-arm2': bounds([115, 5.7, 1.49], [132, 9.8, 1.51]),
    'rear-arm1': bounds([38, 67.3, 1.49], [46, 70.8, 1.51]),
    'rear-servo': bounds([60, 66.35, 1.49], [105, 69.85, 1.51]),
    'rear-arm2': bounds([116, 66.35, 1.49], [130, 69.85, 1.51]),
    'left-front': bounds([24.15, 22, 1.49], [27.65, 33, 1.51]),
    'left-rear': bounds([24.15, 47, 1.49], [27.65, 57, 1.51]),
  };
  const region = (
    id: string,
    min: Vec,
    max: Vec,
    minimumAreaMm2: number,
    coverageAxis: 'x' | 'y',
    rootProbes: { min: Vec; max: Vec }[],
  ) => ({
    id,
    contactBox: bounds(min, max),
    shift: [0, 0, 0.01] as Vec,
    minimumAreaMm2,
    coverageAxis,
    cellWidthMm: 1,
    minimumBearingWidthMm: 1.5,
    minimumCoverageFraction: 0.98,
    maximumGapMm: 1,
    rootProbes,
    straightLandProbe: straightLands[id],
    minimumStraightLandWidthMm: 3.5,
  });
  return {
    partId: 'case-lower-cradle',
    fixedId: 'parallel-base',
    planeZ: 1.5,
    thicknessMm: 3,
    frontBand: bounds([24, 2, -1.5], [142, 18, 1.5]),
    rearBand: bounds([24, 60, -1.5], [142, 71.5, 1.5]),
    leftReturns: [bounds([24, 18, -1.5], [34, 36, 1.5]), bounds([24, 45, -1.5], [34, 61, 1.5])],
    outwardToes: [bounds([38, 5.5, -1.5], [58, 10, 1.5]), bounds([109, 5.5, -1.5], [134, 10, 1.5])],
    outwardToeCornerRadiusMm: 1,
    regions: [
      region('front-arm1', [24, 2, 1.49], [55, 18, 1.51], 130, 'x', [
        bounds([31, 13.2, -2.1], [32.4, 14.6, -0.9]),
        bounds([51.3, 8.2, -1.2], [54.8, 12.8, 1.2]),
      ]),
      region('front-servo', [55, 2, 1.49], [112, 18, 1.51], 200, 'x', [
        bounds([51.3, 12, -2.1], [54.8, 15, -0.9]),
        bounds([111.3, 12, -2.1], [114.6, 15, -0.9]),
      ]),
      region('front-arm2', [112, 2, 1.49], [142, 18, 1.51], 140, 'x', [
        bounds([134.9, 14.3, -2.1], [136, 15.8, -0.9]),
        bounds([111.3, 8.2, -1.2], [114.6, 12.8, 1.2]),
      ]),
      region('rear-arm1', [24, 60, 1.49], [55, 71.5, 1.51], 120, 'x', [
        bounds([35, 63.7, -1.2], [50, 64.3, 1.2]),
      ]),
      region('rear-servo', [55, 60, 1.49], [112, 71.5, 1.51], 200, 'x', [
        bounds([72, 63.7, -1.2], [94, 64.3, 1.2]),
      ]),
      region('rear-arm2', [112, 60, 1.49], [142, 71.5, 1.51], 115, 'x', [
        bounds([115, 63.7, -1.2], [129, 64.3, 1.2]),
      ]),
      region('left-front', [24, 18, 1.49], [34, 36, 1.51], 60, 'y', [
        bounds([27.7, 22, -1.2], [28.3, 33, 1.2]),
      ]),
      region('left-rear', [24, 45, 1.49], [34, 60, 1.51], 50, 'y', [
        bounds([27.7, 47, -1.2], [28.3, 57, 1.2]),
      ]),
    ],
    networkRegion: {
      id: 'panel-bearing-apron-network',
      partId: 'case-lower-cradle',
      ...bounds([24, 2, -19.7], [142, 71.5, 1.5]),
      minimumVolumeMm3: 10000,
    },
    limits:
      'The front and rear lands follow the actual shaped panel opening, with matched outward toes kept below the terminal corridors. Every region requires actual plate bearing, longitudinal coverage and finite rooted connections. The 3 mm apron prints directly on the existing Z1.5 bed face; separate underside loft teeth are removed. These are geometric load-path checks, not a strength or clamp-force rating.',
  };
}

function casePanelBearingApron(p: Parameters): Shape {
  const m = casePanelBearingApronStructure();
  const block = ({ min, max }: { min: Vec; max: Vec }) =>
    box(max.map((v, i) => v - min[i]) as Vec, min);
  return union(
    intersection(
      controlRing(p, 4, -3, -1.5, 3),
      union(block(m.frontBand), block(m.rearBand), ...m.leftReturns.map(block)),
    ),
    ...m.outwardToes.map(({ min, max }) =>
      roundedPlate(
        max[0] - min[0],
        max[1] - min[1],
        m.outwardToeCornerRadiusMm,
        [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2],
        min[2],
        max[2] - min[2],
      ),
    ),
  );
}

/** Continuous fitted upper mechanism shell carried by the four captured-post sleeves. */
export function caseControlShell(p: Parameters): Shape {
  const m = casePanelLayout(p),
    r = (z: number, h: number) =>
      subtract(
        roundedPlate(109.7, 52, 4, [82.85, 38], z, h),
        roundedPlate(103.7, 46, 1, [82.85, 38], z - 0.1, h + 0.2),
      );
  const rearLinks = [61, 106].map((x) => box([6, 9, 21.2], [x - 3, 55, -19.7]));
  const shape = union(
    r(-19.7, 21.2),

    box([5.3, 9.7, 10.5], [134.7, 54.3, -12]),
    casePanelBearingApron(p),
    ...rearLinks,
  );
  return subtract(
    shape,
    ...[m.arm1, m.arm2].map(([x, y]) => box([18.4, 20, 8], [x - 9.2, y - 25, -6])),
    box([46.4, 25.6, 20], [60.5, 22.2, -19]),
    box([20, 47, 5], [149.7, 9, -2]),
    ...m.mountingHoles.map(([x, y]) => cylinder(4.5, 4, [x, y, -2])),
  );
}

/** Positive bearing and shallow registrations; ties retain withdrawal only. */
export function caseClipBodySeat(p: Parameters): Shape {
  const m = casePanelLayout(p);
  return subtract(
    union(
      ...[12, 50].map((y) => box([14, 4, 8.2], [136, y, -19.7])),
      box([7, 42, 7.7], [149, 12, -19.7]),
      box([12, 4, 7.7], [150, 10, -19.7]),
      box([12, 4, 7.7], [150, 50, -19.7]),
      box([4, 42, 9.7], [146, 12, -19.7]),
      ...m.testClipBodyKeys.map(([x, y]) => box([3, 2, 2], [x - 1.5, y - 1, -12])),
    ),
    ...m.testClipCarrierTieCentres.flatMap((y) => [
      box([1.4, 3.2, 16], [150.8, y - 1.6, -17.2]),
      box([1.4, 3.2, 16], [159.8, y - 1.6, -17.2]),
    ]),
    ...m.testClipHousingTieCentres.map((y) => box([9, 3.2, 1.4], [149.8, y - 1.6, -13.2])),
  );
}

function caseClipTieCutters(p: Parameters): Shape[] {
  return caseClipTies(p).flatMap((tie) =>
    tie.segments.map(({ min, max }) =>
      box(
        [max[0] - min[0] + 0.6, max[1] - min[1] + 0.6, max[2] - min[2] + 0.6],
        [min[0] - 0.3, min[1] - 0.3, min[2] - 0.3],
      ),
    ),
  );
}

function testClipCarrier(p: Parameters): DetailSpec {
  const m = casePanelLayout(p);
  const carrierBlank = subtract(
    roundedPlate(61, 44, 2, m.testClipCarrierCentre, -12, 13.5),
    roundedPlate(55.8, 36.9, 0.7, [179, 31.775], -7, 50),
    box([8, 42, 50], [206.9, 10, -7]),
    // Open the thin spring-side wall between the full front/rear rails; keep the complete 5 mm floor.
    box([1.4, 35.5, 9], [149.9, 14, -7]),
    // The measured right-front wall attachment occupies only this shallow upper wall region.
    box([7.5, 13, 6.3], [206.5, 18.5, -4.3]),
    ...m.testClipBodyKeys.map((pt) => rectangularKeySlot(pt, [3, 2], -12.1, 2.3)),
    ...m.testClips.map(([x, y]) => box([3, 8, 8], [x + 19.3, y - 4, -13])),
    ...m.testClipCarrierTieCentres.flatMap((y) => [
      box([1.4, 3.2, 16], [150.8, y - 1.6, -13]),
      box([1.4, 3.2, 16], [159.8, y - 1.6, -13]),
      box([10.4, 3.2, 1.4], [150.8, y - 1.6, -3.2]),
    ]),
    ...m.testClipHousingTieCentres.flatMap((y) => [
      box([1.4, 3.2, 18], [149.8, y - 1.6, -13.2]),
      box([1.4, 3.2, 18], [157.3, y - 1.6, -13.2]),
    ]),
    ...casePwmCarrierCuts(),
    cylinder(3.8, 3.6, [207, 7, -2]),
    ...caseBrassUpperCutters('carrier'),
  );
  const carrier = union(
    carrierBlank,
    ...m.testClips.flatMap(([x, y]) =>
      [-4.8, 4.8].map((dy) => cylinder(1.4, 3, [x + 3, y + dy, -7])),
    ),
  );
  return petg(
    'case-test-clip-carrier',
    'Printed positively seated tie-retained spring-clip nest',
    operator(carrier),
    'Uniform 5 mm floor, open spring-side access, two left body registers and four brass sockets; no mounting screws',
    [
      'The carrier bears on the continuous left lower-body rail at X149..156 and short front/rear retaining ears at X150..162, all at Z−12. Two left 3 × 2 mm keys engage its underside sockets 2 mm deep. Four AF5 brass FF40 supports carry the remaining carrier load directly into solid raised floor pads; their ends engage 2.5 mm-deep AF5.3 underside hex sockets and react transverse movement. The redundant right body keys, full-width printed seat rails and former tall right piers are removed. Ties retain withdrawal and do not replace the positive seats.',
      'Two 2.5 × 1 mm nylon retaining loops lie at Y11.8 and 52.1. Their upper bands pass through wall channels at Z−3..−2 between X151..161; vertical legs pass aligned carrier/body ports at X151..152 and 160..161. Lower bands return beneath the body rails at Z−17..−16. Fit buckles on the accessible outside and remove tails from all controls.',
      'Each purchased clip sits in the original close-fitting housing nest, located by two 3 mm-high pins in its rear holes. One 2.5 × 1 mm nylon loop per clip passes its stock front slot and returns outside the spring end: XZ legs X150..151 and 157.5..158.5, topband Z3..4, return Z−13..−12, at Y23/41. No clip M2 or carrier M3 fasteners remain. Qualify both full tie paths and housing bearing faces on the delivered clips.',
      'Print the broad floor underside at Z−12 directly on the bed with the clip nests facing upward. The descending PWM wall is a separate flat keyed part, so no removable scaffold is required beneath the whole nest floor. The four shallow brass sockets, two left key sockets and the blind PWM-key receiver remain open to the underside; clear any local support from those small recesses and the tie channels.',
      'A separate flat backing carries the vertical 26 × 16 × 6 mm PWM body below the carrier. Its central tongue registers in a blind underside receiver with at least 2.8 mm roof skin, and its shoulders bear on the carrier underside. The same two full wrap ties at X173/X189 retain backing, module and perimeter keeper. The original clip load seats and all four brass sockets are unchanged. Fit the actual module and both short power/control lead ends; no load, temperature or ingress rating is assigned.',
    ],
    0x60758a,
  );
}

/** Nominal SP20 socket opening, with the source flat facing operator +Y. */
export function casePanelSp20Cutout([x, y]: Point, z: number, height: number): Shape {
  return subtract(cylinder(10.25, height, [x, y, z]), box([30, 12, height], [x - 15, y + 9.25, z]));
}

export function casePanelDetails(p: Parameters): DetailSpec[] {
  const m = casePanelLayout(p),
    { inherited, main, sleeve } = mechanismShapes(p);
  const panelCuts: Shape[] = [
    ...caseElectronicsPanelCuts(p),
    ...caseWallMountCutters(p),
    controlOutline(p, 0.15, 0.5, 9),
    ...m.connectors.flatMap(([x, y]) => [
      casePanelXtCutout([x, y], 0.5, 9),
      box(
        [...m.connectorRearPocketSize, m.connectorFlangeSeatZ - 0.5],
        [x - m.connectorRearPocketSize[0] / 2, y - m.connectorRearPocketSize[1] / 2, 0.5],
      ),
      ...[-10.25, 10.25].map((dy) => cylinder(1.5, 9, [x, y + dy, 0.5])),
      ...[-10.25, 10.25].map((dy) => cylinder(2.55, 2.5, [x, y + dy, m.connectorHeadSeatZ])),
    ]),
    ...m.indicators.flatMap(([x, y]) => [
      cylinder(8, 9, [x, y, 0.5]),
      cylinder(12.7, 5, [x, y, 0.5]),
    ]),
    ...m.sp20Connectors.flatMap((pt) => [
      casePanelSp20Cutout(pt, 0.5, 9),
      cylinder(17.5, 3, [...pt, 0.5]),
    ]),
    ...m.mountingHoles.map(([x, y]) => cylinder(2.25, 9, [x, y, 0.5])),
    ...m.batteries.map((pt) => roundedPlate(89.3, 25.3, 1, pt, 0.5, 9)),
    roundedPlate(55.8, 36.9, 0.7, [179, 31.775], 0.5, 9),
    ...m.testClipHousingTieCentres.map((y) => box([1.6, 3.2, 9], [149.8, y - 1.6, 0.5])),
    ...m.sp20Legends.map(({ text, centre }) => textCut(text, centre, 7.5)),
    ...m.indicatorLegends.map(({ text, centre }) => textCut(text, centre, 7.5)),
    textCut(m.clipLegend.text, m.clipLegend.centre, 7.5),
    ...m.batteryLabels.map((pt, i) => textCut(m.batteryLabelTexts[i], pt, 7.5)),
  ];
  const faceplate = subtract(
    operator(
      union(
        roundedPlate(m.width, m.height, m.panelCornerRadius, m.centre, 1.5, 6),
        caseWallMountShapes(p),
      ),
    ),
    operator(union(...panelCuts)),
    main(nativeServo(box([46.4, 25.6, 10], [-10.9, -12.8, 15.7]))),
  );
  const bridge = topCassette(p, sleeve);
  const details: DetailSpec[] = [
    petg(
      'parallel-base',
      'Printed front-down lettered case faceplate',
      faceplate,
      `${m.width} × ${m.height} × 6 mm plate; R${m.panelCornerRadius} corners; engraved front on the bed`,
      [
        'Print the lettered FRONT at Z7.5 directly on the bed, flipped 180 degrees. Raised servo and guard features belong to the separate front-insert cassette. One matching shaped window admits the cohesive locator body from the front, with a continuous overlapping flange bearing on the faceplate.',
        'Two XT60 E-M sockets remain left of the packs, rotated 90 degrees, with keyed 15.7 × 8.3 mm openings and diameter 3 mm screw passages on 20.5 mm pitch. There are no adjacent cable slots. B1/B2 sit closer to the packs at X116.',
        'The vertical LED column is at X136, Y130.75/107.75/84.75. I, R and P identify red, yellow and green on their right. Yellow is exactly midway between the two battery rows. TS (upper) and PS (lower) sit to the right of SP20; ICT sits above the spring clips. There is no separate PWR toggle, guard, gasket, PWR legend or START opening.',
        'Rear diameter 25.4 mm indicator reliefs leave 2 mm webs. Rear diameter 35 mm SP20 reliefs end Z3.5 and leave 4 mm webs; both source front flanges seat on Z7.5. Keep their nuts and rear tool paths accessible.',
        'Four shared M3 × 15 lid screws clamp the front cassette flange, faceplate and distributed lower-apron bearing lands together. No separate cassette retainers, blind cassette nut pockets or body screw heads remain. ARM1/ARM2 are engraved on the extended cassette front ledge, not the faceplate; B2 is the front pack and B1 the rear pack.',
        'Two integral protective battery pockets have closed recessed seats, continuous outer walls and a shared divider. Their upper edges meet the faceplate rear at Z1.5 around the unchanged 89.3 × 25.3 mm openings. Short corner guides preserve the 89 × 25 mm extraction corridors. Four corner openings register the separate continuous groove adapter.',
        'Seven shallow integral rear bosses retain their earlier coordinates: front X30/184, rear X60/154, right Y25/125, and one centred left mount at Y75. All axes lie 20 mm below the upper groove edge at Z0.5, normal to the reference tapered walls. Each side-loaded T-slot captures an ordinary M3 AF5.5 × 2.4 nut between a 2 mm load cheek and 1.3 mm inner cheek. Lift each nut from below into its rear-open loading well, then slide it into the captive seat before fitting the lower body/carrier and before the panel enters the case. The 214 × 150.6 mm R4 outline trims the previous working plate by 1 mm at each left/right edge and 0.5 mm at each front/rear edge. The centre, holes, seats and attachment coordinates are unchanged so the other printed parts can be reused. Check the perimeter, corners and actual boss gaps on the case; the earlier 0.2 mm gap and exterior screw stack remain nominal local references.',
        'The faceplate itself forms the flange of the T sections. A 3 mm underside spine, cross-rib and short rear branch stiffen the SP20 area and connect the right attachment pair. All ribs and bosses grow behind the existing Z7.5 lettered bed face, and the original cassette, connector and rear tool apertures remain open.',
        'Seven exterior M3 × 15 screws are modeled shortened to 11 mm, with nominal 0.5 mm steel washers and 0.8 mm installed/compressed sealing washers against the approximately 4 mm walls. Their tips remain recessed 0.5 mm inside the shallow bosses after full nut engagement. Verify the real wall and compressed stack before shortening screws or drilling; the reference seal does not establish an ingress rating. Toggles/clips face the handle and batteries face the hinges.',
      ],
    ),
    petg(
      'case-top-bridge',
      'Printed common servo and guarded-switch top bridge',
      operator(bridge),
      'Continuous front flange, uniform locator webs, source-swept guard lips and servo sleeve',
      [
        'Print the cassette locator underside at Z1.5 on the bed. Its common 2 mm front flange spans X26..140 and Y3.5..73, with ARM1/ARM2 engraved at Y9.5; uniform 3 mm locator webs form one visible plinth and broad connected load paths. Local collars and screw lands reinforce bearing areas; the underside remains open. Use removable supports beneath the flange and source sleeve overhangs as required; clean all contact and locator faces.',
        'Insert the cassette from the lettered front, then fit the source switches, servo, lower body and separate lid. Its overlapping flange bears on the faceplate front while the lower shell bears on the rear. The four shared M3 × 15 lid screws clamp this stack in one path; support loose parts until all four ties are engaged.',
        'The ARM1 guard base seats at Z9.5. Two genuine 3 mm end lips have 0.25 mm nominal steel-base clearance; their source-cover sweep was checked from 0..69 degrees. Low side registers end Z10.1, with the moving hinge/sides open. Qualify the reconstructed guard and printed clearances on the delivered samples.',
        'Keyed bushing collars retain their original nut floors at Z6.8 and nominal 1.5 mm TPU case frames. The source shaft datum and 0.4 mm housing-end relief remain unchanged; fit the separate exact 0.7 mm TPU strip before tightening.',
        'Four AF5 brass FF50 ends enter AF5.3 cassette underside sockets and bear at Z2.5; the original printed column keys are removed. Keep the shared screw bores clear. The former plate ARM legends are removed; the labels belong to the cassette front ledge.',
      ],
    ),
    petg(
      'case-lower-body',
      'Printed lower electronics tray with protective battery pockets',
      operator(
        subtract(
          union(caseElectronicsFloor(p), caseBatteryPockets(p), caseBrassFloorSeats()),
          ...caseBrassFloorCutters(),
        ),
      ),
      'Uniform 206.8 × 141.2 mm R6 floor with four captured-post seats and closed battery pockets',
      [
        'Print the uniform 206.8 × 141.2 mm R6 floor at Z−55.5 on the bed. Its centre remains [107,75], with the original Z−55.5..−52.5 floor thickness. The larger perimeter fully supports the existing eight brass-seat roots and four flared HAT feet without moving their axes. It remains inside the unchanged nominal lower case cavity; no case dimensions are enlarged.',
        'The two protective battery pockets retain continuous 1.6 mm walls, a shared divider, short full-height corner guides and closed 2.4 mm recessed seats at Z−53.1. They meet the faceplate rear around the accepted 89.3 × 25.3 mm openings. The 74 mm packs keep their accepted 13.4 mm front projection, and all XT60 reaction lands, screws, solder cups and full vertical pack paths remain open.',
        'Four integral sleeves on the separate cradle end on the original main screw islands at Z−49.5. The four existing bottom M3 × 8 screws clamp the 2.9 mm tray webs, 2.0 mm cradle feet and unchanged FF50 ends together. These bottom screws remain fitted when the lid is removed, so no separate seam screws, nuts, locating tongues or long tray rails are needed.',
        'Four AF5 brass FF50 supports seat at Z−47.5 and four FF40 supports at Z−49.5. Eight stock M3 × 8 screws enter the recessed underside with head bottoms at Z−55.4, keeping the original case-floor gap. Each main clamp spans 2.9 mm of tray and 2.0 mm of cradle foot, preserving the original 4.9 mm combined grip; carrier floor webs remain 2.9 mm. FF50 end depth must be at least 3.5 mm; the user confirmed at least 5.5 mm usable FF40 depth. Check actual screw bottoming before assembly.',
        'For normal service remove the packs, disconnect all leads, remove rotor/discs, the four shared M3 × 15 lid screws and the separate lid, then support the upper cassette/servo/switches. Lower the joined tray and cradle together with all eight brass supports, board keepers, hood, carrier, clips and PWM group. The two carrier ties stay fitted until its separate bench release. All four main bottom screws stay fitted during this movement; remove them only when separating the tray and cradle on the bench.',
      ],
      0x60758a,
    ),
    petg(
      'case-lower-cradle',
      'Printed fitted servo cradle with four integral captured-post sleeves',
      operator(
        subtract(
          union(
            casePanelLowerWalls(p),
            caseControlShell(p),
            caseClipBodySeat(p),
            caseLowerCradlePosts(),
            caseLowerCarrierSupportLadder(),
          ),
          ...caseBrassFloorCutters(),
          ...caseLowerCradlePostCuts(),
          ...caseClipTieCutters(p),
        ),
      ),
      'Cohesive fitted cradle, four open-access R4.5 sleeves, closed 2 mm feet and a straight bed-rooted carrier ladder',
      [
        'Print the cradle inverted, with its original Z1.5 upper frame on the bed and the four integral sleeves growing upward to an overall 51 mm height. Each sleeve extension has an outward 2.4 mm-wide cleaning slot only between Z−47.5 and −19.7; the original upper cradle and full 2.0 mm closed feet remain intact. The AF5.3 brass routes start at Z−47.5 above the Ø3.4 foot bores. The selected orientation retains local support beneath the real internal closing ledges; remove it through the cleaning openings before inserting the metal posts. All complete clip tie-return bands remain open.',
        'A straight carrier-side ladder has a 4.3 mm main-wall spine, a 3.5 mm seat-side spine and two separated 4 mm transverse ribs, all extending directly from the inverted Z1.5 bed face to Z−12. Its full 3 mm lap into the existing main wall replaces the former thin flange and diagonal web. The ribs at Y18..22 and46..50 meet straight wall regions; the outer spine ends at X149.5 and joins the existing clip-seat side wall over a full 2 mm height. The original fitted upper cradle, ARM1 pocket, matched front/rear panel-bearing apron and all carrier seats, keys, ties and four FF40 supports retain their accepted positions.',
        'The original 46.4 × 25.6 mm ST3215 cavity, four exact axial seats, twelve source-derived servo/switch guide probes and open underside cable corridor retain their accepted positions. Fit the exact 0.7 mm TPU strip. No servo or control component is moved.',
        'Seat the four feet on the tray at Z−49.5, insert the existing AF5 FF50 stock from above through the AF5.3 sleeve routes and fasten the original bottom M3 × 8 screws. Brass bottoms stay Z−47.5, screw under-head planes stay Z−52.4 and tips stay Z−44.4, preserving 3.1 mm nominal lower-end engagement and all upper lid datums. The four bottom screws retain the lower assembly even with all lid screws removed. Verify at least 3.5 mm usable female depth in both ends of the actual stock. No extra joint fasteners or centering pieces remain.',
        'A uniform 3 mm apron follows the front and rear panel opening, with two clean left returns. Matched widened front toes remain below Y10 so the terminal corridors stay open. The front ARM1 toe has a broad route around its servo-side corridor edge; it does not rely on the former clipped strip. The former separate pad lofts are removed, and the apron prints directly on the Z1.5 bed face.',
        'The carrier keeps its existing left bearing rail, two body keys and two retaining ears at their accepted contact planes. Four FF40 metal supports carry its other corners. Existing clip/carrier/PWM ties, complete 30-degree clip motion and all module/keeper paths remain required fit checks. Clear the small service openings, receiving pockets and tie passages; no force, temperature or sealing rating is assigned.',
      ],
      0x60758a,
    ),
    ...inherited
      .filter((d) => ['parallel-clamp', 'parallel-rocker', 'parallel-switch-gasket'].includes(d.id))
      .map((d) => ({
        ...d,
        shape: main(d.shape),
        requirements: (d.requirements ?? []).map((requirement) =>
          d.id === 'parallel-clamp' && requirement.startsWith('Four M3 × 30 mm')
            ? 'Four shared stock M3 × 15 mm socket screws seat at global Z14.3 and clamp the separate lid, front cassette and faceplate into four AF5 brass FF50 standoffs. Their ends reach Z−0.7, giving 3.2 mm nominal upper-end engagement. Verify at least 3.5 mm usable thread depth in the actual FF50 ends and fit the source contact-face spacing before tightening.'
            : requirement,
        ),
      })),
    tpu(
      'case-servo-shim',
      'TPU ST3215 fitting shim · 0.7 mm',
      main(nativeServo(box([0.7, 25.6, 27.5], [-10.9, -12.8, -1.5]))),
      '0.7 × 25.6 × 27.5 mm fitting strip',
      [
        'Print the broad face flat, exactly 0.7 mm thick. Fit native X−10.9 to −10.2 between the toggle and shaft, leaving approximately 0.088 mm to the source middle case. Measure the actual servo and TPU before tightening.',
      ],
    ),
    ...[[m.arm1, 'parallel-manual-gasket', 'ARM 1']].map(([centre, id, name]) => {
      const pt = centre as Point;
      return tpu(
        id as string,
        `TPU ${name} case-seat gasket`,
        operator(subtract(roundedPlate(16, 28, 1, pt, 0, 1.5), cylinder(6.3, 3.5, [...pt, -1]))),
        '16 × 28 × 1.5 mm switch case frame',
        [
          'Print flat and fit between the source case at Z0 and the top-bridge collar underside at Z1.5. Keep the rigid lower-body joints free of TPU.',
        ],
      );
    }),
    testClipCarrier(p),
    petg(
      'case-pwm-backing',
      'Printed flat keyed PWM backing plate',
      operator(casePwmBacking()),
      'Separate flat backing with a 2.1 mm keyed tongue and positive shoulder seats; two existing PWM ties',
      [
        'Print the broad module-facing XZ face flat on the bed using the supplied −90-degree X rotation. The central tongue is part of the same planar plate; no descending carrier wall or extra screws are added.',
        'Insert the backing upward from below until both shoulders meet the carrier at Z−12. Its 10 × 2.5 mm tongue engages 2.1 mm in the blind receiver, with at least 2.8 mm carrier roof above it. The backing bottom meets the nominal lower tie-band tops at Z−27.1; after the maximum 0.3 mm downward loop travel in the upper carrier channels, 1.8 mm engagement remains. Qualify the printed key, channels and real band thickness before use.',
        'Keep the PWM pose, receiving pocket, perimeter keeper and short-edge lead corridors unchanged. For service remove the populated carrier on the bench, release the PWM ties and support/remove the module and keeper, then lower this backing 3 mm and move it 15 mm away. Both clips may remain fitted.',
      ],
      0x60758a,
    ),
    petg(
      'case-pwm-keeper',
      'Printed vertical PWM perimeter keeper',
      operator(casePwmKeeper()),
      'Flat perimeter frame against the vertical user-sized PWM body; two full wrap ties',
      [
        'Print its broad XZ face on the bed using the supplied rotated STL. The frame touches only the perimeter of the complete user-provided 26 × 16 × 6 mm body envelope; no PCB thickness or pad-free component construction is asserted. Fit its bearing lands to the real module.',
        'The module is vertical below the carrier, against a separate keyed flat backing retained by the same two PWM ties. Its pose is [181,31,−18.8], rotation −90 degrees around X. A shallow 1.2 mm receiving pocket leaves 3.8 mm of carrier floor above the body; the separate backing key lies between the tie lanes and retains at least 2.8 mm roof above its receiver. The short power/control lead ends at X168 and X194 remain open.',
        'Two full 2.5 × 1 mm wrap ties at X173 and X189 pass through the dedicated upper channels and around the solid wall and perimeter keeper. Their lower bands end at Z−28.1, nominally more than 1 mm above the highest HAT feature. Clear all support material from those routes and qualify actual insulation and lead bends before tightening.',
        'For PWM service first detach the populated lower body on the bench, release the two carrier-retaining ties and lift the complete carrier/clips/PWM group 60 mm off the four brass supports. On that separate carrier release both PWM ties and disconnect the leads, then move the keeper 0.5 mm outward, 15 mm down and 45 mm right. Both clips stay fitted during that route. Check the complete path against delivered wiring; no force or thermal rating is assigned.',
      ],
      0x9baab7,
    ),
  ];
  return details.map((detail) => ({
    ...detail,
    explode:
      detail.id === 'case-top-bridge'
        ? [0, 0, 30]
        : ['case-lower-body', 'case-lower-cradle', 'case-test-clip-carrier'].includes(detail.id)
          ? [0, 0, -85]
          : detail.id.includes('-key')
            ? [0, 0, 12]
            : detail.id === 'case-servo-shim'
              ? [40, 20, 35]
              : detail.explode,
  }));
}

function caseClipTies(p: Parameters) {
  const m = casePanelLayout(p);
  const bounds = (min: Vec, max: Vec) => ({ min, max });
  const loop = (x0: number, x1: number, y: number, z0: number, z1: number) => [
    bounds([x0, y - 1.25, z0], [x1, y + 1.25, z0 + 1]),
    bounds([x0, y - 1.25, z1 - 1], [x1, y + 1.25, z1]),
    bounds([x0, y - 1.25, z0], [x0 + 1, y + 1.25, z1]),
    bounds([x1 - 1, y - 1.25, z0], [x1, y + 1.25, z1]),
  ];
  return [
    ...m.testClipCarrierTieCentres.map((y, i) => ({
      id: `clip-carrier-retention-${i + 1}`,
      frame: { at: [0, 0, 0] as Vec, rotation: [0, 0, 0] as Vec },
      segments: loop(151, 161, y, -17, -2),
    })),
    ...m.testClipHousingTieCentres.map((y, i) => ({
      id: `clip-housing-retention-${i + 1}`,
      frame: { at: [0, 0, 0] as Vec, rotation: [0, 0, 0] as Vec },
      segments: loop(150, 158.5, y, -13, 4),
    })),
  ];
}

/** Operator-frame geometric fixtures for continuity, positive seating and complete tie paths. */
export function casePanelStructure(p: Parameters) {
  const m = casePanelLayout(p);
  const bounds = (min: Vec, max: Vec) => ({ min, max });
  return {
    modularElectronics: caseModularElectronics(p),
    lowerSplit: caseLowerSplitStructure(),
    fourPostCapture: caseLowerFourPostCapture(),
    panelBearingApron: casePanelBearingApronStructure(),
    printFamilies: {
      panel: ['parallel-base'],
      cassette: ['case-top-bridge'],
      lowerAssembly: ['case-lower-body', 'case-lower-cradle'],
      clipAssembly: ['case-test-clip-carrier', 'case-pwm-backing'],
      electronicsAdapters: [...electronicsAdapterIds],
    },
    batteryPockets: caseBatteryPocketStructure(p),
    brassSupports: caseBrassStructure(),
    pwmSupport: casePwmStructure(),
    sections: [
      ...[-1, 1].map((z) => ({
        id: `control-shell-${z}`,
        partId: 'case-lower-cradle',
        min: [28, 12] as Point,
        max: [140, 64] as Point,
        z,
        minimumAreaMm2: 0,
        requireConnected: false,
        exclude: [
          bounds([29.8, 27.8, z - 0.1], [46, 42.2, z + 0.2]),
          bounds([62, 37.8, z - 0.1], [70, 42.2, z + 0.2]),
          bounds([121.8, 27.8, z - 0.1], [128, 32.2, z + 0.2]),
        ],
      })),
      {
        id: 'cassette-front-plinth',
        partId: 'case-top-bridge',
        min: [26, 4] as Point,
        max: [140, 69] as Point,
        z: 8.5,
        minimumAreaMm2: 1000,
      },
    ],
    networkRegions: [
      {
        id: 'control-upper-load-network',
        partId: 'case-lower-cradle',
        min: [24, 5, -19.7] as Vec,
        max: [141, 71.5, 1.5] as Vec,
        minimumVolumeMm3: 10000,
      },
    ],
    webWitnesses: [
      ...caseLowerCarrierSupportStructure().webWitnesses,
      {
        id: 'servo-cradle-front-wall',
        partId: 'case-lower-cradle',
        ...bounds([76, 18, -13], [88, 20.5, 0.5]),
      },
      {
        id: 'servo-cradle-rear-wall',
        partId: 'case-lower-cradle',
        ...bounds([76, 49.5, -13], [88, 52, 0.5]),
      },
      {
        id: 'manual-servo-front-joint',
        partId: 'case-lower-cradle',
        ...bounds([52.1, 16.7, -14], [57.9, 20.5, -7]),
      },
      {
        id: 'manual-servo-rear-joint',
        partId: 'case-lower-cradle',
        ...bounds([52.1, 49.5, -14], [57.9, 53.3, 0.5]),
      },
      ...[
        ['clip-seat-front-root', [136.2, 12.2, -15.8], [137.5, 14.8, -12.2]],
        ['clip-seat-rear-root', [136.2, 50.2, -15.8], [137.5, 53.8, -12.2]],
        ['clip-seat-front-left-joint', [148.7, 12.2, -13.8], [150.3, 13.8, -12.2]],
        ['clip-seat-rear-left-joint', [148.7, 50.2, -13.8], [150.3, 51.8, -12.2]],
        ['clip-tie-front-ear-root', [155.5, 12.2, -15.6], [156.5, 13.8, -12.2]],
        ['clip-tie-rear-ear-root', [155.5, 50.2, -15.6], [156.5, 51.8, -12.2]],
      ].map(([id, min, max]) => ({
        id: id as string,
        partId: 'case-lower-cradle',
        ...bounds(min as Vec, max as Vec),
      })),
    ],
    mechanismAxialSeats: [
      {
        id: 'servo-rear-front',
        min: [69, 23.45, -16.72] as Vec,
        max: [77, 25.55, -16.68] as Vec,
        area: 15,
      },
      {
        id: 'servo-rear-back',
        min: [69, 44.45, -16.72] as Vec,
        max: [77, 46.55, -16.68] as Vec,
        area: 15,
      },
      {
        id: 'servo-shaft-front',
        min: [91, 22.9, -15.22] as Vec,
        max: [101, 25.05, -15.18] as Vec,
        area: 18.5,
      },
      {
        id: 'servo-shaft-back',
        min: [91, 44.95, -15.22] as Vec,
        max: [101, 47.1, -15.18] as Vec,
        area: 18.5,
      },
    ].map(({ id, min, max, area }) => ({
      id,
      hostId: 'drive-servo',
      partId: 'case-lower-cradle',
      contactBox: bounds(min, max),
      normal: [0, 0, 1] as Vec,
      minimumAreaMm2: area,
    })),
    mechanismGuides: [
      ...[
        { at: m.arm1, hostId: 'manual-toggle-switch' },
        { at: m.arm2, hostId: 'toggle-switch' },
      ].flatMap(({ at: [x, y], hostId }) =>
        [-16, -3].flatMap((z) =>
          [-1, 1].map((side) => {
            const guideY =
              hostId === 'manual-toggle-switch' && z === -3 && side < 0 ? y - 1 : y + side * 5;
            return {
              id: `${hostId}-${z}-${side}`,
              hostId,
              partId: 'case-lower-cradle',
              probe: bounds(
                [side < 0 ? x - 8.9 : x + 8.4, guideY - 2, z],
                [side < 0 ? x - 8.4 : x + 8.9, guideY + 2, z + 2],
              ),
              nominalGapMm: 0.4,
              gapToleranceMm: 0.1,
              minimumPrintedVolumeMm3: 3.9,
            };
          }),
        ),
      ),
      ...[-12, -3].flatMap((z) => [
        {
          id: `servo-front-guide-${z}`,
          hostId: 'drive-servo',
          partId: 'case-lower-cradle',
          probe: bounds([80, 21.7, z], [84, 22.2, z + 2]),
          nominalGapMm: z === -12 ? 0.506975576 : 0.456605128,
          gapToleranceMm: 0.005,
          minimumPrintedVolumeMm3: 3.9,
        },
        {
          id: `servo-rear-guide-${z}`,
          hostId: 'drive-servo',
          partId: 'case-lower-cradle',
          probe: bounds([80, 47.8, z], [84, 48.3, z + 2]),
          nominalGapMm: z === -12 ? 0.506975576 : 0.456605128,
          gapToleranceMm: 0.005,
          minimumPrintedVolumeMm3: 3.9,
        },
      ]),
    ],
    bearings: [
      {
        id: 'cassette-front-flange',
        movingId: 'case-top-bridge',
        fixedId: 'parallel-base',
        shift: [0, 0, -0.01] as Vec,
        minimumAreaMm2: 300,
      },
      {
        id: 'lower-panel-shoulder',
        movingIds: ['case-lower-cradle', 'case-lower-body'],
        fixedId: 'parallel-base',
        shift: [0, 0, 0.01] as Vec,
        minimumAreaMm2: 500,
      },
      {
        id: 'carrier-positive-seat',
        movingId: 'case-test-clip-carrier',
        fixedId: 'case-lower-cradle',
        shift: [0, 0, -0.01] as Vec,
        minimumAreaMm2: 100,
      },
      ...['red', 'black'].map((colour) => ({
        id: `clip-housing-${colour}`,
        movingId: `case-test-clip-${colour}`,
        fixedId: 'case-test-clip-carrier',
        shift: [0, 0, -0.01] as Vec,
        minimumAreaMm2: 100,
      })),
    ],
    ties: [...casePwmTies(), ...caseClipTies(p)],
    registrations: [
      ...m.testClipBodyKeys.map(([x, y], i) => ({
        id: `carrier-register-${i + 1}`,
        partId: 'case-lower-cradle',
        matingId: 'case-test-clip-carrier',
        engagementMm: 2,
        probe: bounds([x - 1.4, y - 0.9, -11.9], [x + 1.4, y + 0.9, -10.1]),
      })),
    ],
    carrierBrassRegisters: caseBrassStructure()
      .supports.filter((support) => support.role === 'carrier')
      .map((support) => ({
        id: `${support.id}-carrier-register`,
        supportId: support.id,
        partId: 'case-test-clip-carrier',
        axisPoint: [support.axisPoint[0], support.axisPoint[1], -12] as Vec,
        acrossFlatsMm: 5.3,
        hexClockDegrees: 30,
        engagementMm: 2.5,
        minZ: -12,
        maxZ: -9.5,
        maximumTransverseGapMm: 0.174,
        blockingTranslationMm: 0.4,
      })),
    printRotations: {
      ...Object.fromEntries(electronicsAdapterIds.map((id) => [id, [0, 0, 0] as Vec])),
      'parallel-base': [180, 0, 0] as Vec,
      'case-top-bridge': [0, 0, 0] as Vec,
      'case-lower-body': [0, 0, 0] as Vec,
      'case-lower-cradle': [180, 0, 0] as Vec,
      'case-test-clip-carrier': [0, 0, 0] as Vec,
      'case-pwm-backing': [-90, 0, 0] as Vec,
      'case-pwm-keeper': [90, 0, 0] as Vec,
    },
  };
}

/** Four shared lid ties; the cassette, body and clip carrier need no duplicate screw sets. */
export function casePanelHardware(p: Parameters): ConfiguredPiece[] {
  const m = casePanelLayout(p),
    result: ConfiguredPiece[] = [...caseWallMountHardware(p), ...caseBrassHardware()];
  for (const [i, [x, y]] of m.bodyMountAxes.entries())
    result.push(screw(`case-lid-screw-${i + 1}`, 3, 15, casePanelCanonicalPoint([x, y, 14.3])));
  return result;
}
