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
    cylinder(3.9, length, [start, 0, screwAxisHeight], 'x'),
    cylinder(3.025, length + 0.2, [start - 0.1, 0, screwAxisHeight], 'x'),
  ),
});
export function retentionPieces(): Piece[] {
  return [
    sleeve('fixed-inner-sleeve', 'Fixed bearing outer spacer · 6.05×7.8×12.8', -32, 12.8),
    sleeve('fixed-shoulder-sleeve', 'Fixed bearing shoulder spacer · 6.05×7.8×2.2', -14.2, 2.2),
    sleeve('floating-inner-sleeve', 'Floating bearing inner-race spacer · 6.05×7.8×1.8', 46, 1.8),
  ];
}
