import { cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';

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
    cylinder(3.9, length, [start, 0, 28], 'x'),
    cylinder(3.025, length + 0.2, [start - 0.1, 0, 28], 'x'),
  ),
});
export function retentionPieces(): Piece[] {
  return [
    sleeve('fixed-inner-sleeve', 'Fixed bearing inner-race spacer · 6.05×7.8×15', -32, 15),
    sleeve('floating-inner-sleeve', 'Floating bearing inner-race spacer · 6.05×7.8×1.8', 46, 1.8),
  ];
}
