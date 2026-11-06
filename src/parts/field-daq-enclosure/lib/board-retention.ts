import type { Parameters } from '../../../core/types';
import type { Shape } from '../../../core/assembly/boundary/shapes';
import { pcbOpenTriangleSeat } from '../../../core/pcb-retention';
import {
  pcbBridgeLayout,
  pcbBridgeBase,
  pcbBridgeBody,
  pcbBridgeLatch,
  pcbBridgePose,
  pcbBridgePads,
  pcbBridgeLidStop,
  type PcbRetentionBridgeSpec,
} from '../../../core/pcb-retention-bridge';
import { layout } from './layout';

/** The original field-DAQ datums select the shared physical bridge mechanism. */
export function retentionSpec(p: Parameters): PcbRetentionBridgeSpec {
  const d = layout(p);
  return {
    centerX: -29,
    gap: 10,
    stationCentres: [-22.5, 25.5],
    baseZ: d.baseTop,
    seatZ: d.boardZ,
    boardThickness: d.boardThickness,
    clearance: d.clearance,
    latchAnchor: 29,
    padMode: 'tpu',
  };
}
export const retentionLayout = (p: Parameters) => pcbBridgeLayout(retentionSpec(p));

/** Local Y/yaw restraint at the inner corners, open along the PCB service direction. */
export function innerCornerSeats(p: Parameters): Shape[] {
  const d = layout(p);
  return d.boards.flatMap((board) =>
    ([-1, 1] as const).map((side) =>
      pcbOpenTriangleSeat({
        edgeX: board.innerX,
        edgeY: (side * board.width) / 2,
        insideX: -board.direction as -1 | 1,
        outsideY: side,
        seatZ: d.boardZ,
        baseZ: d.baseTop,
        boardThickness: d.boardThickness,
        clearance: d.clearance,
      }),
    ),
  );
}

export const keyBody = (p: Parameters): Shape => pcbBridgeBody(retentionSpec(p));
export const keyLatch = (p: Parameters, lift = 0): Shape => pcbBridgeLatch(retentionSpec(p), lift);
export const keyPose = (p: Parameters, slideY = 0, latchLift = 0): Shape =>
  pcbBridgePose(retentionSpec(p), slideY, latchLift);

export function boardRetention(p: Parameters) {
  const spec = retentionSpec(p);
  return {
    base: pcbBridgeBase(spec),
    innerSeats: innerCornerSeats(p),
    key: pcbBridgePose(spec),
    pads: pcbBridgePads(spec),
    lidStop: pcbBridgeLidStop(spec, 38.1),
  };
}
