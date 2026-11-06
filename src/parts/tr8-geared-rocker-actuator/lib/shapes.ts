import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { currentGeometryMode } from '../../../core/geometry-mode';
import { gearValues, involuteProfile } from '../../../core/hardware/gears';
import {
  shaftBoreDefaults,
  shaftBoreValues,
  shaftBoreOutline,
} from '../../../core/hardware/shaft-bore';
import { fixed as f, thread } from './layout';

export const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const axial = (r: number, from: number, to: number): Shape =>
  cylinder(r, to - from, [from, 0, 0], 'x');
export const annulus = (outer: number, inner: number, from: number, to: number): Shape =>
  subtract(
    cylinder(outer, to - from, [0, 0, from]),
    cylinder(inner, to - from + 0.2, [0, 0, from - 0.1]),
  );
export const ringGroove = (g: { center: number; width: number; rootDiameter: number }): Shape =>
  annulus(3.1, g.rootDiameter / 2, g.center - g.width / 2, g.center + g.width / 2);
const grooveX = (g: { center: number; width: number; rootDiameter: number }) =>
  move(ringGroove(g), [0, 0, 0], [0, 90, 0]);

/** Two-start 30 degree trapezoidal profile. Female phase stays fixed while the nut translates. */
export function threadedStock(length: number, centerX: number, female = false): Shape {
  if (currentGeometryMode() !== 'full')
    return axial(female ? 4.05 : 4, centerX - length / 2, centerX + length / 2);
  const root = female ? 3.05 : 2.75,
    tip = female ? 4.25 : 4,
    tangent = Math.tan(Math.PI / 12),
    allowance = female ? 0.08 : 0;
  const halfRoot = 0.5 - (root - 3.5) * tangent + allowance,
    halfTip = 0.5 - (tip - 3.5) * tangent + allowance;
  const rootAngle = (2 * Math.PI * halfRoot) / thread.lead,
    tipAngle = (2 * Math.PI * halfTip) / thread.lead;
  const outline: [number, number][] = [];
  const point = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  for (let start = 0; start < thread.starts; start++) {
    const c = start * Math.PI;
    for (let i = 0; i <= 8; i++)
      outline.push(
        point(root + ((tip - root) * i) / 8, c - rootAngle + ((rootAngle - tipAngle) * i) / 8),
      );
    for (let i = 1; i <= 16; i++) outline.push(point(tip, c - tipAngle + (2 * tipAngle * i) / 16));
    for (let i = 1; i <= 8; i++)
      outline.push(
        point(tip - ((tip - root) * i) / 8, c + tipAngle + ((rootAngle - tipAngle) * i) / 8),
      );
    for (let i = 1; i < 16; i++)
      outline.push(point(root, c + rootAngle + ((Math.PI - 2 * rootAngle) * i) / 16));
  }
  const phase = (2 * Math.PI * (female ? f.outputX : centerX)) / thread.lead;
  const layers = Math.max(16, Math.ceil((length / thread.lead) * 48));
  const rings: Vec[][] = Array.from({ length: layers + 1 }, (_, i) => {
    const z = length * (i / layers - 0.5),
      a = phase + (2 * Math.PI * z) / thread.lead;
    return outline.map(([x, y]): Vec => [
      x * Math.cos(a) - y * Math.sin(a),
      x * Math.sin(a) + y * Math.cos(a),
      z,
    ]);
  });
  return move(
    {
      kind: 'helical-worm',
      rings,
      tip,
      root,
      length,
      lead: thread.lead,
      starts: thread.starts,
      phase,
      hand: 1,
      grooveRoot: 1 - halfRoot,
      grooveTip: 1 - halfTip + 0.15 * tangent,
      radialExtra: 0.15,
      startZ: -length / 2 - thread.lead,
    },
    [centerX, 0, 0],
    [0, 90, 0],
  );
}

