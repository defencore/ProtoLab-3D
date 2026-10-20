import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import {
  cylinder,
  box,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
export { cylinder, box, subtract, union, prism } from '../../../core/assembly/boundary/shapes';
export type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
export { n } from '../../../core/geometry';
export interface Piece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  bought?: string;
  metal?: boolean;
}
export interface ToolPath {
  origin: Vec;
  axis: Vec;
  diameter: number;
  length: number;
}
export const C = (d: number, h: number, x = 0, y = 0, z = 0): Shape =>
  cylinder(d / 2, h, [x, y, z]);
export const B = (x: number, y: number, z: number, cx = 0, cy = 0, bottom = 0): Shape =>
  box([x, y, z], [cx - x / 2, cy - y / 2, bottom]);
export const ring = (outer: number, bore: number, length: number, x = 0, y = 0, z = 0): Shape =>
  subtract(C(outer, length, x, y, z), C(bore, length + 2, x, y, z - 1));
export const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const made = (id: string, label: string, shape: Shape, metal = false): Piece => ({
  id,
  label,
  shape,
  color: metal ? 0x8097a8 : 0xe9ac45,
  metal,
});
export const bought = (id: string, label: string, shape: Shape, designation = label): Piece => ({
  id,
  label,
  shape,
  color: 0xaec5d5,
  bought: designation,
});
export const holeSize = (p: Parameters): number =>
  p.guide === 'bushing' ? Number(p.bushOD) + Number(p.seatAllowance) : Number(p.drill) + 0.1;
export function guides(
  p: Parameters,
  centers: Vec[],
  length: number,
  rotation: Vec = [0, 0, 0],
): Piece[] {
  return p.guide === 'bushing'
    ? centers.map((origin, i) =>
        bought(
          'bushing-' + (i + 1),
          `Drill bushing ${i + 1} / ${p.drill} mm`,
          move(ring(Number(p.bushOD), Number(p.drill) + 0.05, length), origin, rotation),
          `Custom steel drill bushing / ID ${Number(p.drill) + 0.05} x OD ${p.bushOD} x L ${length} mm`,
        ),
      )
    : [];
}
export function configured(pieces: Piece[], state: string) {
  return pieces.map((piece, i) => {
    const item: AssemblyComponent = detailComponent(piece.id, piece.label, piece.shape);
    if (piece.bought) {
      item.libraryId = 'purchased-component';
      item.supply = 'purchased';
      item.procurement = {
        designation: piece.bought,
        manufacturer: '',
        source: 'Custom / commodity item; select actual supplier and verify dimensions',
      };
    } else
      item.manufacturing = {
        material: piece.metal
          ? 'Steel or aluminium; specify grade and thickness'
          : 'PETG / PA prototype or machined stock; qualify stiffness and wear',
        blank: piece.metal ? 'Plate or round stock' : 'Printed or machined blank',
        processes: piece.metal ? ['cutting', 'drilling'] : ['printing'],
        requirements: [
          'Locate on the stated datum and clamp before use. Qualify fits, retention, actual thickness, tool clearance and working load.',
        ],
      };
    return {
      component: item,
      label: piece.label,
      color: piece.color,
      requireSingleSolid: true,
      position: [0, 0, state === 'exploded' && i > 0 ? 12 + i * 3 : 0] as Vec,
    };
  });
}
export function roundedRect(length: number, width: number, radius: number): [number, number][] {
  const points: [number, number][] = [];
  for (let corner = 0; corner < 4; corner++) {
    const a = (corner * Math.PI) / 2,
      cx = (corner === 0 || corner === 3 ? 1 : -1) * (length / 2 - radius),
      cy = (corner < 2 ? 1 : -1) * (width / 2 - radius);
    for (let k = 0; k <= 12; k++) {
      const t = a + (k * Math.PI) / 24;
      points.push([cx + radius * Math.cos(t), cy + radius * Math.sin(t)]);
    }
  }
  const clean = points.filter(
    (point, i) =>
      i === 0 || Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) > 1e-8,
  );
  if (Math.hypot(clean[0][0] - clean.at(-1)![0], clean[0][1] - clean.at(-1)![1]) < 1e-8)
    clean.pop();
  return clean;
}
export function clampSlots(length: number, width: number, height: number, z = 0): Shape[] {
  return [-1, 1].flatMap((sign) => [
    C(6.5, height + 2, sign * (length / 2 - 10), -width / 2 + 10, z - 1),
    C(6.5, height + 2, sign * (length / 2 - 10), width / 2 - 10, z - 1),
  ]);
}
export const path = (
  x: number,
  y: number,
  z: number,
  diameter: number,
  length: number,
  axis: Vec = [0, 0, 1],
): ToolPath => ({ origin: [x, y, z], axis, diameter, length });
