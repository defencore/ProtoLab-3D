import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import {
  accessWindowDatums,
  at,
  cableCuts,
  datums,
  discShape,
  intersect,
  tubeReferenceDatums,
  type PrintedItem,
} from './shared';
import { powerInterface, powerRearAnchor } from './power';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import { purchased } from './shared';
import { noseDatums } from './nose';
import { flightCouplingMount, flightCouplingSlot, flightDatums } from './flight';

export const anchorStations = [
  datums.nose.aft - datums.discThickness,
  datums.flight.front,
  datums.flight.back - datums.discThickness,
  datums.spool.front,
  datums.spool.back - datums.discThickness,
  datums.power.front,
  datums.power.back - datums.discThickness,
].map((x) => x + datums.anchorOffsetX);
export const holeStations = [noseDatums.shellAnchorX, ...anchorStations];
const tailTieY = [-10, 10];
export const tailInterface = {
  plateThickness: 7,
  bufferThickness: 5,
  postRadius: 4.1,
  postClearanceRadius: 4.3,
} as const;
export const tubeMounting = {
  pilotDiameter: 3.4,
  anchorHeadDiameter: 6.4,
  anchorConeBottomY: 43.2,
  anchorConeTopY: 44.7,
  shellHeadDiameter: 6.2,
  shellHeadSeatY: 44.5,
} as const;
export const serviceLibraries = [bolt, nut, washer];
export function tailAnchorDisc(shape: Shape): Shape {
  const d = powerRearAnchor;
  const length = datums.discThickness + tailInterface.plateThickness;
  // Reuse only the power-facing voids. Rebuilding plain stock removes the old
  // X250 pin/socket gaps, aft cable flares and aft-open radial-nut mouths.
  const foreFeatures = intersect(
    subtract(cylinder(datums.radius, datums.discThickness, [d.faceX, 0, 0], 'x'), shape),
    box([datums.discThickness + 0.2, 64, 86], [d.faceX - 0.1, -32, -43]),
  );
  const stock = union(
    cylinder(datums.radius, length, [d.faceX, 0, 0], 'x'),
    ...tailTieY.map((y) =>
      cylinder(
        tailInterface.postRadius,
        tailInterface.bufferThickness + 0.2,
        [datums.tail.front + tailInterface.plateThickness - 0.2, y, 33],
        'x',
      ),
    ),
  );
  const radialAnchors = [-1, 1].flatMap((sign) => [
    cylinder(1.7, 18, [d.axisX, sign > 0 ? 28 : -46, 0], 'y'),
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const angle = ((sign * 15 + i * 60) * Math.PI) / 180;
        const radius = d.pocketAF / Math.sqrt(3);
        return [d.axisX + radius * Math.cos(angle), radius * Math.sin(angle)];
      }),
      d.pocketOuterY - d.pocketInnerY,
      sign > 0 ? d.pocketInnerY : -d.pocketOuterY,
      'y',
    ),
    // Load from the exposed power-facing side before fitting the closure.
    box(
      [
        d.axisX + 0.4 - (d.faceX - 0.1),
        d.pocketOuterY - d.pocketInnerY,
        d.mouthTopZ - d.mouthBottomZ,
      ],
      [d.faceX - 0.1, sign > 0 ? d.pocketInnerY : -d.pocketOuterY, d.mouthBottomZ],
    ),
  ]);
  return subtract(
    stock,
    foreFeatures,
    ...cableCuts(d.faceX, length),
    ...radialAnchors,
    ...tailTieY.flatMap((y) => [
      cylinder(1.7, length + tailInterface.bufferThickness + 2, [d.faceX - 1, y, 33], 'x'),
      // Open from the forward face for loading; six closed flats react torque.
      at(
        prism(
          Array.from({ length: 6 }, (_, i): [number, number] => {
            const angle = ((i + 0.5) * Math.PI) / 3;
            return [(5.8 / Math.sqrt(3)) * Math.cos(angle), (5.8 / Math.sqrt(3)) * Math.sin(angle)];
          }),
          2.9,
          0,
        ),
        [d.faceX - 0.1, y, 33],
        [0, 90, 0],
      ),
    ]),
  );
}
export function servicePayload(): ConfiguredPiece[] {
  const screwPreset = bolt.presets.find((v) => v.id === 'gvyntok-040-190-009')!;
  const washerPreset = washer.presets.find((v) => v.id === 'gvyntok-e5f58c827639')!;
  const washerThickness = Number(washerPreset.parameters.thickness);
  const underheadX = datums.tail.back + washerThickness;
  // This source DIN912 is centred on shaft length plus head height.
  const underheadFromOrigin =
    (Number(screwPreset.parameters.length) - Number(screwPreset.parameters.headHeight)) / 2;
  return tailTieY.flatMap((y, i) => [
    purchased(
      bolt,
      `tail-tie-screw-${i + 1}`,
      screwPreset.id,
      [underheadX - underheadFromOrigin, y, 33],
      [0, 90, 0],
      'default',
    ),
    purchased(
      nut,
      `tail-tie-nut-${i + 1}`,
      'gvyntok-474adfbe1cd7',
      // Seated against the blind pocket's aft reaction face after take-up.
      [datums.power.back - 9.6, y, 33],
      [0, 90, 0],
      'default',
    ),
    purchased(
      washer,
      `tail-tie-washer-${i + 1}`,
      washerPreset.id,
      [datums.tail.back + washerThickness / 2, y, 33],
      [0, 90, 0],
      'default',
    ),
  ]);
}
export const serviceWindow = {
  ...accessWindowDatums,
  face: 'bottom' as const,
};