export function screwShape(): Shape {
  return subtract(
    union(
      threadedStock(f.threadEnd - f.threadStart, (f.threadStart + f.threadEnd) / 2),
      axial(f.screwDriveDiameter / 2, f.screwStart, f.frontNeckStart),
      axial(f.clipNeckDiameter / 2, f.frontNeckStart - 0.05, f.frontBearingX - 1.5 + 0.05),
      axial(3, f.frontBearingX - 1.5, f.threadStart + 0.05),
      axial(3, f.threadEnd - 0.05, f.rearBearingX + 1.5),
      axial(f.clipNeckDiameter / 2, f.rearBearingX + 1.5 - 0.05, f.screwEnd),
    ),
    grooveX(f.frontGroove),
    grooveX(f.rearGroove),
    cylinder(f.screwGearPinDiameter / 2, 6.2, [f.gearPinX, 0, -3.1]),
  );
}
export function nutShape(): Shape {
  return subtract(
    union(
      move(roundedRect(f.nutLength, f.nutWidth, 1, -f.nutHeight / 2, f.nutHeight), [0, 0, 0]),
      cylinder(2, 4.25, [0, 0, 6.95]),
      cylinder(2, 4.25, [0, 0, -11.2]),
    ),
    threadedStock(f.nutLength + 0.4, 0, true),
    ...[-1, 1].map((side) =>
      axial(
        f.nutEndReliefDiameter / 2,
        side < 0 ? -f.nutLength / 2 - 0.1 : f.nutLength / 2 - f.nutEndReliefDepth,
        side < 0 ? -f.nutLength / 2 + f.nutEndReliefDepth : f.nutLength / 2 + 0.1,
      ),
    ),
  );
}
/** Finished planar laser contour; the transverse edge drill is a later operation. */
export function forkPlateOutline(): [number, number][] {
  const half = 4.5,
    hub = 6,
    slot = f.slotWidth / 2;
  const hubAngle = Math.acos(half / hub),
    mouthAngle = Math.acos(slot / half);
  const hubY = Math.sqrt(hub * hub - half * half),
    mouthY = 21 + Math.sqrt(half * half - slot * slot);
  const arc = (
    x: number,
    y: number,
    r: number,
    a: number,
    b: number,
    steps: number,
  ): [number, number][] =>
    Array.from({ length: steps + 1 }, (_, i) => [
      x + r * Math.cos(a + ((b - a) * i) / steps),
      y + r * Math.sin(a + ((b - a) * i) / steps),
    ]);
  return [
    [half, hubY],
    [half, 21],
    ...arc(0, 21, half, 0, mouthAngle, 16).slice(1),
    [slot, f.slotStart],
    ...arc(0, f.slotStart, slot, 0, -Math.PI, 24).slice(1),
    [-slot, mouthY],
    ...arc(0, 21, half, Math.PI - mouthAngle, Math.PI, 16).slice(1),
    [-half, hubY],
    ...arc(0, 0, hub, Math.PI - hubAngle, 2 * Math.PI + hubAngle, 64).slice(1, -1),
  ];
}
export function forkBlankShape(): Shape {
  return subtract(
    prism(forkPlateOutline(), f.forkThickness, 0),
    cylinder(f.forkBore / 2, f.forkThickness + 0.2, [0, 0, -0.1]),
  );
}
/** Both occurrences use this same 3 mm plate definition, including the edge cross-hole. */
export function forkShape(): Shape {
  return subtract(
    forkBlankShape(),
    cylinder(f.forkCrossPinDiameter / 2, 12.2, [-6.1, 0, f.forkThickness / 2], 'x'),
  );
}
export const outputHoleCenters = (): [number, number][] => [
  [f.outputHoleRadius, 0],
  [-f.outputHoleRadius, 0],
  [0, f.outputHoleRadius],
  [0, -f.outputHoleRadius],
];
export function shaftShape(): Shape {
  const bearingTop = f.outputBearingZ + 1.5,
    bearingBottom = -bearingTop;
  const head = union(
    cylinder(f.clipNeckDiameter / 2, bearingBottom - f.outputShaftEnd + 0.05, [
      0,
      0,
      f.outputShaftEnd,
    ]),
    cylinder(3, bearingTop - bearingBottom + 0.05, [0, 0, bearingBottom]),
    cylinder(f.outputNeckDiameter / 2, f.outputHeadBottom - bearingTop + 0.05, [0, 0, bearingTop]),
    cylinder(f.outputHeadDiameter / 2, f.outputHeadTop - f.outputHeadBottom, [
      0,
      0,
      f.outputHeadBottom,
    ]),
  );
  const g = f.outputGroove;
  return subtract(
    head,
    ringGroove(g),
    ...[-f.forkCrossPinZ, f.forkCrossPinZ].map((z) =>
      cylinder(f.forkCrossPinDiameter / 2, 6.2, [-3.1, 0, z], 'x'),
    ),
    ...outputHoleCenters().map(([x, y]): Shape => ({
      kind: 'cylinder',
      radius: 1.5,
      height: 3.6,
      origin: [x, y, f.outputHeadThreadStart],
      axis: 'z',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.04 },
    })),
  );
}
export const gearParameters = {
  ...shaftBoreDefaults(),
  module: 1,
  teeth: 24,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: f.gearWidth,
  bore: 0,
  hub: false,
};
const profile = involuteProfile(gearValues(gearParameters));
export const gearOutline = (): [number, number][] => profile.points.map((p) => [p.x, p.y]);
export const gearBore = (pinion = false) =>
  shaftBoreValues({
    ...gearParameters,
    bore: pinion ? 3.175 : f.screwGearBore,
    boreShape: 'round',
  });
