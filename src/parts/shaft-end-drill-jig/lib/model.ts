import { n, C, prism, subtract, made, guides, holeSize, path, type Vec } from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const bore = n(p, 'stockOD') + n(p, 'clearance'),
    r = Math.max(bore / 2 + n(p, 'wall'), holeSize(p) / 2 + 4),
    h = n(p, 'sleeve');
  return {
    bore,
    r,
    h,
    outline: Array.from({ length: 8 }, (_, i): [number, number] => [
      (r / Math.cos(Math.PI / 8)) * Math.cos(((2 * i + 1) * Math.PI) / 8),
      (r / Math.cos(Math.PI / 8)) * Math.sin(((2 * i + 1) * Math.PI) / 8),
    ]),
    centers: [[0, 0, h]] as Vec[],
  };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    t = n(p, 'plate');
  return [
    made(
      'sleeve',
      'Flat-sided centering sleeve / positive end stop',
      subtract(
        prism(d.outline, d.h + t, 0),
        C(d.bore, d.h + 1, 0, 0, -1),
        C(holeSize(p), t + 2, 0, 0, d.h - 0.1),
      ),
    ),
    ...guides(p, d.centers, t),
  ];
}
export function paths(p: Parameters) {
  const d = layout(p);
  return [path(0, 0, d.h - 0.2, n(p, 'drill'), n(p, 'plate') + 0.4)];
}
export function validate(p: Parameters) {
  return holeSize(p) + 2 >= n(p, 'stockOD')
    ? [
        'The shaft end must leave at least 1 mm of radial stop land around the guide opening. Use a smaller guide or larger shaft.',
      ]
    : [];
}
export function assessment(p: Parameters) {
  return [
    `Shaft inserts from Z=0 and seats at Z=${p.sleeve}. The centered drill axis is Z.`,
    `Grip the flats, clamp the shaft independently and spot-drill first. Diameter clearance contributes directly to centering uncertainty; measure the actual shaft and test fit.`,
  ];
}
