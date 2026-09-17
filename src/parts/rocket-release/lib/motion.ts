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
    pinionAngle: angle * (p.drive === 'central-servo' ? 2.5 : 4),
    servoAngle: -5 * angle,
    springExpansion: Math.min(lift, +p.springTravel),
  };
}
export function layout(p: Parameters) {
  const radius = +p.tubeID / 2 - +p.fitClearance;
  const pitchRadius = radius * 0.59;
  const centralServo = p.drive === 'central-servo';
  return {
    radius,
    pitchRadius,
    centralServo,
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