/** Carrier tongues sit above the radial-anchor pockets and below the module keys. */
export const spoolCarrierInterface = {
  frontX: datums.spool.front + datums.discThickness,
  backX: datums.spool.back - datums.discThickness,
  keyY: [-32, 32],
  keyZ: 9,
  keyWidth: 6,
  keyHeight: 5,
  keyDepth: 4,
} as const;

function spoolCarrierSockets(faceX: number, forward: boolean, p: Parameters): Shape[] {
  const s = spoolCarrierInterface,
    fit = Number(p.keyClearance);
  return s.keyY.map((y) =>
    box(
      [s.keyDepth + 0.3, s.keyWidth + fit, s.keyHeight + fit],
      [
        forward ? faceX - s.keyDepth - 0.2 : faceX - 0.1,
        y - (s.keyWidth + fit) / 2,
        s.keyZ - (s.keyHeight + fit) / 2,
      ],
    ),
  );
}

export function servicePrinted(p: Parameters): PrintedItem[] {
  const spool = spoolCarrierInterface;
  const front = subtract(
    discShape(datums.spool.front, p),
    ...spoolCarrierSockets(spool.frontX, true, p),
  );
  // Open connector bays provide access from the wiring spool. The two upper
  // square keys retain this joint's orientation; its lower key is deliberately omitted.
  const aft = subtract(
    discShape(110, p),
    ...powerInterface.connector.centersZ.map((z) => box([16, 38, 19], [109, -19, z - 9.5])),
    box([5, 6.4, 6.4], [119.8, -3.2, -25.2]),
    ...spoolCarrierSockets(spool.backX, false, p),
  );
  const spoolRails = [-1, 1].map((s) => box([30, 10, 12], [80, s > 0 ? 27 : -37, -6]));
  const tieSlots = [-1, 1].map((s) => box([8, 12, 4], [91, s > 0 ? 26 : -38, -2]));
  const carrierEndBlocks = [spool.frontX, spool.backX - 8].flatMap((x) =>
    spool.keyY.map((y) => box([8, 10, 20.5], [x, y - 5, -6])),
  );
  const carrierTongues = [spool.frontX - spool.keyDepth, spool.backX - 0.2].flatMap((x) =>
    spool.keyY.map((y) =>
      box(
        [spool.keyDepth + 0.2, spool.keyWidth, spool.keyHeight],
        [x, y - spool.keyWidth / 2, spool.keyZ - spool.keyHeight / 2],
      ),
    ),
  );
  const couplingGaugeBottom = 4;
  const couplingGaugeHeight =
    couplingGaugeBottom + flightCouplingMount.columnTop - flightDatums.couplingBottom;
  const couplingWidth = flightCouplingMount.columnWidth;
  const coupon = subtract(
    union(
      box([42, 24, 4], [0, 0, 0]),
      box([12, 12, 12], [0, 6, 0]),
      box(
        [couplingWidth, couplingWidth, couplingGaugeHeight],
        [35 - couplingWidth / 2, 12 - couplingWidth / 2, 0],
      ),
    ),
    box(
      [4.4, 6 + Number(p.keyClearance), 6 + Number(p.keyClearance)],
      [-0.1, 9 - Number(p.keyClearance) / 2, 3 - Number(p.keyClearance) / 2],
    ),
    cylinder(1.7, 10, [25, 12, -1]),
    flightCouplingSlot(35, 12, couplingGaugeBottom),
    cylinder(1.7, couplingGaugeHeight + 2, [35, 12, -1]),
  );
  const cushion = subtract(
    cylinder(
      datums.radius,
      tailInterface.bufferThickness,
      [datums.tail.front + tailInterface.plateThickness, 0, 0],
      'x',
    ),
    ...cableCuts(datums.tail.front + tailInterface.plateThickness, tailInterface.bufferThickness),
    ...tailTieY.map((y) =>
      cylinder(
        tailInterface.postClearanceRadius,
        tailInterface.bufferThickness + 2,
        [datums.tail.front + tailInterface.plateThickness - 1, y, 33],
        'x',
      ),
    ),
  );
  return [
    {
      id: 'spool-forward-disc',
      name: 'Harness spool forward keyed disc',
      shape: front,
      material: 'PETG',
      module: 'spool',
      printRotation: [0, -90, 0],
    },
    {
      id: 'spool-aft-disc',
      name: 'Harness spool aft keyed disc',
      shape: aft,
      material: 'PETG',
      module: 'spool',
      printRotation: [0, -90, 0],
    },
    {
      id: 'spool-cable-carrier',
      name: 'Open harness spool with cable-tie passages',
      shape: subtract(
        union(
          ...spoolRails,
          ...carrierEndBlocks,
          ...carrierTongues,
          box([10, 74, 4], [91, -37, -6]),
        ),
        ...tieSlots,
      ),
      material: 'PETG',
      module: 'spool',
    },
    {
      id: 'tail-tpu-buffer',
      name: 'Replaceable TPU tail buffer',
      shape: cushion,
      material: 'TPU',
      module: 'tail',
      printRotation: [0, -90, 0],
    },
    {
      id: 'square-key-fit-coupon',
      name: 'Modular key, M3 hole and coupling seat fit coupon',
      shape: coupon,
      material: 'PETG',
      module: 'template',
    },
  ];
}

