import { box, subtract, union, type Shape, type Vec } from './assembly/boundary/shapes';

/** Native geometry datums for the reusable sliding PCB bridge and its base seats. */
export interface PcbRetentionBridgeSpec {
  centerX: number;
  gap: number;
  stationCentres: number[];
  baseZ: number;
  seatZ: number;
  boardThickness: number;
  clearance: number;
  latchAnchor?: number;
  padMode: 'tpu' | 'rigid';
}

export function pcbBridgeLayout(s: PcbRetentionBridgeSpec) {
  if (
    ![
      s.centerX,
      s.gap,
      s.baseZ,
      s.seatZ,
      s.boardThickness,
      s.clearance,
      ...(s.latchAnchor === undefined ? [] : [s.latchAnchor]),
      ...s.stationCentres,
    ].every(Number.isFinite) ||
    s.stationCentres.length < 2 ||
    s.stationCentres.some((value, i) => i > 0 && value - s.stationCentres[i - 1] < 13.5) ||
    s.gap < 10 ||
    s.gap > 20 ||
    s.seatZ < s.baseZ + 5 ||
    s.boardThickness <= 0 ||
    s.clearance <= 0 ||
    s.clearance > 0.5 ||
    !['tpu', 'rigid'].includes(s.padMode)
  )
    throw new Error(
      'PCB bridge needs finite datums, at least two sorted stations separated by 13.5 mm, a 10–20 mm bay, positive board thickness and clearance, and 5 mm above the host floor.',
    );
  const boardTop = s.seatZ + s.boardThickness,
    first = Math.min(...s.stationCentres),
    last = Math.max(...s.stationCentres),
    latchAnchor = s.latchAnchor ?? last + 3.5;
  if (s.gap - 2 * s.clearance <= 6 + 2 * Math.min(s.clearance, 0.3))
    throw new Error('PCB mortise side walls must remain outside the swept foot cavity.');
  if (latchAnchor < last + 3.5)
    throw new Error(
      'PCB release-leaf anchor must lie at least 3.5 mm beyond the last bridge station.',
    );
  return {
    boardTop,
    clearance: s.clearance,
    bayonetClearance: Math.min(s.clearance, 0.3),
    capTop: boardTop + s.clearance + 3,
    capBottom: boardTop + s.clearance,
    capCentres: s.stationCentres,
    travel: 3,
    latchLift: 0.9,
    padSeat: boardTop + 0.96,
    footTop: s.baseZ + 2.45,
    footBottom: s.baseZ + 0.45,
    plinthTop: s.baseZ + 4.45,
    webBottom: s.seatZ - 0.35,
    latchAnchor,
    latchTip: latchAnchor + 18,
    toolWindowEnd: latchAnchor + 21.2,
    catchY: latchAnchor + 13,
    first,
    last,
    leftEdge: s.centerX - s.gap / 2,
    rightEdge: s.centerX + s.gap / 2,
  };
}

function plinth(s: PcbRetentionBridgeSpec, cy: number): Shape {
  const d = pcbBridgeLayout(s),
    b = d.bayonetClearance,
    width = s.gap - 2 * s.clearance;
  return subtract(
    box([width, 13.5, 4.45], [s.centerX - width / 2, cy - 8, s.baseZ]),
    box([6 + 2 * b, 11 + 2 * b, 2.25], [s.centerX - 3 - b, cy - 7 - b, s.baseZ + 0.2]),
    box([6 + 2 * b, 8 + 2 * b, 4.5], [s.centerX - 3 - b, cy - 7 - b, s.baseZ + 0.2]),
    box([3 + 2 * b, 9 + 2 * b, 2.3], [s.centerX - 1.5 - b, cy - 6 - b, s.baseZ + 2.4]),
  );
}

/** Integral base mortises and unloaded leaf catch. Fuse these with a host floor. */
export function pcbBridgeBase(s: PcbRetentionBridgeSpec): Shape {
  const d = pcbBridgeLayout(s);
  return union(
    box([8, d.catchY + 2.8 - (d.first - 8), 0.2], [s.centerX - 4, d.first - 8, s.baseZ]),
    ...s.stationCentres.map((cy) => plinth(s, cy)),
    box([3.6, 2.8, d.capTop - 1.6 - s.baseZ], [s.centerX - 1.8, d.catchY, s.baseZ]),
  );
}

