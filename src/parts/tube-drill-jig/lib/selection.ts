import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';

export const bearingSource = 'https://www.smbbearings.com/products/miniature-bearings.html';
export const mr93Source =
  'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/MR93ZZ-miniature-bearing-3x9x4mm.pdf';
/** Nominal shielded-bearing dimensions from the SMB miniature bearing table. */
export const bearings = [
  { id: 'MR52ZZ', bore: 2, outer: 5, width: 2.5 },
  { id: '692XZZ', bore: 2.5, outer: 7, width: 3.5 },
  { id: 'MR93ZZ', bore: 3, outer: 9, width: 4 },
  { id: 'MR84ZZ', bore: 4, outer: 8, width: 3 },
  { id: 'MR105ZZ', bore: 5, outer: 10, width: 4 },
  { id: 'MR126ZZ', bore: 6, outer: 12, width: 4 },
  { id: 'MR128ZZ', bore: 8, outer: 12, width: 3.5 },
] as const;

export const threads: Record<string, { pitch: number; drill: number }> = {
  M2: { pitch: 0.4, drill: 1.6 },
  'M2.5': { pitch: 0.45, drill: 2.05 },
  M3: { pitch: 0.5, drill: 2.5 },
  M4: { pitch: 0.7, drill: 3.3 },
  M5: { pitch: 0.8, drill: 4.2 },
  M6: { pitch: 1, drill: 5 },
  M8: { pitch: 1.25, drill: 6.8 },
};

export function selectGuide(p: Parameters) {
  const drill = p.holeMode === 'tap' ? threads[String(p.thread)].drill : n(p, 'holeDiameter');
  const bearing = bearings.find((item) => Math.abs(item.bore - drill) < 1e-8);
  const kind = p.guide === 'auto' ? (bearing ? 'bearing' : 'bushing') : String(p.guide);
  // A non-matching bearing is never substituted for a drill guide.
  const outer = kind === 'bearing' && bearing ? bearing.outer : Math.ceil(drill + 4);
  const width = kind === 'bearing' && bearing ? bearing.width : 12;
  return { drill, bearing: kind === 'bearing' ? bearing : undefined, kind, outer, width };
}

export const spacerSizes = [20, 10, 5, 2, 1, 0.5] as const;

/** Standard reusable rings, expressed as integer half-millimetre units. */
export function spacerStack(p: Parameters): number[] {
  if (p.stopMode === 'through') return [];
  let units = Math.round((n(p, 'axisHeight') - n(p, 'endOffset')) * 2);
  const stack: number[] = [];
  if (units < 0) return stack;
  for (const thickness of spacerSizes) {
    while (units >= thickness * 2) {
      stack.push(thickness);
      units -= thickness * 2;
    }
  }
  return stack;
}

/** Minimum ligament at the drill plane between adjacent finite radial sockets.
 * The end plane matters: extending cutters into the tube bore needlessly weakens small inserts.
 */
export function socketWeb(boreRadius: number, from: number, diameter: number, count: number) {
  const a = Math.PI / count,
    r = diameter / 2;
  const u = Math.max(boreRadius, from * Math.cos(a) + r * Math.sin(a));
  return 2 * Math.max((u * Math.sin(a) - r) / Math.cos(a), (from - u * Math.cos(a)) / Math.sin(a));
}

