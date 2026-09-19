import type { Parameters } from '../../../core/types';
export const rad = Math.PI / 180;
export const at = (r: number, angle: number): [number, number] => [
  r * Math.cos(angle * rad),
  r * Math.sin(angle * rad),
];
export function motion(p: Parameters) {
  const angle = +p.unlockAngle * Math.min(1, +p.release / 60);
  const lift = +p.separation * Math.max(0, (+p.release - 60) / 40);
  return {
    angle,
    lift,
    pinionAngle: angle * (p.drive !== 'four-motors' ? 2.5 : 4),
    servoAngle: -5 * angle,
    springExpansion: Math.min(lift, +p.springTravel),
  };
}
export function layout(p: Parameters) {
  const radius = +p.tubeID / 2 - +p.fitClearance;
  // The vertical 2S nose needs a larger parachute passage after separation.
  // At D90/86 and 0.25 mm radial fit clearance this gives m0.6, a 58.8 mm
  // tooth-tip bore and 2.45 mm minimum radial web to the keyhole envelope.
  const widePassage = p.drive === 'wing-mini-nose' && p.wingBattery === '2x18650';
  const pitchRadius = radius * (widePassage ? 30 / 42.75 : 0.59);
  const centralServo = p.drive !== 'four-motors';
  const batteries = centralServo && p.batteryPack === '3x18650';
  return {
    radius,
    pitchRadius,
    centralServo,
    batteries,
    servoZ: p.drive === 'st3215-nose' ? (batteries ? 54.4 : 18.4) : batteries ? 50 : 14,
    stackOffset: centralServo ? (batteries ? 44 : 8) : 0,
    ringTeeth: centralServo ? 100 : 80,
    pinionTeeth: centralServo ? 40 : 20,
    module: pitchRadius / (centralServo ? 50 : 40),
    pinionRadius: pitchRadius * (centralServo ? 0.4 : 0.25),
    driveRadius: pitchRadius * (centralServo ? 0.6 : 0.75),
    lockRadius: radius - 6.5,
    motorRadius: +p.motor / 2,
    ...motion(p),
  };
}

export const springAngles = [45, 135, 225, 315];
