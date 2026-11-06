import { box, prism, subtract, type Shape } from './assembly/boundary/shapes';

/** Board edge datum and an open-top, X-service-compatible triangular seat. */
export interface PcbOpenTriangleSeat {
  edgeX: number;
  edgeY: number;
  /** Direction from the selected X edge into the PCB substrate. */
  insideX: -1 | 1;
  /** Direction from the selected Y edge away from the PCB substrate. */
  outsideY: -1 | 1;
  seatZ: number;
  baseZ: number;
  boardThickness: number;
  clearance: number;
  run?: number;
  reach?: number;
  wall?: number;
  topExtra?: number;
  embed?: number;
}

/**
 * A solid triangular pocket with a full-height outboard rim. The substrate
 * cavity opens through X and upward, leaving a broad floor and buttressed rim
 * without a roof or an X stop in the released board's service path.
 */
export function pcbOpenTriangleSeat(input: PcbOpenTriangleSeat): Shape {
  const {
    edgeX: x,
    edgeY: y,
    insideX: ix,
    outsideY: sy,
    seatZ,
    baseZ,
    boardThickness,
    clearance: c,
    run = 10.5,
    reach = 10.5,
    wall = 6,
    topExtra = 2,
    embed = 0.1,
  } = input;
  if (
    ![x, y, seatZ, baseZ, boardThickness, c, run, reach, wall, topExtra, embed].every(
      Number.isFinite,
    ) ||
    ![-1, 1].includes(ix) ||
    ![-1, 1].includes(sy) ||
    seatZ <= baseZ ||
    boardThickness <= 0 ||
    c < 0 ||
    run <= 0 ||
    reach <= 0 ||
    wall <= c ||
    topExtra < 0 ||
    embed < 0
  )
    throw new Error(
      'PCB triangle pocket requires finite dimensions, positive floor height and an outboard rim beyond the fit clearance.',
    );
  const back = x + ix * run;
  const topZ = seatZ + boardThickness + c + topExtra;
  return subtract(
    prism(
      [
        [x, y - sy * reach],
        [x, y + sy * wall],
        [back, y + sy * wall],
      ],
      topZ - baseZ + embed,
      baseZ - embed,
    ),
    box(
      [run + 2, reach + c + 1, topZ - seatZ + 1],
      [Math.min(x, back) - 1, sy > 0 ? y - reach - 1 : y - c, seatZ],
    ),
  );
}
