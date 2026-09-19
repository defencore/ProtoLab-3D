import type { Parameters } from '../../../core/types';
import type { Shape } from './shapes';
import { transform, rotate, union, cylinder } from './shapes';
export const pitchFor = (d: number) =>
  d === 1.6 ? 0.35 : d === 2 ? 0.4 : d === 2.5 ? 0.45 : d === 3 ? 0.5 : 0.7;
/** Tip at origin, head above the shaft; a genuine single-start RH thread. */
export function screw(
  d: number,
  length: number,
  options: {
    shoulder?: number;
    threadLength?: number;
    headDiameter?: number;
    headHeight?: number;
    head?: string;
  } = {},
): Shape {
  const pitch = pitchFor(d),
    h = options.headHeight ?? d;
  const p: Parameters = {
    diameter: d,
    length,
    shankDiameter: options.shoulder ?? d,
    head: options.head ?? 'socket-cap',
    headSize:
      options.headDiameter ??
      (d === 1.6 ? 3 : d === 2 ? 3.8 : d === 2.5 ? 4.5 : d === 3 ? 5.5 : 2 * d),
    headHeight: h,
    headSides: 6,
    flangeDiameter: d * 2.3,
    flangeThickness: d * 0.2,
    neckSize: d,
    neckHeight: 0,
    countersinkAngle: 90,
    drive: 'hex',
    driveWidth: d === 3 ? 2.5 : d === 2.5 ? 2 : 1.5,
    driveThickness: d * 0.2,
    driveDepth: d === 3 ? 1.3 : d === 2.5 ? 1.1 : d === 2 ? 1 : 0.7,
    driveSides: 6,
    threadMode: 'modeled',
    threadSpan: options.threadLength ? 'partial' : 'full',
    pitch,
    handedness: 'right',
    threadStart: 0,
    threadLength: options.threadLength ?? length,
    tip: 'chamfer',
    tipLength: pitch * 0.5,
    tipDiameter: d - pitch * 0.5,
  };
  return { kind: 'fastener', parameters: p };
}
/** Same placement and helix phase as the screw; only receiving material is cut. */
export function matingHole(s: Shape): Shape {
  if (s.kind === 'transform') return transform(matingHole(s.child), s.angle, s.offset);
  if (s.kind === 'rotate') return rotate(matingHole(s.child), s.angle, s.axis);
  if (s.kind !== 'fastener') throw new Error('Thread mate requires a screw');
  const p = s.parameters;
  return {
    kind: 'thread',
    diameter: +p.diameter,
    pitch: +p.pitch,
    length: p.threadSpan === 'partial' ? +p.threadLength : +p.length,
    clearance: 0.04,
    internal: true,
  };
}

/** Accu SSK M2, ISO 10642 supplier envelope; overall length includes the head. */
export function flatScrew(length: number): Shape {
  const s = screw(2, length, { head: 'countersunk', headDiameter: 4.7, headHeight: 1.35 });
  if (s.kind === 'fastener') Object.assign(s.parameters, { driveWidth: 1.3, driveDepth: 0.75 });
  return s;
}
/** ISO 7380-1 M3, catalog head/hex envelope. Servo's receiving thread still needs measurement. */
export function outputScrew(): Shape {
  const s = screw(3, 8, { head: 'button', headDiameter: 5.7, headHeight: 1.65 });
  if (s.kind === 'fastener') Object.assign(s.parameters, { driveWidth: 2, driveDepth: 1.04 });
  return s;
}
/** Select a stocked length, then position its head flush with the curved tube.
 * Shortening the screw never leaves its tip hanging beyond the receiving wall. */
export function radialScrew(outerRadius: number, wallRadius: number) {
  const available = outerRadius - wallRadius + 3 - 0.08;
  const length = [3, 4, 5, 6, 8, 10, 12, 16, 20].filter((v) => v <= available).at(-1);
  if (!length) throw new Error('Tube screw stack is too short for a stocked M2 screw');
  return { shape: flatScrew(length), tipRadius: outerRadius - 0.08 - length };
}
/** Clearance bore and 90° seat with the screw's tip/axis placement. */
export function flatSeat(s: Shape): Shape {
  if (s.kind === 'transform') return transform(flatSeat(s.child), s.angle, s.offset);
  if (s.kind === 'rotate') return rotate(flatSeat(s.child), s.angle, s.axis);
  if (s.kind !== 'fastener') throw new Error('Countersink requires a screw');
  const length = +s.parameters.length;
  return union(cylinder(1.1, length + 0.1, [0, 0, -0.05]), {
    kind: 'cone',
    bottom: 1.1,
    top: 2.55,
    height: 1.45,
    z: length - 1.25,
  });
}