export function layout(p: Parameters) {
  const guide = selectGuide(p);
  const count = Number(p.holeCount);
  const bore = n(p, 'tubeOD') + n(p, 'tubeClearance');
  const capacity = n(p, 'bodyCapacity');
  const bodyBore = capacity + 0.6;
  const radius = capacity / 2 + 28;
  const seatRadius =
    guide.kind === 'plain'
      ? (guide.drill + n(p, 'guideClearance')) / 2
      : (guide.outer + n(p, 'seatClearance')) / 2;
  const lockOffset = 6.6;
  const lockFloor = Math.max(5, Math.sqrt(Math.max(0, (seatRadius + 2.1) ** 2 - 4.4 ** 2)));
  const barrelOD = Math.max(20, 2 * (Math.hypot(lockOffset + 2, lockFloor) + 0.05));
  const socketStart = bore / 2 + 2.4;
  const start = socketStart + 0.2;
  const flangeEnd = radius - 9;
  const flangeStart = flangeEnd - 8;
  const barrelLength = flangeEnd - start;
  const capStart = flangeEnd + 0.15;
  const capEnd = capStart + 4;
  const screwOffset = Math.max(8, Math.ceil((seatRadius + 3.35) * 10) / 10);
  const flangeWidth = Math.max(26, 2 * (screwOffset + 4.3));
  const flangeHeight = flangeWidth;
  const axisHeight = n(p, 'axisHeight');
  const headSeat = axisHeight - 18;
  const crownBase = axisHeight + Math.max(16, (flangeWidth + n(p, 'cartridgeClearance')) / 2 + 2.4);
  const top = crownBase + 14;
  const webFor = (pattern: number) =>
    Math.min(
      socketWeb(bore / 2, socketStart, barrelOD + n(p, 'cartridgeClearance'), pattern),
      socketWeb(
        bore / 2,
        n(p, 'tubeOD') / 2 - 1,
        guide.drill + n(p, 'guideClearance') + 0.6,
        pattern,
      ),
    );
  const minWeb = webFor(count);
  const availableCounts = [4, 8, 12].filter((pattern) => webFor(pattern) >= 2.4);
  const outerWeb =
    (radius - 6.4) * Math.sin(Math.PI / 12) - (flangeWidth + n(p, 'cartridgeClearance')) / 2 - 4.2;
  const stopBore = n(p, 'tubeOD') - 2 * n(p, 'tubeWall') - 2;
  const flatCount = 24;
  const circumradius = radius / Math.cos(Math.PI / flatCount);
  const outline: [number, number][] = Array.from({ length: flatCount }, (_, index) => {
    const angle = ((2 * index + 1) * Math.PI) / flatCount;
    return [circumradius * Math.cos(angle), circumradius * Math.sin(angle)];
  });
  const stack = spacerStack(p);
  const spacerHeight = stack.reduce((sum, thickness) => sum + thickness, 0);
  const spacerOD = bore - n(p, 'spacerClearance');
  const stations = Array.from({ length: count }, (_, index) => {
    const angle = (index * 360) / count;
    const radians = (angle * Math.PI) / 180;
    return {
      index,
      angle,
      direction: [Math.cos(radians), Math.sin(radians), 0] as [number, number, number],
      z: axisHeight,
    };
  });
  return {
    ...guide,
    count,
    capacity,
    bodyBore,
    bore,
    barrelOD,
    barrelLength,
    start,
    flangeStart,
    flangeEnd,
    capStart,
    capEnd,
    flangeWidth,
    flangeHeight,
    screwOffset,
    radius,
    top,
    stopBore,
    axisHeight,
    headSeat,
    crownBase,
    socketStart,
    minWeb,
    availableCounts,
    outerWeb,
    lockOffset,
    lockRadius: radius - 21,
    lockFloor,
    mountRadius: radius - 6.4,
    bodyBottom: -4,
    endStop: p.stopMode !== 'through',
    stopMountAngles: [60, 150, 240, 330],
    stopMountRadius: capacity / 2 + 14,
    stopScrewLength: n(p, 'stopThickness') + 7,
    pilotWall: screwOffset - seatRadius - 1.25,
    capWall:
      screwOffset -
      1.7 -
      (guide.kind === 'bearing'
        ? (guide.drill + (guide.outer - guide.drill) * 0.75) / 2
        : (guide.drill + n(p, 'guideClearance') + 0.6) / 2),
    linerWidth: Math.min(3, (bodyBore - 0.3 - bore) / 2 - 0.2),
    flatCount,
    outline,
    stack,
    spacerHeight,
    spacerOD,
    stations,
    active: stations[Math.max(0, Math.min(count - 1, Math.round(n(p, 'station')) - 1))],
    bearingStarts: [start + 1.2, flangeEnd - guide.width],
    sleeveLength: flangeEnd - start - 1.2 - 2 * guide.width,
    drillReach:
      capEnd + (guide.kind === 'plain' ? 0 : 1.5) - n(p, 'tubeOD') / 2 + n(p, 'tubeWall') + 2,
    clampZ: crownBase + 7.4,
    mountAngles: [15, 105, 195, 285],
  };
}
