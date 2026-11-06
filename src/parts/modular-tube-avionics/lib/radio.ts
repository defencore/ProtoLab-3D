import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { at, intersect } from './shared';

/** Fixed user envelopes; antenna diameter and junction thickness remain fitting assumptions. */
export const radioDatums = {
  receiver: { center: [0, 12.8, -31] as [number, number, number], size: [25, 13, 4], seat: -33 },
  antenna: {
    junction: [0, -18.7, -31.2] as [number, number, number],
    junctionSize: [10, 10, 3],
    diameter: 2.8,
    armLength: 25,
    stemLength: 20,
  },
  receiverTieX: [-8, 8],
  antennaTieX: [-18, 18],
  tunnel: { width: 3.5, height: 2, cornerRadius: 0.4 },
  installationTravel: 20,
} as const;
export const lowerCoverPartIds = [
  'flight-lower-cover',
  'flight-radio-receiver-reference',
  'flight-radio-antenna-reference',
] as const;

function tunnelY(x: number, y0: number, y1: number, z: number): Shape {
  return at(roundedRect(3.5, 2, 0.4, -(y1 - y0) / 2, y1 - y0), [x, (y0 + y1) / 2, z], [90, 0, 0]);
}
function tunnelX(x0: number, x1: number, y: number, z: number): Shape {
  return at(roundedRect(2, 3.5, 0.4, -(x1 - x0) / 2, x1 - x0), [(x0 + x1) / 2, y, z], [0, 90, 0]);
}

/** One printed lid only: five rooted tie saddles, with no separate clips or radio hardware. */
export function radioCoverMount(_p: Parameters, blank: Shape): Shape {
  const receiver = radioDatums.receiverTieX.map((x) => box([10, 15.6, 10.5], [x - 5, 4.2, -43.5]));
  const arms = radioDatums.antennaTieX.map((x) => box([10, 5, 11.5], [x - 5, -21.2, -43.5]));
  const junction = box([13, 10, 10.8], [-6.5, -23.7, -43.5]);
  const stock = intersect(
    union(...receiver, ...arms, junction),
    cylinder(46, 140, [-70, 0, 0], 'x'),
  );
  return subtract(
    union(blank, stock),
    ...radioDatums.receiverTieX.map((x) => tunnelY(x, 4, 20, -37)),
    ...radioDatums.antennaTieX.flatMap((x) => [
      tunnelY(x, -21.4, -16, -36.6),
      // A shallow true circular seat supports the lower wire arc without a thin clip.
      cylinder(1.4, 12, [x - 6, -18.7, -31.2], 'x'),
    ]),
    tunnelX(-6.7, 6.7, -18.7, -36.7),
  );
}

/** Inspection witnesses only. Straps and actual radio procurement are intentionally unselected. */
export function radioReferences(_p: Parameters): ConfiguredPiece[] {
  const antenna = union(
    box([10, 10, 3], [-5, -23.7, -32.7]),
    cylinder(1.4, 25, [-30, -18.7, -31.2], 'x'),
    cylinder(1.4, 25, [5, -18.7, -31.2], 'x'),
    cylinder(1.4, 20, [0, -13.7, -31.2], 'y'),
  );
  return [
    {
      id: 'flight-radio-receiver-reference',
      label: 'User ELRS MINI envelope · 25 × 13 × 4 mm',
      shape: box([25, 13, 4], [-12.5, 6.3, -33]),
    },
    {
      id: 'flight-radio-antenna-reference',
      label: 'User T antenna · 60 mm span · 20 mm stem',
      shape: antenna,
    },
  ].map((item) => {
    const component = detailComponent(item.id, item.label, item.shape, {
      nativeRefine: true,
      meshBackend: 'jscad',
    });
    component.supply = 'reference';
    component.notes =
      'User-dimensioned installation witness, resting on the integral lower-lid tie saddles. Receiver identity/connector and antenna diameter/junction thickness remain unverified. The user selects and installs straps; none is invented or procured by this model. Exclude witnesses from physical BOM and manufacturing exports.';
    return {
      component,
      label: item.label,
      color: item.id.includes('antenna') ? 0xc14a58 : 0x40635a,
    };
  });
}
