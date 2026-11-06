import type { ActuatorThreadLayout } from '../../tr8-compact-actuator/part';

/** Common geometric contract for the centred, short-head four-drive assembly. */
export const mechanismLayout = {
  radius: 14.5,
  outputX: 0,
  screwZ: 14.5,
  gap: 32,
  threadLength: 28,
  screwLength: 52,
  bearingCentres: [-13, 13],
  cheekPlanes: [[-14.4, -10.4], [10.4, 14.4]],
  coverHalfWidth: 7,
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
  outputShaftEnds: [-18.3, 27.5],
  outputHeadSpan: [-18.3, -17.3],
  outputHeadDiameter: 8,
} as const;
export const nativeThreadLayout: ActuatorThreadLayout = {
  screwThreadStart: driveLayout.threadEnds[0],
  screwThreadEnd: driveLayout.threadEnds[1],
  screwAxisZ: mechanismLayout.screwZ,
  nutThreadLength: 15,
};
export const frameLayout = {
  radius: 23.5,
  stagger: 0,
  clock: 45,
  discDiameter: 82,
  columnRadius: 32.5,
  columnClock: 15,
  innerBarSeam: 0.2,
  discThickness: 3,
  plateStations: [-52, -19, 16],
  cheekAnchors: [-16, 16],
} as const;