export function tubeShape(cutaway: boolean) {
  // Source DIN 7991 cone plus its short cylindrical head rim. The finished
  // head remains below the tube outside; the pilot alone is insufficient.
  const countersink: Shape = {
    kind: 'revolve',
    profile: [
      [0, tubeMounting.anchorConeBottomY],
      [tubeMounting.pilotDiameter / 2, tubeMounting.anchorConeBottomY],
      [tubeMounting.anchorHeadDiameter / 2, tubeMounting.anchorConeTopY],
      [tubeMounting.anchorHeadDiameter / 2, 51],
      [0, 51],
    ],
  };
  const headSeats = [-1, 1].flatMap((sign) => [
    ...anchorStations.map((x) => at(countersink, [x, 0, 0], [sign > 0 ? -90 : 90, 0, 0])),
    cylinder(
      tubeMounting.shellHeadDiameter / 2,
      8,
      [
        noseDatums.shellAnchorX,
        sign > 0 ? tubeMounting.shellHeadSeatY : -tubeMounting.shellHeadSeatY - 8,
        0,
      ],
      'y',
    ),
  ]);
  const tube = subtract(
    cylinder(
      tubeReferenceDatums.outerDiameter / 2,
      datums.tail.back - datums.nose.root,
      [datums.nose.root, 0, 0],
      'x',
    ),
    cylinder(
      tubeReferenceDatums.innerDiameter / 2,
      datums.tail.back - datums.nose.root + 2,
      [datums.nose.root - 1, 0, 0],
      'x',
    ),
    roundedRect(serviceWindow.length, serviceWindow.width, serviceWindow.cornerRadius, 20, 40),
    roundedRect(serviceWindow.length, serviceWindow.width, serviceWindow.cornerRadius, -60, 40),
    ...holeStations.map((x) => cylinder(tubeMounting.pilotDiameter / 2, 100, [x, -50, 0], 'y')),
    ...headSeats,
  );
  return cutaway ? intersect(tube, box([480, 100, 100], [-175, -100, -50])) : tube;
}
