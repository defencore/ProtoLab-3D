import {
  n,
  C,
  B,
  move,
  subtract,
  union,
  made,
  bought,
  ring,
  holeSize,
  clampSlots,
  path,
  type Vec,
} from './common';
import type { Parameters } from '../../../core/types';
export function layout(p: Parameters) {
  const a = (n(p, 'angle') * Math.PI) / 180,
    h = n(p, 'height'),
    axis: Vec = [-Math.sin(a), 0, Math.cos(a)],
    od = Math.max(n(p, 'bushOD') + 8, 20),
    seatStart = h - 12;
  return { a, h, axis, od, seatStart };
}
export function pieces(p: Parameters) {
  const d = layout(p),
    rot: Vec = [0, -n(p, 'angle'), 0],
    len = 12;
  const tilted = (shape: import('./common').Shape) => move(shape, [0, 0, 0], rot);
  const body = subtract(
    union(B(n(p, 'length'), n(p, 'width'), n(p, 'plate')), tilted(C(d.od, d.h))),
    B(2 * n(p, 'length'), 2 * n(p, 'width'), 2 * d.od, 0, 0, -2 * d.od),
    tilted(C(n(p, 'drill') + 0.2, d.h + 3, 0, 0, -1)),
    tilted(C(holeSize(p), len + 1, 0, 0, d.seatStart)),
    ...clampSlots(n(p, 'length'), n(p, 'width'), n(p, 'plate')),
  );
  return [
    made('body', 'Inclined sleeve / flat clamp foot', body),
    ...(p.guide === 'bushing'
      ? [
          bought(
            'bushing',
            'Inclined steel drill bushing',
            tilted(ring(n(p, 'bushOD'), n(p, 'drill') + 0.05, len, 0, 0, d.seatStart)),
            `Custom steel bushing / ID ${n(p, 'drill') + 0.05} x OD ${p.bushOD} x L12 mm`,
          ),
        ]
      : []),
  ];
}
export function paths(p: Parameters) {
  const d = layout(p);
  return [path(d.axis[0] * -0.5, 0, d.axis[2] * -0.5, n(p, 'drill'), d.h + 1, d.axis)];
}
export function validate(p: Parameters) {
  const d = layout(p);
  return [
    p.guide === 'bushing' && d.seatStart * Math.cos(d.a) - (n(p, 'bushOD') / 2) * Math.sin(d.a) < 1
      ? 'Increase guide length so the complete bushing remains above the workpiece support plane.'
      : '',
    Math.sin(d.a) * d.h + d.od / 2 + 5 > n(p, 'length') / 2
      ? 'Increase the foot length so the inclined sleeve remains inside its support footprint.'
      : '',
    n(p, 'width') < d.od + 24
      ? 'Increase foot width to separate the clamp holes from the sleeve.'
      : '',
  ].filter(Boolean);
}
export function assessment(p: Parameters) {
  return [
    `Drill axis tilt ${p.angle} degrees from the surface normal; it intersects the workpiece plane at X=0, Y=0, Z=0.`,
    `Align that entry point with the workpiece mark and clamp the flat foot. A hand drill follows the inclined guide; a drill press requires tilting and securing the workpiece so its spindle aligns with the guide axis.`,
  ];
}
