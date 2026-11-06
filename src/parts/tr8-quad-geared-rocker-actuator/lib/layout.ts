import { Matrix4, Euler, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import single, { fixed as original } from '../../tr8-geared-rocker-actuator/part';

export const angleKeys = ['angleA', 'angleB', 'angleC', 'angleD'] as const;
const lever = original.lever;
export const fixed = {
  channelRadius: 14.1,
  motorSpacing: 22,
  gearTeeth: 22,
  gearFaceShift: 1.6,
  bearingFlangeWidth: 0.6,
  lever,
  outputLimit: 20,
  screwCenter: 15.5,
  threadStart: 0,
  threadEnd: 31,
  threadLength: 31,
  nutLength: 16,
  nutWidth: 12,
  nutHeight: 12,
  nutEndReliefDepth: 0.4,
  nutEndReliefDiameter: 10.4,
  followerDiameter: 4,
  followerEnd: 9.2,
  forkThickness: 2.6,
  forkBore: 6.05,
  forkHubLength: 6,
  forkHubDiameter: 11,
  forkInnerStart: 5.4,
  forkOuterStart: 20.2,
  forkWebStart: 5.4,
  forkArmHalfWidth: 4.2,
  forkWebHalfWidth: 4.2,
  forkWebEnd: 13.2,
  forkArmThickness: 6,
  slotRoot: lever - 0.15,
  slotWidth: 4.1,
  slotMouth: 24.2,
  forkTip: 24.2 + Math.sqrt(4.2 ** 2 - 2.05 ** 2),
  innerBearingR: 4.75,
  innerBearingBore: 2,
  innerBearingOuter: 5,
  innerBearingWidth: 2.5,
  shaftTip: 2.5,
  shaftStep: 6.3,
  innerClipCenter: 3.35,
  innerGroove: { center: 3.33, width: 0.34, rootDiameter: 1.2 },
  outerBearingR: 17.6,
  outerBearingWidth: 3,
  outerBearingStart: 16.1,
  outerBearingEnd: 19.1,
  neckEnd: 19.35,
  headEnd: 24.35,
  headDiameter: 20,
  headBackDiameter: 19,
  headReliefEnd: 23.65,
  headHoleRadius: 7,
  headThreadStart: 20.85,
  coreRadius: 8,
  coreTop: 4,
  coreWindowRadius: 3.95,
  forkHubR: 11.1,
  forkCrossWebStart: 9.8,
  wallRadius: 17,
  panelLow: -8.7,
  panelHigh: lever + 42,
  panelHalfWidth: 30.5,
  panelThickness: 3,
  tabThickness: 3,
  clampLength: 10,
  clampNutHeight: 2.4,
  endDiscThickness: 3,
  endTongueLength: 3.5,
  endTongueSpan: 46.6,
  endSlotSpan: 50,
  endSlotWidth: 3.15,
  endWireHoleDiameter: 10,
  endWireHoleRadius: 28.5,
  endWirePortAngle: 15.5,
  endWireChamfer: 0.5,
  coverMountT: 27.5,
  coverMountZ: 54.8,
  standThreadDiameter: 3,
  standThreadPitch: 0.5,
  standPilotDiameter: 2.5,
  standPassageDiameter: 3.4,
} as const;

export function enclosureDiameter(p: Parameters = {}): number {
  return String(p.motor ?? 'surpass-2838-3700kv').startsWith('surpass-2845-') ? 86 : 76;
}

/** Two lateral stand threads and three on the panel centerline, in local [T, Z] mm. */
export const standMountPattern = [
  [-12.7, 0],
  [12.7, 0],
  [0, 12.5],
  [0, 30],
  [0, 55],
] as const;

export function channelAngle(p: Parameters, channel: number) {
  return Number(p[angleKeys[channel]] ?? 0);
}
export function driveParameters(p: Parameters, channel: number): Parameters {
  return {
    ...single.defaults,
    motor: p.motor ?? 'surpass-2838-3700kv',
    outputAngle: channelAngle(p, channel) * (channel % 2 === 0 ? -1 : 1),
  };
}
export function layout(p: Parameters) {
  return {
    ...fixed,
    motor: p.motor,
    channels: angleKeys.map((key, index) => {
      const angle = channelAngle(p, index),
        radians = (angle * Math.PI) / 180;
      const sourceAngle = angle * (index % 2 === 0 ? -1 : 1);
      const displacement = -fixed.lever * Math.tan((sourceAngle * Math.PI) / 180);
      return {
        index,
        key,
        angle,
        radians,
        sourceAngle,
        displacement,
        nutAxial: displacement,
        screwTurns: -displacement / 4,
        pinRadius: fixed.lever / Math.cos(radians),
      };
    }),
  };
}
/** Only rigid occurrence frames are repeated; no quarter-specific geometry is authored. */
export function channelTransform(index: number) {
  return new Matrix4()
    .makeRotationZ((index * Math.PI) / 2)
    .multiply(new Matrix4().makeRotationX(index % 2 ? Math.PI : 0));
}
export function sourceTransform(inverted = false) {
  const frame = new Matrix4()
    .makeRotationFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2, 'ZYX'))
    .setPosition(new Vector3(fixed.channelRadius, fixed.screwCenter, -fixed.lever));
  return inverted
    ? new Matrix4()
        .makeTranslation(2 * fixed.channelRadius, 0, 0)
        .multiply(new Matrix4().makeRotationZ(Math.PI))
        .multiply(frame)
    : frame;
}
/** Approved wall placements: the lower pair reverses the shared formed panel's normal. */
export function panelTransform(index: number) {
  if (index === 0 || index === 2) return new Matrix4().makeRotationZ((index * Math.PI) / 2);
  return new Matrix4()
    .makeTranslation(0, index === 1 ? 34 : -34, 0)
    .multiply(channelTransform(index === 1 ? 3 : 1));
}
/** Identical through-cut discs; lower stock is indexed without reversing the port clock. */
export function endDiscTransform(upper: boolean) {
  const inside = fixed.panelHigh - fixed.endTongueLength;
  return new Matrix4()
    .makeTranslation(0, 0, upper ? inside : -inside - fixed.endDiscThickness)
    .multiply(upper ? new Matrix4() : new Matrix4().makeRotationZ(Math.PI / 2));
}
/** Local disc coordinates: all four ports share the same positive angular clock. */
export function endDiscWireCenters(): [number, number][] {
  return Array.from({ length: 4 }, (_, index) => {
    const angle = ((fixed.endWirePortAngle + index * 90) * Math.PI) / 180;
    return [fixed.endWireHoleRadius * Math.cos(angle), fixed.endWireHoleRadius * Math.sin(angle)];
  });
}
/** World inner/outer mouths, independent of the local extrusion direction of each disc. */
export function endDiscWireStations() {
  return [true, false].flatMap((upper) => {
    const frame = endDiscTransform(upper);
    const axis: [number, number, number] = [0, 0, upper ? 1 : -1];
    return endDiscWireCenters().map(([x, y], index) => {
      const innerPoint = new Vector3(x, y, upper ? 0 : fixed.endDiscThickness)
        .applyMatrix4(frame)
        .toArray() as [number, number, number];
      return {
        id: `${upper ? 'upper' : 'lower'}-wire-${index + 1}`,
        upper,
        index,
        innerPoint,
        outerPoint: innerPoint.map((n, i) => n + axis[i] * fixed.endDiscThickness) as [
          number,
          number,
          number,
        ],
        axis,
        boreDiameter: fixed.endWireHoleDiameter,
        edgeChamfer: fixed.endWireChamfer,
      };
    });
  });
}
/** Exposed metal faces and outward axes for the stand screw shank passages. */
export function standMountStations() {
  return Array.from({ length: 4 }, (_, panelIndex) => {
    const frame = panelTransform(panelIndex);
    const localNormal = panelIndex % 2 ? -1 : 1;
    const outerFaceN = localNormal > 0 ? 18.5 : 15.5;
    const axis = new Vector3(localNormal, 0, 0).transformDirection(frame);
    return standMountPattern.map(([localT, localZ], holeIndex) => ({
      id: `stand-mount-${'abcd'[panelIndex]}-${holeIndex + 1}`,
      panelIndex,
      holeIndex,
      localT,
      localZ,
      plateFace: new Vector3(outerFaceN, localT, localZ).applyMatrix4(frame).toArray() as [
        number,
        number,
        number,
      ],
      axis: axis.toArray().map((v) => (Math.abs(v) < 1e-12 ? 0 : v)) as [number, number, number],
      thread: 'M3×0.5' as const,
      threadLength: fixed.panelThickness,
      pilotDiameter: fixed.standPilotDiameter,
      passageDiameter: fixed.standPassageDiameter,
    }));
  }).flat();
}
export const roleIds = {
  case: 'case-panel',
  cross: 'central-bearing-cross',
  screw: 'screw',
  nut: 'nut',
  shaft: 'output-shaft',
  fork: 'cnc-fork',
  innerBearing: 'center-bearing',
  outerBearing: 'output-bearing',
  forkPin: 'fork-pin',
  centerClip: 'center-clip',
  caseBolt: 'case-bolt',
  caseNut: 'case-nut',
  endDisc: 'end-disc',
  cover: 'plastic-cover',
  coverBolt: 'cover-bolt',
} as const;
