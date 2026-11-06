import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

export function layout(p: Parameters) {
  const width = Number(p.width),
    t = Number(p.baseThickness),
    r = Number(p.pinDiameter) / 2,
    length = Number(p.engagement),
    wall = Number(p.wall),
    chamfer = Number(p.tipChamfer),
    clearance = Number(p.clearance),
    end = Number(p.endClearance),
    gap = Number(p.faceGap);
  return {
    width,
    t,
    r,
    length,
    wall,
    chamfer,
    clearance,
    end,
    gap,
    socketBottom: t + gap,
    socketTop: t + length + end + wall,
    boreRadius: r + clearance / 2,
    effectiveEngagement: length - gap - chamfer,
  };
}

export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  const pin: Shape = union(box([d.width, d.width, d.t], [-d.width / 2, -d.width / 2, 0]), {
    kind: 'revolve',
    profile: [
      [0, d.t - 0.2],
      [d.r, d.t - 0.2],
      [d.r, d.t + d.length - d.chamfer],
      [d.r - d.chamfer, d.t + d.length],
      [0, d.t + d.length],
    ],
    segments: 64,
  });
  const socket = subtract(
    box(
      [d.width, d.width, d.socketTop - d.socketBottom],
      [-d.width / 2, -d.width / 2, d.socketBottom],
    ),
    cylinder(d.boreRadius, d.length + d.end - d.gap + 1, [0, 0, d.socketBottom - 1]),
  );
  return [
    detailComponent('pin', 'Printed locating pin coupon', pin, { preserveAuthoredFrame: true }),
    detailComponent('socket', 'Printed blind socket coupon', socket, {
      preserveAuthoredFrame: true,
    }),
  ].map((component) => ({
    ...component,
    manufacturing: {
      material: 'Project-selected printing polymer; specify grade and print settings',
      blank: 'Individually printed coupon',
      processes: ['printing'],
      requirements: [
        'Print the pin base down and the socket closed face down with the bore opening upward.',
        'Measure pin and bore, calibrate diametral clearance, and qualify orientation, shrinkage, insertion force and required working loads.',
      ],
    },
  }));
}

export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p);
  return components(p).map((component, i) => ({
    component:
      state === 'print' && i === 1
        ? {
            ...component,
            placement: {
              translation: [d.width + 8, 0, d.socketTop] as Vec,
              rotation: [180, 0, 0] as Vec,
            },
          }
        : component,
    label: component.name,
    color: i === 0 ? 0xe9ac45 : 0x457b85,
    requireSingleSolid: true,
    position: state === 'exploded' && i === 1 ? [0, 0, d.length + 8] : [0, 0, 0],
  }));
}
