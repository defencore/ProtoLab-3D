import type { Parameters } from '../../../core/types';
import { box, cylinder, union, type Shape } from '../../../core/assembly/boundary/shapes';

export const isParallel = (p: Parameters) =>
  p.mechanism === 'parallel' || p.mechanism === 'parallel-dual';
export const isDual = (p: Parameters) => p.mechanism === 'parallel-dual';

/** Full-width side access for the switch blade and its insulated receptacle. */
export function parallelTerminalChannel(switchY = 0): Shape {
  return box([12, 18.4, 7.6], [13, switchY - 9.2, -6]);
}

/** Install the two-switch panel horizontally: manual ARM 1 on the left. */
export const dualPanelPoint = ([x, y, z]: readonly [number, number, number]): [
  number,
  number,
  number,
] => [y, -x, z];

/** Flat rounded profile extruded along Z; inner clearances remain independently defined. */
export function roundedPlate(
  width: number,
  height: number,
  radius: number,
  centre: readonly [number, number],
  z: number,
  thickness: number,
): Shape {
  const [x, y] = centre;
  return union(
    box([width - 2 * radius, height, thickness], [x - width / 2 + radius, y - height / 2, z]),
    box([width, height - 2 * radius, thickness], [x - width / 2, y - height / 2 + radius, z]),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        cylinder(radius, thickness, [
          x + sx * (width / 2 - radius),
          y + sy * (height / 2 - radius),
          z,
        ]),
      ),
    ),
  );
}

/** Installation dimensions; cable/clip envelopes are authored studies, not supplier plug CAD. */
export function parallelPanelInterface(p: Parameters) {
  const length = Number(p.baseLength),
    width = Number(p.baseWidth),
    dual = isDual(p),
    flangeY = dual ? -47 : -27;
  return {
    mountingPlane: 0,
    flangeBottom: 1.5,
    flangeThickness: 6,
    flangeTop: 7.5,
    flangeCornerRadius: 4,
    gasketThickness: 1.5,
    switchNutSeat: { radius: 9.3, floorZ: 6.8 },
    flangeCentre: [0, flangeY] as const,
    manualSwitch: dual
      ? {
          centre: [0, -90] as const,
          webTop: 6.8,
          guardSeat: {
            centre: [-7, -90] as const,
            outerSize: [42.6, 19] as const,
            pocketSize: [41, 17.4] as const,
            floorZ: 9.5,
            rimZ: 9.7,
            depth: 0.2,
            lateralClearance: 0.2,
          },
          tieAxes: [
            [-22, -101],
            [22, -76],
          ] as const,
        }
      : undefined,
    cutout: {
      width: 56,
      height: dual ? 124 : 84,
      radius: 4,
      centre: [0, dual ? -48 : -28] as const,
      terminalNotch: { width: 16, height: 20, radius: 2, centre: [34, 0] as const },
      additionalTerminalNotches: dual
        ? [{ width: 16, height: 20, radius: 2, centre: [34, -90] as const }]
        : [],
    },
    mountingHoles: [-1, 1].flatMap((side) =>
      [-1, 1].map((end) => [side * (length / 2 - 8), flangeY + end * (width / 2 - 8)] as const),
    ),
    holeDiameter: 4.5,
    // A straight approach to 0.1 mm before the source rear cover, not an inferred port.
    cableApproach: { nativeMin: [-10, -9, -35] as const, nativeMax: [35, 9, -4.2] as const },
    groundClip: {
      min: [14.5, -7, -5.1] as const,
      size: [17, 14, 5] as const,
      insertionStroke: 10,
      lateralOffsets: [-1, 0, 1] as const,
      approachSide: 'positive-x',
    },
  };
}

/** The union's right branch provides horizontal ground-terminal clip approach space. */
export function parallelHostOpening(
  p: Parameters,
  z: number,
  height: number,
  clearance = 0,
): Shape {
  const { cutout } = parallelPanelInterface(p),
    notch = cutout.terminalNotch;
  return union(
    roundedPlate(
      cutout.width + 2 * clearance,
      cutout.height + 2 * clearance,
      cutout.radius + clearance,
      cutout.centre,
      z,
      height,
    ),
    roundedPlate(
      notch.width + 2 * clearance,
      notch.height + 2 * clearance,
      notch.radius + clearance,
      notch.centre,
      z,
      height,
    ),
    ...cutout.additionalTerminalNotches.map((extra) =>
      roundedPlate(
        extra.width + 2 * clearance,
        extra.height + 2 * clearance,
        extra.radius + clearance,
        extra.centre,
        z,
        height,
      ),
    ),
  );
}

/** Operator-facing coordinates used by mounting templates and exported installation plates. */
export function installedPanelInterface(p: Parameters) {
  const panel = parallelPanelInterface(p),
    point = ([x, y]: readonly [number, number]): [number, number] => [y, -x];
  if (!isDual(p)) return { ...panel, flangeSize: [Number(p.baseLength), Number(p.baseWidth)] };
  const notch = (
    value:
      typeof panel.cutout.terminalNotch | (typeof panel.cutout.additionalTerminalNotches)[number],
  ) => ({
    ...value,
    width: value.height,
    height: value.width,
    centre: point(value.centre),
  });
  return {
    ...panel,
    installationRotationZ: -90,
    flangeSize: [Number(p.baseWidth), Number(p.baseLength)],
    flangeCentre: point(panel.flangeCentre),
    manualSwitch: panel.manualSwitch
      ? {
          ...panel.manualSwitch,
          centre: point(panel.manualSwitch.centre),
          tieAxes: panel.manualSwitch.tieAxes.map(point),
          guardSeat: {
            ...panel.manualSwitch.guardSeat,
            centre: point(panel.manualSwitch.guardSeat.centre),
            outerSize: [...panel.manualSwitch.guardSeat.outerSize].reverse(),
            pocketSize: [...panel.manualSwitch.guardSeat.pocketSize].reverse(),
          },
        }
      : undefined,
    cutout: {
      ...panel.cutout,
      width: panel.cutout.height,
      height: panel.cutout.width,
      centre: point(panel.cutout.centre),
      terminalNotch: notch(panel.cutout.terminalNotch),
      additionalTerminalNotches: panel.cutout.additionalTerminalNotches.map(notch),
    },
    mountingHoles: panel.mountingHoles.map(point),
    groundClip: {
      ...panel.groundClip,
      min: [-7, -31.5, -5.1],
      size: [14, 17, 5],
      insertionAxis: 'y',
      lateralAxis: 'x',
      approachSide: 'negative-y',
    },
    legends: [
      { text: 'ARM 1', switch: 'manual-toggle-switch', centre: [-90, -36], depth: 0.6 },
      { text: 'ARM 2', switch: 'toggle-switch', centre: [0, -36], depth: 0.6 },
    ],
  };
}
