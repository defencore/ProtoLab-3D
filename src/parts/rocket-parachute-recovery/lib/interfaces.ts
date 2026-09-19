import type { Parameters } from '../../../core/types';
import { at } from '../../rocket-release/lib/motion';
import { radialScrew } from '../../rocket-release/lib/hardware';
import { transform, rotate, cylinder, type Shape } from '../../rocket-release/lib/shapes';
import { springDimensions } from './motion';
export const guideStop = (p: Parameters) => springDimensions(p).cassetteBottom + +p.springTravel;
export const packingPinZ = (p: Parameters) => springDimensions(p).cassetteBottom - 4;
export function supportMounts(p: Parameters): Shape[] {
  const h = radialScrew(45, 39.65);
  return [60, 180, 300].map((a) =>
    transform(rotate(h.shape, 90, 'y'), a, [...at(h.tipRadius, a), guideStop(p) + 2]),
  );
}
export function packingMounts(p: Parameters): Shape[] {
  const h = radialScrew(45, 42.75),
    z = packingPinZ(p);
  return [-6, 6].map((dz) => transform(rotate(h.shape, 90, 'y'), 90, [0, h.tipRadius, z + dz]));
}
export function packingBore(p: Parameters): Shape {
  return transform(rotate(cylinder(2.1, 20, [0, 0, 0]), 90, 'y'), 90, [0, 27, packingPinZ(p)]);
}
/** Smooth circular eye: the cord bears on a 2 mm surface radius, not a cut plate edge. */
export const cordEye = (z: number): Shape =>
  transform(rotate({ kind: 'torus', radius: 6, wireRadius: 2, arc: 360 }, 90, 'x'), 0, [0, 0, z]);
export const fairlead = (z: number, height: number): Shape => ({
  kind: 'union',
  children: [
    {
      kind: 'subtract',
      children: [cylinder(6, height, [0, 0, z]), cylinder(5, height + 2, [0, 0, z - 1])],
    },
    transform({ kind: 'torus', radius: 5, wireRadius: 1, arc: 360 }, 0, [0, 0, z + 1]),
    transform({ kind: 'torus', radius: 5, wireRadius: 1, arc: 360 }, 0, [0, 0, z + height - 1]),
  ],
});