/** Rigid bridge body, without its deformable release leaf. */
export function pcbBridgeBody(s: PcbRetentionBridgeSpec): Shape {
  const d = pcbBridgeLayout(s);
  const station = (cy: number): Shape =>
    union(
      box([s.gap + 8, 6, 3], [d.leftEdge - 4, cy - 3, d.capBottom]),
      box(
        [s.gap - 2 * s.clearance, 6, d.capTop - d.webBottom],
        [d.leftEdge + s.clearance, cy - 3, d.webBottom],
      ),
      box([3, 6, d.webBottom - d.footTop + 0.1], [s.centerX - 1.5, cy - 3, d.footTop - 0.05]),
      box([6, 8, 2], [s.centerX - 3, cy - 4, d.footBottom]),
    );
  const stock = union(
    box([8, d.latchAnchor + 22.7 - (d.first - 3), 2], [s.centerX - 4, d.first - 3, d.capTop - 2]),
    ...s.stationCentres.map(station),
  );
  const padPockets =
    s.padMode === 'tpu'
      ? s.stationCentres.flatMap((cy) =>
          [d.leftEdge - 3.4, d.rightEdge + 0.6].map((x) =>
            box([2.8, 6.04, d.padSeat - d.capBottom + 0.02], [x, cy - 3.02, d.capBottom - 0.02]),
          ),
        )
      : [];
  return subtract(
    stock,
    ...padPockets,
    box([3, 18, 3.5], [s.centerX - 1.5, d.latchAnchor, d.capTop - 2.3]),
    box([0.7, 21.2, 3.5], [s.centerX - 2.2, d.latchAnchor, d.capTop - 2.3]),
    box([0.7, 21.2, 3.5], [s.centerX + 1.5, d.latchAnchor, d.capTop - 2.3]),
    box([4.4, 3.2, 3.5], [s.centerX - 2.2, d.latchTip, d.capTop - 2.3]),
  );
}

/** Prescribed release fixture; not an elastic stress or fatigue result. */
export function pcbBridgeLatch(s: PcbRetentionBridgeSpec, lift = 0): Shape {
  if (!Number.isFinite(lift) || lift < 0)
    throw new Error('PCB bridge release lift must be finite and nonnegative.');
  const d = pcbBridgeLayout(s);
  const rise = (y: number) => {
    const u = Math.max(0, Math.min(1, (y - d.latchAnchor) / 18));
    return (lift * u * u * (3 - u)) / 2;
  };
  const strip = (ys: number[], low: number, high: number): Shape => ({
    kind: 'loft',
    rings: ys.map((y): Vec[] => [
      [s.centerX - 1.5, y, low + rise(y)],
      [s.centerX + 1.5, y, low + rise(y)],
      [s.centerX + 1.5, y, high + rise(y)],
      [s.centerX - 1.5, y, high + rise(y)],
    ]),
  });
  return union(
    strip(
      [d.latchAnchor - 0.05, ...Array.from({ length: 37 }, (_, i) => d.latchAnchor + i * 0.5)],
      d.capTop - 1,
      d.capTop,
    ),
    strip(
      Array.from({ length: 5 }, (_, i) => d.latchTip - 2 + i * 0.5),
      d.capTop - 2.2,
      d.capTop - 0.95,
    ),
  );
}

export function pcbBridgePose(s: PcbRetentionBridgeSpec, slideY = 0, lift = 0): Shape {
  if (!Number.isFinite(slideY)) throw new Error('PCB bridge slide must be finite.');
  return {
    kind: 'transform',
    child: union(pcbBridgeBody(s), pcbBridgeLatch(s, lift)),
    translation: [0, slideY, 0],
    rotation: [0, 0, 0],
  };
}

export function pcbBridgePads(s: PcbRetentionBridgeSpec): { id: string; shape: Shape }[] {
  if (s.padMode !== 'tpu') return [];
  const d = pcbBridgeLayout(s);
  return s.stationCentres.flatMap((cy, i) =>
    [d.leftEdge - 3.4, d.rightEdge + 0.6].map((x, j) => ({
      id: `retainer-pad-${i * 2 + j + 1}`,
      shape: box([2.8, 6, 1.2], [x, cy - 3, d.boardTop - 0.24]),
    })),
  );
}

export function pcbBridgeLidStop(s: PcbRetentionBridgeSpec, topZ: number): Shape {
  const d = pcbBridgeLayout(s);
  if (!Number.isFinite(topZ) || topZ <= d.capTop - 1)
    throw new Error('PCB lid backup stop must have finite positive height above its lower datum.');
  return box([6, 6, topZ - (d.capTop - 1)], [s.centerX - 3, d.first - 9.25, d.capTop - 1]);
}
