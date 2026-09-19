import type { Parameters } from '../../../core/types';
/** Fixed-axis packing. Masses and servo COM are explicit user assumptions, not vendor CG data. */
export function batteryLayout(p: Parameters) {
  const cell = +p.cellMass,
    servo = +p.servoMass;
  // Balance the measured servo and three cells; rocket structure and payload are separate.
  const x = (24 * cell - servo * +p.servoCgX - +p.driverMass * +p.driverCgX) / (2 * cell);
  const dy = (-servo * +p.servoCgY - +p.driverMass * +p.driverCgY) / (3 * cell);
  return [
    [-24, dy],
    [x, 24 + dy],
    [x, -24 + dy],
  ] as [number, number][];
}
export const batteryPosts = (radius: number) =>
  [30, 120, 210, 300].map(
    (a) =>
      [
        (radius - 4) * Math.cos((a * Math.PI) / 180),
        (radius - 4) * Math.sin((a * Math.PI) / 180),
      ] as [number, number],
  );
