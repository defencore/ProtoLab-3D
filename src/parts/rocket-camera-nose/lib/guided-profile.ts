import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Shape } from '../../../core/assembly/boundary/shapes';

/** Shared meridian datums; the reference radius preserves the original main ogive circle. */
export const guidedProfileInterface = {
  ogiveReferenceRadius: 25,
  apertureRadius: 12,
  normalWall: 3,
  rootZ: 26,
  rootRampZ: 6,
  receiverWall: 2.4,
  tipProjection: 2,
} as const;

type Point = [number, number];

/** Internally tangent circular cap, with a concentric inward normal wall offset. */
export function guidedNoseProfile(p: Parameters) {
  const c = guidedProfileInterface,
    rootRadius = n(p, 'tubeOD') / 2,
    receiverRadius = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2,
    boreRadius = receiverRadius - c.receiverWall,
    shoulderLength = n(p, 'shoulderLength'),
    noseLength = n(p, 'noseLength'),
    tipZ = noseLength + c.tipProjection,
    rise = rootRadius - c.ogiveReferenceRadius,
    h = noseLength - c.rootZ;
  if (rise <= 0 || h <= 0)
    throw new Error('The guided ogive needs a positive root rise and length.');
  const mainRadius = (h * h + rise * rise) / (2 * rise),
    mainCenter: Point = [rootRadius - mainRadius, c.rootZ],
    dr = c.apertureRadius - mainCenter[0],
    dz = tipZ - mainCenter[1],
    capRadius = (mainRadius * mainRadius - dr * dr - dz * dz) / (2 * (mainRadius - dz)),
    capCenter: Point = [c.apertureRadius, tipZ - capRadius],
    centerDistance = mainRadius - capRadius;
  if (capRadius <= c.normalWall || centerDistance <= 0)
    throw new Error('The guided ogive cannot form the specified tangent cap and normal wall.');
  const tangentDirection: Point = [dr / centerDistance, (capCenter[1] - c.rootZ) / centerDistance],
    tangentAngle = Math.atan2(tangentDirection[1], tangentDirection[0]),
    point = (center: Point, radius: number): Point => [
      center[0] + radius * tangentDirection[0],
      center[1] + radius * tangentDirection[1],
    ];
  return {
    ...c,
    shoulderLength,
    noseLength,
    rootRadius,
    receiverRadius,
    boreRadius,
    rootInnerRadius: rootRadius - c.normalWall,
    tipZ,
    innerTipZ: tipZ - c.normalWall,
    mainCenter,
    mainRadius,
    innerMainRadius: mainRadius - c.normalWall,
    capCenter,
    capRadius,
    innerCapRadius: capRadius - c.normalWall,
    tangentDirection,
    tangentAngle,
    outerTangent: point(mainCenter, mainRadius),
    innerTangent: point(mainCenter, mainRadius - c.normalWall),
  };
}

/** Exact exterior radius; the hidden insertion shoulder steps to the flush tube root at Z=0. */
export function guidedOuterRadius(p: Parameters, z: number) {
  const a = guidedNoseProfile(p);
  if (z < 0) return a.receiverRadius;
  if (z <= a.rootZ) return a.rootRadius;
  if (z <= a.outerTangent[1])
    return a.mainCenter[0] + Math.sqrt(Math.max(0, a.mainRadius ** 2 - (z - a.rootZ) ** 2));
  if (z <= a.tipZ)
    return a.capCenter[0] + Math.sqrt(Math.max(0, a.capRadius ** 2 - (z - a.capCenter[1]) ** 2));
  return 0;
}

/** Actual void radius, including the through-aperture. Subtract frame clearance separately. */
export function guidedInnerRadius(p: Parameters, z: number) {
  const a = guidedNoseProfile(p);
  if (z <= 0) return a.boreRadius;
  if (z < a.rootRampZ) return a.boreRadius + ((a.rootInnerRadius - a.boreRadius) * z) / a.rootRampZ;
  if (z <= a.rootZ) return a.rootInnerRadius;
  if (z <= a.innerTangent[1])
    return a.mainCenter[0] + Math.sqrt(Math.max(0, a.innerMainRadius ** 2 - (z - a.rootZ) ** 2));
  if (z <= a.innerTipZ)
    return (
      a.capCenter[0] + Math.sqrt(Math.max(0, a.innerCapRadius ** 2 - (z - a.capCenter[1]) ** 2))
    );
  return a.apertureRadius;
}

/** Circle samples are preview input; analyticRevolvePython recovers the two true native arcs. */
function arc(center: Point, radius: number, from: number, to: number, count: number): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / count;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  });
}

export function guidedOutsideShape(p: Parameters): Shape {
  const a = guidedNoseProfile(p);
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [0, -a.shoulderLength],
      [a.receiverRadius, -a.shoulderLength],
      [a.receiverRadius, 0],
      [a.rootRadius, 0],
      [a.rootRadius, a.rootZ],
      ...arc(a.mainCenter, a.mainRadius, 0, a.tangentAngle, 64),
      ...arc(a.capCenter, a.capRadius, a.tangentAngle, Math.PI / 2, 64),
      [0, a.tipZ],
    ],
  };
}

/** Continuous cavity and R12 bore extend beyond the rounded tip, leaving no front plug. */
export function guidedCavityShape(p: Parameters): Shape {
  const a = guidedNoseProfile(p);
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [0, -a.shoulderLength - 0.2],
      [a.boreRadius, -a.shoulderLength - 0.2],
      [a.boreRadius, 0],
      [a.rootInnerRadius, a.rootRampZ],
      [a.rootInnerRadius, a.rootZ],
      ...arc(a.mainCenter, a.innerMainRadius, 0, a.tangentAngle, 64),
      ...arc(a.capCenter, a.innerCapRadius, a.tangentAngle, Math.PI / 2, 64),
      [a.apertureRadius, a.tipZ + 0.2],
      [0, a.tipZ + 0.2],
    ],
  };
}
