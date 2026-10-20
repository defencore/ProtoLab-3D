import type { Parameters } from '../../../core/types';
import { nutCoarsePitch } from '../../../core/hardware/internal-thread';
import {
  box,
  cylinder,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';

export function spindleMountLayout(p: Parameters) {
  const diameter = Number(p.bodyDiameter),
    height = Number(p.clampHeight),
    wall = Number(p.radialWall);
  const radius = diameter / 2,
    halfWidth = radius + wall + 4;
  const x = radius + wall / 2 + 2,
    z = height / 2 - 8;
  return {
    bodyDiameter: diameter,
    boreDiameter: diameter + Number(p.boreClearance),
    outerWidth: 2 * halfWidth,
    clampHeight: height,
    rearFaceY: -radius - Number(p.rearWall),
    capFrontY: radius + wall,
    backSplitY: -Number(p.splitGap) / 2,
    capSplitY: Number(p.splitGap) / 2,
    clampBoltCenters: [
      [-x, 0, 0],
      [x, 0, 0],
    ] as Vec[],
    rearMountHoleCenters: [-x, x].flatMap((u) =>
      [-z, z].map((v): Vec => [u, -radius - Number(p.rearWall), v]),
    ),
    clampBoltDiameter: Number(p.clampBoltDiameter),
    mountBoltDiameter: Number(p.mountBoltDiameter),
    clampThreadDepth: 14,
    mountThreadDepth: 12,
    capBoltGripLength: radius + wall - Number(p.splitGap) / 2,
    mountHolePitchX: 2 * x,
    mountHolePitchZ: 2 * z,
    boltAxis: [0, 1, 0] as Vec,
  };
}
function threaded(radius: number, length: number, origin: Vec, radialClearance: number): Shape {
  return {
    kind: 'cylinder',
    radius,
    height: length,
    origin,
    axis: 'y',
    segments: 64,
    thread: { pitch: nutCoarsePitch(radius * 2), internal: true, radialClearance },
  };
}
export function mountShape(p: Parameters): Shape {
  const s = spindleMountLayout(p),
    back = p.component === 'back';
  const y = back ? s.rearFaceY : s.capSplitY;
  const depth = back ? s.backSplitY - y : s.capFrontY - y;
  const cuts: Shape[] = [
    cylinder(s.boreDiameter / 2, s.clampHeight + 2, [0, 0, -s.clampHeight / 2 - 1]),
  ];
  for (const [x, , z] of s.clampBoltCenters)
    cuts.push(
      back
        ? threaded(
            s.clampBoltDiameter / 2,
            s.clampThreadDepth,
            [x, s.backSplitY - s.clampThreadDepth, z],
            Number(p.threadFitAllowance),
          )
        : cylinder((s.clampBoltDiameter + 0.6) / 2, depth + 2, [x, y - 1, z], 'y'),
    );
  if (back)
    for (const origin of s.rearMountHoleCenters)
      cuts.push(
        threaded(s.mountBoltDiameter / 2, s.mountThreadDepth, origin, Number(p.threadFitAllowance)),
      );
  return subtract(
    box([s.outerWidth, depth, s.clampHeight], [-s.outerWidth / 2, y, -s.clampHeight / 2]),
    ...cuts,
  );
}
export function validateMount(p: Parameters): string[] {
  const errors: string[] = [];
  if (!['back', 'cap'].includes(String(p.component)))
    errors.push('Select one physical clamp detail.');
  const limits: Record<string, [number, number]> = {
    bodyDiameter: [40, 125],
    clampHeight: [32, 80],
    radialWall: [12, 25],
    rearWall: [16, 30],
    splitGap: [0.5, 2],
    boreClearance: [0, 0.5],
    threadFitAllowance: [0, 0.2],
  };
  for (const [key, [min, max]] of Object.entries(limits))
    if (
      typeof p[key] !== 'number' ||
      !Number.isFinite(p[key]) ||
      Number(p[key]) < min ||
      Number(p[key]) > max
    )
      errors.push(key + ' is outside its supported finite dimension range.');
  for (const key of ['clampBoltDiameter', 'mountBoltDiameter'])
    if (![6, 8].includes(Number(p[key]))) errors.push('Choose M6 or M8 fastening threads.');
  if (!errors.length) {
    const s = spindleMountLayout(p),
      margin = Number(p.radialWall) / 2 + 2;
    if (
      margin -
        Math.max(s.clampBoltDiameter, s.mountBoltDiameter) / 2 -
        Number(p.threadFitAllowance) <=
      3
    )
      errors.push('Fastener holes need at least 3 mm of material outside the spindle bore.');
    if (s.clampHeight / 2 - 8 <= (s.clampBoltDiameter + s.mountBoltDiameter) / 2 + 2)
      errors.push('Rear and clamp threads need separate material webs. Increase clamp height.');
  }
  return errors;
}
