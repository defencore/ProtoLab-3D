import type { Parameters } from '../../../core/types';
import { box, cylinder, prism, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import { layout } from './layout';

const bossRadius = 5.7;
const roofThickness = 3;
const nutAxialClearance = 0.25;

/** The nut bears upward against this base-owned roof when the lid screw is tightened. */
export function baseNutBoss(p: Parameters, x: number, y: number): Shape {
  const d = layout(p);
  const pocketHeight = d.nutHeight + nutAxialClearance;
  const roofBottom = d.nutBottom + pocketHeight;
  const bossTop = roofBottom + roofThickness;
  const pocketAcrossFlats = 5.5 + 2 * d.clearance;
  const hexPocket = prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const angle = Math.PI / 6 + (i * Math.PI) / 3;
      return [
        x + (pocketAcrossFlats / Math.sqrt(3)) * Math.cos(angle),
        y + (pocketAcrossFlats / Math.sqrt(3)) * Math.sin(angle),
      ];
    }),
    pocketHeight,
    d.nutBottom,
  );
  // Assemble the nut before fitting the wall, which then surrounds this side entry.
  const entryWidth = Math.max(6.1, pocketAcrossFlats);
  const sideEntry = box(
    [entryWidth, bossRadius + 0.2, pocketHeight],
    [x - entryWidth / 2, y > 0 ? y - bossRadius - 0.1 : y - 0.1, d.nutBottom],
  );
  return subtract(
    cylinder(bossRadius, bossTop - d.baseTop, [x, y, d.baseTop]),
    cylinder(1.75, bossTop - 5 + 0.1, [x, y, 5]),
    hexPocket,
    sideEntry,
  );
}

/** Clearance lets the wall seat on the base without taking over the nut's bearing roof. */
export function baseNutBossRelief(p: Parameters, x: number, y: number): Shape {
  const d = layout(p);
  const bossTop = d.nutBottom + d.nutHeight + nutAxialClearance + roofThickness;
  return cylinder(bossRadius + d.clearance, bossTop + d.clearance - d.baseTop, [x, y, d.baseTop]);
}
