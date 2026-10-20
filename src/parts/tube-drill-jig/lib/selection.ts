import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';

export const bearingSource = 'https://www.smbbearings.com/products/miniature-bearings.html';
/** Nominal shielded-bearing dimensions from the SMB miniature bearing table. */
export const bearings = [
  { id: 'MR52ZZ', bore: 2, outer: 5, width: 2.5 },
  { id: '692XZZ', bore: 2.5, outer: 7, width: 3.5 },
  { id: 'MR63ZZ', bore: 3, outer: 6, width: 2.5 },
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

export function layout(p: Parameters) {
  const guide = selectGuide(p);
  const count = Number(p.holeCount);
  const bore = n(p, 'tubeOD') + n(p, 'tubeClearance');
  const floor = bore / 2 + 2;
  const barrelOD = guide.outer + 4;
  const barrelLength =
    guide.kind === 'bearing' ? 2 * guide.width + n(p, 'bearingGap') - 2 : guide.width;
  const start = floor + 0.2;
  const flangeStart = start + barrelLength - 0.4;
  const flangeEnd = start + barrelLength + 2;
  const capStart = flangeEnd + 0.15;
  const capEnd = capStart + 3;
  const flangeWidth = guide.outer + 15;
  const flangeHeight = barrelOD + 2;
  const screwOffset = guide.outer / 2 + 4;
  // Apothem of the support polygon. All caps and screw heads stay behind its flats.
  const radius = guide.kind === 'plain' ? bore / 2 + n(p, 'plainWall') : capEnd + 6;
  const axisHeight = n(p, 'axisHeight');
  const top = axisHeight + (guide.kind === 'plain' ? guide.drill / 2 : flangeHeight / 2) + 3;
  const stopBore = n(p, 'tubeOD') - 2 * n(p, 'tubeWall') - 2;
  const flatCount = Math.max(8, count);
  const circumradius = radius / Math.cos(Math.PI / flatCount);
  const outline: [number, number][] = Array.from({ length: flatCount }, (_, index) => {
    const angle = (n(p, 'phase') * Math.PI) / 180 + ((2 * index + 1) * Math.PI) / flatCount;
    return [circumradius * Math.cos(angle), circumradius * Math.sin(angle)];
  });
  const stack = spacerStack(p);
  const spacerHeight = stack.reduce((sum, thickness) => sum + thickness, 0);
  const spacerOD = bore - n(p, 'spacerClearance');
  const stations = Array.from({ length: count }, (_, index) => {
    const angle = n(p, 'phase') + (index * 360) / count;
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
    bore,
    floor,
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
    flatCount,
    outline,
    stack,
    spacerHeight,
    spacerOD,
    stations,
  };
}
