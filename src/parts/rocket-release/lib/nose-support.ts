import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { at, layout } from './motion';
import { batteryPosts, batteryLayout } from './balance';
import { plate, circle, subtract, transform, rotate, type Shape } from './shapes';
import { radialScrew, matingHole } from './hardware';
import { packWirePorts, packLightening } from './pack-support';
import { hatMounts, hatBolt } from './electronics';
export const noseRadialBolts = (p: Parameters) =>
  [0, 90, 180, 270].map((a) =>
    transform(rotate(radialScrew(+p.tubeOD / 2, layout(p).radius).shape, 90, 'y'), a, [
      ...at(radialScrew(+p.tubeOD / 2, layout(p).radius).tipRadius, a),
      39,
    ]),
  );
/** Four broad curved walls, integral with the disk, with diagonal cartridge access. */
export const noseWalls = (p: Parameters): Shape[] => {
  const R = layout(p).radius;
  return [0, 90, 180, 270].map((a, i) => {
    const outer = Array.from({ length: 11 }, (_, j) => at(R - 0.05, a - 15 + j * 3));
    const inner = Array.from({ length: 11 }, (_, j) => at(R - 3, a + 15 - j * 3));
    return subtract(plate([...outer, ...inner], [], 34, 10), matingHole(noseRadialBolts(p)[i]));
  });
};
export function noseSupport(p: Parameters): Piece[] {
  const m = layout(p),
    out: Piece[] = noseRadialBolts(p).map((shape, i) => ({
      label: `Nose radial mounting screw ${i + 1} · countersunk 90°`,
      shape: transform(shape, 0, [0, 0, m.stackOffset]),
      color: 0x929eac,
    }));
  if (m.batteries)
    out.push({
      label:
        '3S and HAT structural frame · Al6061 sheet t3 · web-preserving lightening bores · 2×Ø8 lined harness ports · tied directly to servo mounting disk',
      color: 0xc6cdd5,
      shape: subtract(
        plate(
          circle(m.radius - 1.5),
          [
            circle(10),
            ...packLightening(p, true).map(([x, y, r]) => circle(r, x, y)),

            ...batteryPosts(m.radius).map(([x, y]) => circle(1.1, x, y)),
            ...batteryLayout(p).map(([x, y]) => circle(6, x, y)),
            ...packWirePorts.map(([x, y]) => circle(4, x, y)),
          ],
          5,
          3,
        ),
        ...hatMounts.map(([x, y]) => matingHole(hatBolt(x, y))),
      ),
    });
  return out;
}
