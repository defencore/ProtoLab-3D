import type { Parameters } from '../../../core/types';

/** Millimetres. PCB outlines are user supplied; sourced connector interfaces need a fit coupon. */
export function layout(p: Parameters) {
  const boardThickness = Number(p.boardThickness),
    clearance = Number(p.fitClearance);
  const screwLength = Number(p.screwLength),
    underheadZ = 45.3;
  const nutBottom = underheadZ - screwLength + 0.9;
  const sensorCount = p.sensorCount === 'blank' ? 0 : Number(p.sensorCount);
  const width = Number(p.bodyWidth),
    panelWidth = width - 16;
  const sensorPitch = sensorCount === 3 && width < 124 ? 32 : 36;
  const sensorXs = Array.from(
    { length: sensorCount },
    (_, i) => 12 + (i - (sensorCount - 1) / 2) * sensorPitch,
  );
  return {
    length: 220,
    width,
    height: 46,
    wall: 4.2,
    baseTop: 3,
    wallTop: 43,
    boardZ: 8,
    boardThickness,
    boardTop: 8 + boardThickness,
    componentTop: 8 + boardThickness + Number(p.componentHeight),
    clearance,
    screwLength,
    underheadZ,
    nutBottom,
    nutInstalledZ: nutBottom + 0.25,
    nutHeight: 2.4,
    bossTop: nutBottom + 5.65,
    screwTip: underheadZ - screwLength,
    screwAxes: [
      [-78, -(width / 2 - 9.4)],
      [-78, width / 2 - 9.4],
      [78, -(width / 2 - 9.4)],
      [78, width / 2 - 9.4],
    ] as [number, number][],
    boards: [
      { id: 'psu', x: -94, y: -40, length: 60, width: 80, outerX: -94, innerX: -34, direction: 1 },
      { id: 'mcu', x: -24, y: -40, length: 120, width: 80, outerX: 96, innerX: -24, direction: -1 },
    ],
    panelX: 110,
    panelWidth,
    panelLeft: 12 - panelWidth / 2,
    panelRight: 12 + panelWidth / 2,
    panelBottom: 7,
    connectorZ: 25,
    sensorCount,
    sensorPitch,
    sensorXs,
    sensorYs: sensorXs.map((x) => 12 - x),
    sp16X: -110,
    sp16Hole: Number(p.sp16Hole),
    sp20Hole: Number(p.sp20Hole),
    gasketFree: 1.2,
    gasketCompressed: 0.96,
    gasketWidth: 1.35,
    headWasherThickness: 0.5,
    headSeatZ: 44.8,
    cassetteInwardTravel: 0.1,
  };
}
