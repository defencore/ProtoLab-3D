import type { ActuatorThreadLayout } from '../../tr8-compact-actuator/part';

export type CncVariant = 'coplanar-64' | 'staggered-56';
export type Vec = [number, number, number];
export interface CncLayout {
  variant: CncVariant;
  diameter: number;
  screwPitchRadius: number;
  lever: number;
  outputRadial: number;
  outputStations: readonly number[];
  outputBearingCentres: readonly [number, number];
  outputInnerSleeve: number;
  outputInterSleeve: number;
  outputOuterSleeve: number;
  outputClip: number;
  outputTail: number;
  motorFront: number;
  couplingCentre: number;
  screwEnds: readonly [number, number];
  threadEnds: readonly [number, number];
  stubEnd: number;
  screwBearingCentres: readonly [number, number];
  screwClipCentres: readonly number[];
  screwSpacerStarts: readonly number[];
  motorPlateX: number;
  middleBase: readonly [number, number];
  endPlateX: number;
  postRadius: number;
  postDiameter: number;
  postClock: number;
  clock: number;
}

export const outputBearing = {
  bore: 6, outer: 10, width: 3, flangeOuter: 11.2, flangeWidth: 0.6,
} as const;
export const linkage = {
  coverHalfWidth: 6.5,
  coverEndOffset: 7.5,
  forkThickness: 3,
  forkArmHalfWidth: 4.25,
  forkInnerFace: 6.55,
  shaftInnerEnd: 6.55,
  pinCentreY: 8.05,
  crossPinDiameter: 2,
  crossPinLength: 10,
  slotWidth: 4.1,
  slideGap: 0.05,
  spacerBore: 6.05,
  spacerOuter: 6.85,
} as const;

/** Parallel screw axes sit exactly halfway between the disc centre and rim. */
export function cncLayout(variant: CncVariant): CncLayout {
  if (variant === 'coplanar-64') return {
    variant, diameter: 64, screwPitchRadius: 16, lever: 10,
    outputRadial: Math.sqrt(156), outputStations: [0, 0, 0, 0],
    outputBearingCentres: [12, 17], outputInnerSleeve: .95,
    outputInterSleeve: 2, outputOuterSleeve: .5, outputClip: 19.4, outputTail: 27.5,
    motorFront: -51, couplingCentre: -34.2,
    screwEnds: [-29, 21], threadEnds: [-13, 13], stubEnd: -21,
    screwBearingCentres: [-17, 17], screwClipCentres: [-19.8, -14.2, 14.2, 19.8],
    screwSpacerStarts: [-19.5, -15, 14.5, 19],
    motorPlateX: -51, middleBase: [-20, -15], endPlateX: 15,
    postRadius: 28, postDiameter: 7, postClock: 20.5, clock: 45,
  };
  if (variant === 'staggered-56') return {
    variant, diameter: 56, screwPitchRadius: 14, lever: Math.sqrt(105.75),
    outputRadial: 9.5, outputStations: [-8.5, 8.5, -8.5, 8.5],
    outputBearingCentres: [11.5, 16.3], outputInnerSleeve: .45,
    outputInterSleeve: 1.8, outputOuterSleeve: .5, outputClip: 18.7, outputTail: 27,
    motorFront: -60, couplingCentre: -43.2,
    screwEnds: [-38, 30], threadEnds: [-22, 22], stubEnd: -30,
    screwBearingCentres: [-26, 26], screwClipCentres: [-28.8, -23.2, 23.2, 28.8],
    screwSpacerStarts: [-28.5, -24, 23.5, 28],
    motorPlateX: -60, middleBase: [-29, -24], endPlateX: 24,
    postRadius: 24.2, postDiameter: 6.5, postClock: 45, clock: 45,
  };
  throw new Error('Unsupported CNC quad variant: ' + String(variant));
}

export function nativeThreadLayout(layout: CncLayout): ActuatorThreadLayout {
  return {
    screwThreadStart: layout.threadEnds[0], screwThreadEnd: layout.threadEnds[1],
    screwAxisZ: layout.lever, nutThreadLength: 15,
  };
}

export function nutTravel(layout: CncLayout, angle: number): number {
  return layout.lever * Math.tan(angle * Math.PI / 180);
}
