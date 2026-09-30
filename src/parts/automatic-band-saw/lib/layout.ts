import { sectionArea } from './profiles';
import type { Parameters } from '../../../core/types';
import type { Vec } from './shapes';

export const TABLE = 900;
export const BOTTOM = 875;
export const HEAD_ANGLE = 35;
export const SHUTTLE_HOME = -355;
export const SHUTTLE_TRAVEL = 155;
export const TAIL_RESERVE = 400;
export const SENSOR_OFFSET = 190;
export const LOAD_NOSE_MIN = -30;
export const LOAD_NOSE_MAX = -15;
export const FACE_LENGTH = 30;
export const BAND_LENGTH = 2360;
export const WHEEL_RADIUS = 150;
export const WHEEL_CENTRE = (BAND_LENGTH - 2 * Math.PI * WHEEL_RADIUS) / 4;
export function section(p: Parameters) {
  const w = Number(p.width);
  return {
    w,
    h: ['round', 'square'].includes(String(p.profile)) ? w : Number(p.height),
    wall: Number(p.wall),
  };
}
export const HEAD_PIVOT: Vec = [0, -WHEEL_CENTRE, BOTTOM + 160];
export function headPoint(point: Vec, degrees: number): Vec {
  const a = (degrees * Math.PI) / 180,
    y = point[1] - HEAD_PIVOT[1],
    z = point[2] - HEAD_PIVOT[2];
  return [
    point[0],
    HEAD_PIVOT[1] + y * Math.cos(a) - z * Math.sin(a),
    HEAD_PIVOT[2] + y * Math.sin(a) + z * Math.cos(a),
  ];
}
export function bladeHeight(y: number, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  return HEAD_PIVOT[2] + (y - HEAD_PIVOT[1]) * Math.tan(a) - 160 / Math.cos(a);
}
export function liftLink(degrees: number) {
  const base: Vec = [100, WHEEL_CENTRE, 300],
    tip = headPoint([100, WHEEL_CENTRE, 1035], degrees);
  const length = Math.hypot(...tip.map((v, i) => v - base[i]));
  const momentArm =
    Math.abs(
      (tip[1] - HEAD_PIVOT[1]) * (tip[2] - base[2]) - (tip[2] - HEAD_PIVOT[2]) * (tip[1] - base[1]),
    ) /
    length /
    1000;
  return { base, tip, length, extension: length - 700, momentArm };
}
export function pose(p: Parameters, state: string) {
  let low = 0,
    high = HEAD_ANGLE;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (bladeHeight(0, mid) < TABLE + section(p).h * 0.48) low = mid;
    else high = mid;
  }
  const headAngle =
    state === 'stroke'
      ? HEAD_ANGLE * (1 - Number(p.strokePosition) / 100)
      : ['bottom', 'dropping'].includes(state)
        ? 0
        : state === 'cutting'
          ? (low + high) / 2
          : HEAD_ANGLE;
  const edge = BOTTOM;
  const travel =
    state === 'stroke'
      ? (SHUTTLE_TRAVEL * Number(p.carriagePosition)) / 100
      : state === 'scanning'
        ? 140
        : ['clamped', 'cutting', 'bottom', 'dropping', 'raising'].includes(state)
          ? Number(p.cutLength) + Number(p.kerf)
          : 0;
  return {
    edge,
    headAngle,
    carriage: SHUTTLE_HOME + travel,
    trayAngle:
      state === 'stroke' ? (-70 * Number(p.shelfPosition)) / 100 : state === 'dropping' ? -70 : 0,
    stationClosed: !['feeding', 'loading'].includes(state),
    gripperClosed: !['returning', 'loading', 'scanning'].includes(state),
  };
}
export function trayLink(angle: number) {
  const t = (angle * Math.PI) / 180;
  const base: Vec = [145, -220, 620];
  const tip: Vec = [145, -100 - 70 * Math.cos(t), 895 - 70 * Math.sin(t)];
  const length = Math.hypot(tip[1] - base[1], tip[2] - base[2]);
  return { base, tip, length, extension: length - 270 };
}
export function engineering(p: Parameters) {
  const { w, h, wall } = section(p);
  const area = sectionArea(String(p.profile), w, h, wall);
  const clampForce = ((Number(p.pressure) * 0.1 * Math.PI * 32 ** 2) / 4) * 0.8;
  const liftForce = ((Number(p.liftPressure) * 0.1 * Math.PI * 63 ** 2) / 4) * 0.8;
  const advance = Number(p.cutLength) + Number(p.kerf);
  const firstAdvance = -LOAD_NOSE_MIN + FACE_LENGTH + Number(p.kerf) / 2;
  const useful = Number(p.stockLength) - FACE_LENGTH - Number(p.kerf) - TAIL_RESERVE;
  return {
    advance,
    firstAdvance,
    clampForce,
    liftForce,
    liftMargin: Math.min(
      ...Array.from({ length: 36 }, (_, angle) => {
        const a = (angle * Math.PI) / 180;
        return (
          (liftForce * liftLink(angle).momentArm) /
          ((Number(p.headMass) * 9.81 * (WHEEL_CENTRE * Math.cos(a) - 65 * Math.sin(a))) / 1000)
        );
      }),
    ),
    feedMargin: (clampForce * Number(p.friction)) / Number(p.feedResistance),
    holdMargin: (clampForce * Number(p.friction)) / Number(p.cuttingForce),
    parts: Math.max(0, Math.floor(useful / advance)),
    remainder:
      Number(p.stockLength) -
      FACE_LENGTH -
      Number(p.kerf) -
      Math.max(0, Math.floor(useful / advance)) * advance,
    stockMass: area * Number(p.stockLength) * 2.7e-6,
    offcutMass: area * Number(p.cutLength) * 2.7e-6,
    // Acceptance allocation, not measured capability: scan, axis, unobserved grip, cut.
    errorBudget: 0.03 + Number(p.stopWindow) + Number(p.gripAllowance) + 0.07,
    axisIncrement: 5 / 4000,
  };
}
