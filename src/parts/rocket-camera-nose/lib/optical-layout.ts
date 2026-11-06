import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';

export const opticalSetup = (p: Parameters) => String(p.cameraSetup ?? 'camera-19');
export const hasOV9281 = (p: Parameters) => opticalSetup(p) !== 'camera-19';
export function opticalLayout(p: Parameters) {
  const dual = opticalSetup(p) === 'dual';
  const l = n(p, 'noseLength');
  return {
    dual,
    crownRadius: dual ? 36 : 28,
    ov: { center: [dual ? 15 : 0, -0.5, l - 18.8] as Vec, rotation: [0, 0, 180] as Vec },
    old: { center: [-15, -5, l - 25] as Vec, rotation: [0, 0, -90] as Vec },
    windows: (dual ? [-15, 15] : [0]).map((x) => ({
      x,
      y: dual && x < 0 ? -5 : -0.5,
      ov: !dual || x > 0,
    })),
    deckRear: l - 15.4,
    deckFront: l - 10.6,
    capBolts: [-1, 1].map((side) => [dual ? 0 : side * 21, dual ? side * 31 : 0, l - 10.6] as Vec),
  };
}
export function opticalOuterRadius(p: Parameters, z: number) {
  const r = n(p, 'tubeOD') / 2,
    rise = r - opticalLayout(p).crownRadius;
  const rho = (n(p, 'noseLength') ** 2 + rise ** 2) / (2 * rise);
  return Math.sqrt(Math.max(0, rho ** 2 - z ** 2)) + r - rho;
}
export function at(shape: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape {
  return { kind: 'transform', child: shape, translation, rotation };
}
