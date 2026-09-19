import type { Parameters } from '../../../core/types';
import type { Point } from './shapes';

export const wingTies: Point[] = [
  [-31, -18],
  [-31, 18],
  [31, -18],
  [31, 18],
];

export function wingLayout(p: Parameters) {
  const cylindrical = p.wingBattery === '2x18650';
  const length = +p.lipoLength,
    width = +p.lipoWidth,
    thickness = +p.lipoThickness;
  const boardMass = +p.wingBoardMass,
    controllerX = cylindrical ? 0 : -16;
  const packMass = cylindrical ? 2 * +p.wingCellMass : +p.lipoMass;
  const batteryX =
    -(+p.wingServoMass * +p.wingServoCgX + boardMass * controllerX) / packMass + +p.lipoTrimX;
  const cellTop = 38,
    cellBottom = cellTop - +p.wingCellLength;
  const retentionThickness = cylindrical ? 3 : 2;
  const base = cylindrical ? cellBottom - retentionThickness - 1 : -thickness - 4;
  const controllerZ = cylindrical ? -1.9 : base - 9;
  return {
    cylindrical,
    length,
    width,
    thickness,
    boardMass,
    packMass,
    batteryX,
    cells: cylindrical ? 2 : +p.lipoCells,
    cellTop,
    cellBottom,
    base,
    retentionThickness,
    controllerX,
    controllerZ,
    // 13.8 mm physical stack + 12 mm PLS/lead allowance + 1.7 mm margin.
    noseBottom: cylindrical ? Math.min(base - 6, controllerZ - 27.5) : controllerZ - 27.5,
    leadY: length / 2 + 4,
    payloadCgX:
      (packMass * batteryX + +p.wingServoMass * +p.wingServoCgX + controllerX * boardMass) /
      (packMass + +p.wingServoMass + boardMass),
  };
}
export const cellLocations = (p: Parameters): Point[] =>
  [-24, 24].map((y) => [wingLayout(p).batteryX, y]);
