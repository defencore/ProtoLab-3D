import type { Piece } from './model';
import { bore, axialScrew, metal } from './mechanical';
import { subtract, ring, union, type Point, type Shape } from '../../rocket-release/lib/shapes';
import { h7Spec, mountingHoles } from '../../lch7-controller/lib/model';
export { h7Spec } from '../../lch7-controller/lib/model';
export const h7BoardOffset = 8.5;
export const h7Mounts: Point[] = mountingHoles.map(([x, y]) => [
  (x - y) / Math.SQRT2,
  (x + y) / Math.SQRT2,
]);
export function h7MountScrew(clampBottom: number, x: number, y: number, length = 16): Shape {
  const washerZ = clampBottom - h7BoardOffset - h7Spec.boardThickness - 1.5;
  return axialScrew(2.5, length, washerZ + length, x, y, true);
}
export function mountedH7(clampBottom: number, mounts = h7Mounts, screwLength = 16): Piece[] {
  const boardZ = clampBottom - h7BoardOffset,
    frontZ = boardZ - h7Spec.boardThickness,
    out: Piece[] = [];
  const add = (
    label: string,
    shape: Shape,
    material: string,
    process: string,
    color = metal,
    metadata?: Record<string, string>,
  ) => out.push({ label, shape, material, process, color, metadata });
  for (const [i, [x, y]] of mounts.entries()) {
    // A stepped compression limiter carries screw preload into the plate. The
    // PCB is captured between silicone flanges, without a metal contact path.
    add(
      `LCH7 compression spacer ${i + 1} · Al6061 D6 body / D3.2 sleeve · D2.6 through`,
      subtract(
        union(
          bore(3, boardZ + 1, h7BoardOffset - 1, x, y),
          bore(1.6, frontZ - 1, h7Spec.boardThickness + 2.05, x, y),
        ),
        bore(1.3, frontZ - 1.1, clampBottom - frontZ + 1.2, x, y),
      ),
      'Al6061',
      'TURN / DRILL',
      metal,
      {
        Retention:
          'The shoulder and sleeve set the clamping height. The sleeve clears the PCB D4 hole; no nut or metal washer bears directly on the PCB.',
      },
    );
    add(
      `LCH7 elastomer damper ${i + 1} · silicone D6 flanges / D4 barrel / D3.3 bore`,
      subtract(
        union(
          bore(3, frontZ - 1, 1, x, y),
          bore(2, frontZ - 0.05, h7Spec.boardThickness + 0.1, x, y),
          bore(3, boardZ, 1, x, y),
        ),
        bore(1.65, frontZ - 1.1, h7Spec.boardThickness + 2.2, x, y),
      ),
      'silicone',
      'MOLD / FIT REFERENCE',
      0x333c46,
      {
        Fit: 'Split-flange grommet installed in each measured D4 PCB hole. Nominal uncompressed fit; choose elastomer stiffness and verify retention/preload on hardware.',
      },
    );
    add(
      `BUY LCH7 mounting screw ${i + 1} · ISO 4762 M2.5x${screwLength} · into tapped controller carrier`,
      h7MountScrew(clampBottom, x, y, screwLength),
      'stainless steel',
      'BUY',
    );
    add(
      `BUY LCH7 washer ${i + 1} · M2.5 D5 / 2.7 t0.5`,
      ring(2.5, 1.35, frontZ - 1.5, 0.5, x, y),
      'stainless steel',
      'BUY',
    );
  }
  return out;
}
