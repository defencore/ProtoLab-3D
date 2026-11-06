import { cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import { screwAxisHeight } from './drive-layout';

export interface Piece {
  id: string;
  label: string;
  color: number;
  shape: Shape;
}
const sleeve = (id: string, label: string, start: number, length: number): Piece => ({
  id,
  label,
  color: 0xaeb5be,
  shape: subtract(
    cylinder(3.8, length, [start, 0, screwAxisHeight], 'x'),
    cylinder(2.525, length + 0.2, [start - 0.1, 0, screwAxisHeight], 'x'),
  ),
});

/** The four clips carry bearing thrust; no threaded-stock crest is used as a shoulder. */
export function retentionPieces(): Piece[] {
  return [
    sleeve(
      'fixed-inner-spacer',
      'Fixed screw bearing inner thrust spacer · 5.05×7.6×0.5',
      -15,
      0.5,
    ),
    sleeve(
      'fixed-outer-spacer',
      'Fixed screw bearing outer thrust spacer · 5.05×7.6×0.5',
      -19.5,
      0.5,
    ),
    sleeve(
      'floating-inner-spacer',
      'Floating screw bearing inner thrust spacer · 5.05×7.6×0.5',
      14.5,
      0.5,
    ),
    sleeve(
      'floating-outer-spacer',
      'Floating screw bearing outer thrust spacer · 5.05×7.6×0.5',
      19,
      0.5,
    ),
  ];
}
