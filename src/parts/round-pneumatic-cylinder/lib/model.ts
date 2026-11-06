import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import { cylinder, subtract, union } from '../../../core/assembly/boundary/shapes';
import models from './models.json';
/** Source-identified external installation reference; critical missing dimensions stay disclosed. */
export function cylinderPieces(p: Parameters): Piece[] {
  const model = models.find((item) => item.id === p.model);
  if (!model) throw new Error('Select a supported round cylinder execution.');
  const length = model.body;
  const caps = [0, length - 17].map((z): Piece => ({
    label: `Cylinder end cap ${z === 0 ? 'front' : 'rear'} · fit reference`,
    color: 0x738494,
    shape: subtract(
      union(cylinder(18.25, 17, [0, 0, z]), cylinder(6, 6, [14, 0, z + 8.5], 'x')),
      cylinder(5.1, 19, [0, 0, z - 1]),
      cylinder(4.3, 13, [9, 0, z + 8.5], 'x'),
    ),
  }));
  return [
    {
      label: 'Stainless barrel · shell fit reference',
      color: 0xc4cdd4,
      shape: subtract(
        cylinder(17.5, length - 34, [0, 0, 17]),
        cylinder(16, length - 32, [0, 0, 16]),
      ),
    },
    ...caps,
    {
      label: 'Rod and smooth nominal M10 thread envelope',
      color: 0xdce0e3,
      shape: cylinder(5, model.referenceOverall - length + +p.extension, [0, 0, length]),
    },
  ];
}