export const gearBoreOutline = (pinion = false): [number, number][] =>
  shaftBoreOutline(gearBore(pinion)).map((p) => [p.x, p.y]);
export function gearShape(pinion = false): Shape {
  // Triangulate concave tooth caps together with their bore. Boolean cutting
  // an untriangulated loft cap corrupts the preview's closed gear surface.
  const blank: Shape = {
    kind: 'curve-loft',
    previewSamples: 3,
    previewBoreSegments: 24,
    segments: profile.segments,
    shaftBore: gearBore(pinion),
    layers: [
      { scale: 1, angle: 0, z: -f.gearWidth / 2 },
      { scale: 1, angle: 0, z: f.gearWidth / 2 },
    ],
  };
  const hubCylinder = (radius: number, from: number, to: number): Shape => ({
    kind: 'cylinder',
    radius,
    height: to - from,
    origin: [from, 0, 0],
    axis: 'x',
    previewSegments: 24,
  });
  const hub = subtract(
    hubCylinder(f.gearHubDiameter / 2, f.gearHubStart, f.gearHubEnd + 0.05),
    hubCylinder(
      pinion ? 3.175 / 2 : f.screwGearBore / 2,
      f.gearHubStart - 0.1,
      f.gearHubEnd + 0.15,
    ),
  );
  return subtract(union(move(blank, [(f.gearStart + f.gearEnd) / 2, 0, 0], [0, 90, 0]), hub), {
    kind: 'cylinder',
    radius: (pinion ? f.motorGearPinDiameter : f.screwGearPinDiameter) / 2,
    height: f.gearHubDiameter + 0.2,
    origin: [f.gearPinX, 0, -f.gearHubDiameter / 2 - 0.1],
    axis: 'z',
    previewSegments: 12,
  });
}

export function frameShape(): Shape {
  const plate = (x: number, low: number, high: number, height = 30) =>
    move(roundedRect(height, high - low, 3, x, 3), [0, (low + high) / 2, 0], [0, 90, 0]);
  const bearingOuter = f.outputBearingZ + 1.5,
    bearingInner = f.outputBearingZ - 1.5;
  const ears = [-bearingOuter, bearingInner].map((z) =>
    union(
      box([f.outputX - f.frontPlateEnd + 0.2, 12, 3], [f.frontPlateEnd - 0.1, f.outputY - 6, z]),
      cylinder(7, 3, [f.outputX, f.outputY, z]),
    ),
  );
  return subtract(
    union(
      plate(f.frontPlateStart, f.outputY - 7, 42),
      plate(31, -6.5, 42, 34),
      box([31 - f.frontPlateEnd + 0.2, 3, 30], [f.frontPlateEnd - 0.1, 39, -15]),
      ...ears,
    ),
    ...[f.frontPlateStart - 0.1, 30.9].map((x) => cylinder(f.bearingSeat / 2, 3.2, [x, 0, 0], 'x')),
    cylinder(f.flangeSeat / 2, 0.61, [f.frontPlateStart - 0.01, 0, 0], 'x'),
    cylinder(f.flangeSeat / 2, 0.61, [33.4, 0, 0], 'x'),
    cylinder(14.3, 3.2, [30.9, 24, 0], 'x'),
    cylinder(1.8, 3.2, [f.frontPlateStart - 0.1, 24, 0], 'x'),
    ...[-8, 8].map((z) => cylinder(1.6, 3.2, [f.frontPlateStart - 0.1, 24, z], 'x')),
    ...[-bearingOuter - 0.1, bearingInner - 0.1].map((z) =>
      cylinder(f.bearingSeat / 2, 3.2, [f.outputX, f.outputY, z]),
    ),
    cylinder(f.flangeSeat / 2, 0.61, [f.outputX, f.outputY, -bearingOuter - 0.01]),
    cylinder(f.flangeSeat / 2, 0.61, [f.outputX, f.outputY, bearingOuter - 0.6]),
  );
}
