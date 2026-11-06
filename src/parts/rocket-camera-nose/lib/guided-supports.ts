import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, prism, union, type Shape } from '../../../core/assembly/boundary/shapes';

/** Common case/cassette datums. Running fits require calibration with the actual PETG. */
export function guidedSupportDatums(p: Parameters) {
  return {
    rear: -n(p, 'shoulderLength'),
    guideRear: -n(p, 'shoulderLength') + 9,
    rearBand: [-72, -60] as const,
    frontBand: [54, 66] as const,
    seatZ: 68,
    backX: -28,
    guideX: -28.2,
    seatInnerX: -24.3,
    keyY: -16,
    keyTipX: -25,
    grooveFloorX: -24.8,
    runningGap: 0.2,
    sideY: -35.5,
    sideGuideY: -35.7,
    frontPositiveX: 27.2,
  };
}

/** Open 45-degree keyway; opposed case bearings carry X loads without a retaining lip. */
export function guidedSupportGroove(p: Parameters): Shape {
  const a = guidedSupportDatums(p);
  return prism(
    [
      [-28.4, a.keyY - 6.5],
      [a.grooveFloorX, a.keyY - 2.9],
      [a.grooveFloorX, a.keyY + 2.9],
      [-28.4, a.keyY + 6.5],
    ],
    a.seatZ - a.rear + 0.4,
    a.rear - 0.2,
  );
}

/** Extra stock is confined behind the seat; all leading camera/board geometry stays unchanged. */
export function guidedSupportBackplate(p: Parameters): Shape {
  const a = guidedSupportDatums(p);
  return box([4, 66, a.seatZ - a.rear], [a.backX, -33, a.rear]);
}

const xRamp = (inner: number, y: number, width: number, back: number, front: number): Shape => ({
  kind: 'prism',
  axis: 'y',
  depth: width,
  origin: y,
  points: [
    [inner, back],
    [46, back],
    [46, front + 20],
    [inner + 20, front + 20],
    [inner, front],
  ],
});

/** Broad case stock is clipped to the unchanged analytic exterior by guidedShellShape. */
export function guidedShellSupportStock(p: Parameters): Shape {
  const a = guidedSupportDatums(p);
  const negative: Shape = {
    kind: 'prism',
    axis: 'y',
    depth: 28,
    origin: -28,
    points: [
      [-46, a.guideRear],
      [a.guideX, a.guideRear],
      [a.guideX, a.seatZ],
      [a.seatInnerX, a.seatZ],
      [a.seatInnerX, a.seatZ + 6],
      [a.seatInnerX - 16, a.seatZ + 22],
      [-46, a.seatZ + 22],
    ],
  };
  const keyProfile: [number, number][] = [
    [a.guideX, a.keyY - 6],
    [a.keyTipX, a.keyY - 2.8],
    [a.keyTipX, a.keyY + 2.8],
    [a.guideX, a.keyY + 6],
  ];
  const lead: Shape = {
    kind: 'loft',
    rings: [
      keyProfile.map(([x, y]) => [
        a.guideX + 0.7 * (x - a.guideX),
        a.keyY + 0.7 * (y - a.keyY),
        a.guideRear,
      ]),
      keyProfile.map(([x, y]) => [x, y, a.guideRear + 2]),
    ],
  };
  const key = union(lead, prism(keyProfile, a.seatZ - a.guideRear - 2, a.guideRear + 2));
  const widerSeat: Shape = {
    kind: 'prism',
    axis: 'y',
    depth: 38,
    origin: -30,
    points: [
      [-46, a.seatZ],
      [a.seatInnerX, a.seatZ],
      [a.seatInnerX, a.seatZ + 6],
      [a.seatInnerX - 16, a.seatZ + 22],
      [-46, a.seatZ + 22],
    ],
  };
  const side = (sign: number, back: number, front: number): Shape => ({
    kind: 'transform',
    translation: [6.5, 0, 0],
    rotation: [0, 90, 0],
    child: prism(
      [
        [-46, back],
        [a.sideGuideY, back],
        [a.sideGuideY, front],
        [a.sideGuideY - 6, front + 6],
        [-48, front + 6],
      ].map(([y, z]) => [-z, sign * y] as [number, number]),
      8,
      0,
    ),
  });
  return union(
    negative,
    widerSeat,
    key,
    ...[-1, 1].flatMap((sign) => [side(sign, ...a.rearBand), side(sign, ...a.frontBand)]),
    xRamp(a.frontPositiveX, -8, 16, 96, 104),
  );
}

export function guidedSupportSeatContact(p: Parameters) {
  return {
    id: 'cassette-to-case-axial-seat',
    first: 'cassette-cage-base',
    second: 'outer-shell',
    axis: 'z',
    planeCoordinate: guidedSupportDatums(p).seatZ,
    minArea: 25,
  };
}
