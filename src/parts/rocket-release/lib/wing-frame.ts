import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { cylinder, circle, plate, union, subtract, type Point, type Shape } from './shapes';
import { wingLayout, wingTies } from './wing-layout';
import { controllerMounts, controllerPlacement } from './wing-controller';

const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  planes: [],
  solid,
});
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
/** The existing four floor screws pass through this shelf and its spacers into
 * the metal columns. PCB fasteners carry only the controller, never the cells. */
export function controllerFrame(p: Parameters): Piece[] {
  const w = wingLayout(p);
  if (w.cylindrical) return [];
  const ports: Point[] = [
    [10, -24],
    [10, 24],
  ];
  const holes = [
    ...ports.map(([x, y]) => circle(2.2, x, y)),
    rect(w.controllerX - 12, -7, 24, 14),
    rect(4, -10, 18, 20),
    ...controllerMounts(p).map(([x, y]) => circle(1.1, x + w.controllerX, -y)),
    ...wingTies.map(([x, y]) => circle(1.1, x, y)),
  ];
  return [
    {
      label:
        'WING MINI horizontal shelf · Al5052 t2 · four symmetric metal supports · open component field',
      shape: plate(circle(40), holes, w.base - 8, 2),
      color: 0xc6cdd5,
    },
    ...ports.map(([x, y], i) => ({
      label: `WING MINI shelf wire liner ${i + 1} · silicone Ø4.4/3.4 · flanged`,
      shape: welded(
        union(
          plate(circle(2.2, x, y), [circle(1.7, x, y)], w.base - 8, 2),
          plate(circle(2.8, x, y), [circle(1.7, x, y)], w.base - 8.5, 0.5),
          plate(circle(2.8, x, y), [circle(1.7, x, y)], w.base - 6, 0.5),
        ),
      ),
      color: 0x363e47,
    })),
    ...wingTies.map(([x, y], i) => ({
      label: `WING MINI shelf spacer ${i + 1} · Al6061 Ø6/2.2×6`,
      shape: plate(circle(3, x, y), [circle(1.1, x, y)], w.base - 6, 6),
      color: 0xc6cdd5,
    })),
  ];
}
// Reserved air volumes, deliberately excluded from exported manufactured parts.
// Fit allowances for mating plugs and wire bends; not supplier connector models.
export function controllerServiceZones(p: Parameters): { label: string; shape: Shape }[] {
  return [
    {
      label: 'PLS mating bodies · pin engagement',
      shape: plate(rect(-18.7, -12.8, 7.9, 25.6), [], 7.5, 6.3),
    },
    {
      label: 'PLS plugs and axial wire bend · 12 mm · 26 mm bank width',
      shape: plate(rect(-20, -13, 10.5, 26), [], 13.8, 12),
    },
    {
      label: 'BAT/GND solder and wire access · 12 mm',
      shape: plate(rect(8.5, -6, 7, 14), [], 12.6, 12),
    },
    { label: 'SH side plug insertion · 10 mm', shape: plate(rect(18.5, -11, 10, 22), [], 1, 4) },
  ].map((zone) => ({ ...zone, shape: controllerPlacement(p, zone.shape) }));
}

/** Circular bores preserve the case-bearing rails and the four tie bosses. */
export const controllerLighteningBores = [
  { x: 0, y: 0, diameter: 16 },
  { x: 20, y: 0, diameter: 16 },
  { x: -23, y: 0, diameter: 10 },
];
export function controllerHeelPockets(): Shape[] {
  return controllerLighteningBores.map(({ x, y, diameter }) =>
    cylinder(diameter / 2, 7, [x, y, 1.6]),
  );
}
export const controllerWirePorts: Point[] = [
  [-23, -11],
  [-23, 11],
];
export function controllerHeelWireLiners(): Piece[] {
  return controllerWirePorts.map(([x, y], i) => ({
    label: `WING MINI heel wire liner ${i + 1} · silicone Ø6/4.8 · flanged · through milled heel`,
    shape: welded(
      subtract(
        union(
          plate(circle(3, x, y), [], 2.1, 2),
          plate(circle(3.6, x, y), [], 1.6, 0.5),
          plate(circle(3.6, x, y), [], 4.1, 0.5),
        ),
        plate(circle(2.4, x, y), [], 1.5, 3.2),
      ),
    ),
    color: 0x363e47,
  }));
}
