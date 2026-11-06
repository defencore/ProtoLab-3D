import type { ActuatorThreadLayout } from '../../tr8-compact-actuator/part';

/** Common geometric contract for the centred, short-head four-drive assembly. */
export const mechanismLayout = {
  radius: 14.5,
  outputX: 0,
  screwZ: 14.5,
  gap: 32,
  threadLength: 28,
  screwLength: 52,
  bearingCentres: [-12, 12],
  cheekPlanes: [[-12.9, -9.9], [9.9, 12.9]],
  coverHalfWidth: 6.5,
  cheekThickness: 3,
  outputBearing: { bore: 6, outer: 10, width: 3, flangeOuter: 11.2, flangeWidth: 0.6 },
  outputInnerSpacer: 0.95,
  outputOuterSpacer: 0.5,
  outputSpacerDiameter: 6.85,
  outputClipCentres: [-14.4, 14.4],
} as const;
export const driveLayout = {
  motorFront: -52,
  couplingCentre: -35.2,
  screwEnds: [-30, 22],
  stubEnd: -22,
  threadEnds: [-14, 14],
  bearingCentres: [-18, 18],
  clipCentres: [-20.8, -15.2, 15.2, 20.8],
  spacerStarts: [-20.5, -16, 15.5, 20],
  outputShaftEnds: [-16, 27.5],
  outputHeadSpan: [-16, -15],
  outputHeadDiameter: 7.5,
} as const;
export const nativeThreadLayout: ActuatorThreadLayout = {
  screwThreadStart: driveLayout.threadEnds[0],
  screwThreadEnd: driveLayout.threadEnds[1],
  screwAxisZ: mechanismLayout.screwZ,
  nutThreadLength: 15,
};
export const frameLayout = {
  radius: 20.25,
  stagger: 0,
  clock: 45,
  discDiameter: 72,
  columnRadius: 28,
  columnClock: 25,
  innerBarSeam: 0.2,
  discThickness: 3,
  plateStations: [-52, -19, 16],
  cheekAnchors: [-16, 16],
} as const;
