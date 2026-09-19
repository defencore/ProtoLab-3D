import type { Parameters } from '../../../core/types';
import { latch } from './latch';
import presets from '../../rocket-release/presets.json';
// Rounded velocity ramps occupy the first/last 10% of the eased cam sweep.
// Unlike a cubic displacement law, the peak slope is only 1 / 0.9.
export const camRamp = 0.1;
export function camLift(p: Parameters, fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction));
  if (p.mechanism !== 'sculpted-cam') return f;
  if (f > 0.5) return 1 - camLift(p, 1 - f);
  return (
    (f < camRamp
      ? f / 2 - (camRamp * Math.sin((Math.PI * f) / camRamp)) / (2 * Math.PI)
      : f - camRamp / 2) /
    (1 - camRamp)
  );
}
const base = presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini');
if (!base) throw new Error('Required MG996R / 2S / WING MINI library configuration is missing.');
export const releaseParameters = (p: Parameters): Parameters => ({
  ...base.parameters,
  springTravel: +p.springTravel,
  springWire: +p.springWire,
  springPreload: +p.springPreload,
  noseMass: +p.noseMass,
  extractionForce: +p.extractionForce,
  wingCellMass: +p.cellMass,
  lipoTrimX: +p.batteryTrim,
  release: 0,
  separation: +p.separation,
});
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function motion(p: Parameters, state: string) {
  const q =
    state === 'packing' ? 0 : state === 'deployed' ? 100 : state === 'stowed' ? 0 : +p.sequence;
  const unlock = clamp(q / 30),
    spring = clamp((q - 30) / 25),
    extraction = clamp((q - 55) / 25),
    inflation = clamp((q - 80) / 20);
  return {
    unlock: state === 'packing' ? 1 : unlock,
    noseLift:
      state === 'packing'
        ? +p.separation
        : +p.springTravel * spring + (+p.separation - +p.springTravel) * extraction,
    lift: +p.springTravel * spring + (+p.separation - +p.springTravel) * extraction,
    springTravel: +p.springTravel * spring,
    inflation,
    noseX: inflation * (+p.canopyDiameter * 0.65),
  };
}
export function layout(p: Parameters) {
  return {
    radial: p.mechanism !== 'rotary-ring',
    passage: p.mechanism === 'rotary-ring' ? 58.8 : 65.5,
    springs: [45, 135, 225, 315],
    springR: 36.25,
  };
}
export const cassetteTop = (p: Parameters) => (p.mechanism === 'rotary-ring' ? 2.85 : -2.4);
export function springDimensions(p: Parameters) {
  const solid = (+p.springCoils + 2) * +p.springWire,
    closed = solid + 3;
  const cassetteBottom = cassetteTop(p) - +p.packLength - 14;
  const seat = cassetteBottom - 3 - closed;
  return { solid, closed, free: closed + +p.springTravel + +p.springPreload, seat, cassetteBottom };
}
export function camPoint(p: Parameters, f: number, phase = 0): [number, number] {
  const a = ((phase - +p.camSweep * f) * Math.PI) / 180,
    r = 23 - 8 * camLift(p, f);
  return [r * Math.cos(a), r * Math.sin(a)];
}
/** Quasi-static lock torque and a one-dimensional work-energy budget, not a flight simulation. */
export function assessment(p: Parameters) {
  const rate = (79000 * (+p.springWire) ** 4) / (8 * 12 ** 3 * +p.springCoils),
    n = 3;
  const preload = +p.springPreload,
    stroke = +p.springTravel;
  const startForce = n * rate * (stroke + preload),
    endForce = n * rate * preload;
  const energy = (n * rate * ((stroke + preload) ** 2 - preload ** 2)) / 2000;
  // The complete cassette, including its floor, must clear the highest fixed receiver feature.
  const extractionDistance =
    (p.mechanism === 'rotary-ring' ? 8 : 9.5) - springDimensions(p).cassetteBottom;
  const movingMass = +p.noseMass + +p.cassetteMass;
  const resistance = +p.extractionForce + +p.guideForce + movingMass * 9.80665 * +p.axialGravity;
  const work = (resistance * extractionDistance) / 1000;
  const required = (work + (movingMass * (+p.exitSpeed) ** 2) / 2) * +p.energyFactor;
  const index = 12 / +p.springWire,
    wahl = (4 * index - 1) / (4 * index - 4) + 0.615 / index;
  const stress = (wahl * 8 * (startForce / n) * 12) / (Math.PI * (+p.springWire) ** 3);
  const availableTorque = 9.4 * 0.0980665 * +p.servoDerating;
  const ring = p.mechanism === 'rotary-ring';
  const peakSlope =
    (8 / ((+p.camSweep * Math.PI) / 180)) *
    (p.mechanism === 'sculpted-cam' ? 1 / (1 - camRamp) : 1);
  const assistForce = 4 * ((79000 * 0.5 ** 4) / (8 * 5 ** 3 * 6)) * 10;
  const lockLoad = startForce + assistForce;
  const thrustTorque = ring
    ? (+p.thrustFriction * startForce * (+p.packDiameter / 2 + 1)) / 1000 / (5 * +p.gearEfficiency)
    : 0;
  const slidingFriction = +p.lockFriction + (ring ? 0 : +p.hookGuideFriction);
  const torque =
    (slidingFriction * lockLoad * (ring ? 36.25 / 5 : peakSlope)) / 1000 / +p.gearEfficiency +
    thrustTorque;
  const speed = Math.sqrt(Math.max(0, (2 * (energy - work)) / movingMass));
  const retentionForce = +p.retentionLoad + lockLoad;
  const perLatch = retentionForce / 3;
  const bladeSpan = (latch.outer + latch.outerEnd - latch.inner - latch.innerEnd) / 2;
  const bearingWidth = latch.width - 2 * latch.corner;
  return {
    retentionForce,
    bladeShear: perLatch / (2 * bearingWidth * latch.thickness),
    bladeBending: (perLatch * bladeSpan) / 4 / ((bearingWidth * latch.thickness ** 2) / 6),
    eyeBearing: perLatch / (3 * bearingWidth),
    cheekBearing: perLatch / (2 * 3 * bearingWidth),
    lockLoad,
    assistForce,
    movingMass,
    thrustTorque,
    rate,
    springCount: n,
    systemRate: n * rate,
    forcePerSpring: startForce / n,
    startForce,
    endForce,
    energy,
    required,
    resistance,
    work,
    extractionDistance,
    stress,
    availableTorque,
    torque,
    speed,
    energyMargin: energy / required,
    torqueMargin: availableTorque / torque,
    forcePass: startForce > resistance,
    energyPass: energy >= required,
    torquePass: torque <= availableTorque,
    voltagePass: +p.packVoltage >= 7,
    ...springDimensions(p),
  };
}
