import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { at, intersect, purchased, discShape, type PrintedItem } from './shared';
import { guidedOutsideShape, guidedCavityShape } from '../../rocket-camera-nose/lib/guided-profile';
import {
  guidedCameraMountEnvelope,
  guidedCameraRearPocketShape,
  guidedCameraFrontLinerShape,
  guidedCameraProfile,
  guidedCameraClocked,
} from '../../rocket-camera-nose/lib/guided-camera';
import pi, { pi5Interface } from '../../raspberry-pi/part';
import adapter from '../../waveshare-pcie-m2-d/part';
import ssd from '../../m2-ssd/part';
import gps from '../../gps-tracker/part';
import finder from '../../jhe42b-finder/part';
import camera19 from '../../board-camera-19/part';
import ov9281, { ov9281Interface } from '../../waveshare-ov9281-110/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import nyloc from '../../nyloc-nut/part';
import washer from '../../washer/part';
import metalSleeve from '../../dremec-spacer-sleeve/part';
import { cameraCsiPassage, camera19CsiRibbonGauges, noseCableTools } from './nose-cables';
import { resolveTubeProfile } from './tube-interface';
import {
  noseRetention,
  piSeatFrameStock,
  piSeatFrameTools,
  piSeatCushionShape,
  piCarrierRebateTools,
  piCarrierPadStocks,
  piCarrierReinforcementStock,
  piCarrierReinforcementCuts,
  piCarrierNutPocketTools,
  noseAuxiliaryWallGussets,
} from './nose-retention';
import {
  auxiliaryDatums,
  auxiliaryPrinted,
  auxiliaryPayload,
  auxiliaryFrameAdditions,
  auxiliaryFrameCuts,
  auxiliaryContactSpecs as auxiliaryContacts,
} from './nose-auxiliary';
export {
  noseCableGauges,
  noseCableTools,
  noseCableReserves,
  noseCableInterface,
} from './nose-cables';

export const noseLibraries: PartDefinition[] = [
  pi,
  adapter,
  ssd,
  gps,
  finder,
  camera19,
  ov9281,
  bolt,
  nut,
  nyloc,
  washer,
  metalSleeve,
];

/** Source circular-ogive construction and source-specific optical cartridges. */
export const noseDatums = {
  rootX: -100,
  tipX: -255,
  shellRearX: -80,
  moduleRearX: -70,
  pi: noseRetention.piOrigin,
  adapter: [-146, -0.25, 18.0] as Vec,
  ssd: [-148.5, 9.7, 22.0] as Vec,
  gps: auxiliaryDatums.tracker.position,
  finder: auxiliaryDatums.finder.position,
  shellAnchorX: -89,
  cameraJointX: -221,
  cameraJointY: 21.5,
  carrierBottom: -6,
  carrierTop: -3,
  piTop: -3 + pi5Interface.pcb.bounds.max[2],
  adapterBottom: 18.0,
} as const;

export const noseParameters = (p: Parameters): Parameters => {
  const tube = resolveTubeProfile(p);
  return {
    packaging: 'structural-ogive',
    cameraSetup: p.cameraSetup,
    cameraClockDegrees: p.cameraSetup === 'camera-19' ? -90 : 0,
    tubeOD: tube.outerDiameter,
    tubeID: tube.innerDiameter,
    noseLength: 153,
    shoulderLength: 20,
    wall: 3,
    shoulderClearance: tube.insertDiametralClearance,
  };
};
const fromNose = (shape: Shape) => at(shape, [noseDatums.rootX, 0, 0], [0, -90, 0]);
const fromPi = (shape: Shape) => at(shape, noseDatums.pi, [0, 0, 180]);
const cameraPortCuts = (p: Parameters): Shape[] => {
  const np = noseParameters(p);
  const original = box([18.2, 4.4, 19], [-8.1, 3.3, 112]);
  return [
    fromNose(original),
    fromNose(box([18.2, 40, 14], [-9.1, 11.9, 129])),
    ...(p.cameraSetup === 'camera-19' ? [fromNose(guidedCameraClocked(original, np))] : []),
  ];
};
const hex = (af: number, height: number, x: number, y: number, z: number): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = ((i + 0.5) * Math.PI) / 3;
      return [x + (af / Math.sqrt(3)) * Math.cos(a), y + (af / Math.sqrt(3)) * Math.sin(a)];
    }),
    height,
    z,
  );
const piHoles = pi5Interface.pcb.holes.map(({ x, y }) => ({ x: noseDatums.pi[0] - x, y: -y }));
const piUsbC = pi5Interface.packages.find(({ label }) => label === 'USB-C power')!;
const localXSection = (points: [number, number][], x: number, length: number): Shape =>
  at(prism(points, length, 0), [x, 0, 0], [90, 0, 90]);

/** Keep the actual source power port accessible; the commercial mating plug is unselected. */
function piPowerAccess(): Shape {
  const { min: lo, max: hi } = piUsbC.bounds;
  return fromPi(
    box(
      [hi[0] - lo[0] + 1, hi[1] - lo[1] + 20.5, hi[2] - lo[2] + 1],
      [lo[0] - 0.5, lo[1] - 20, lo[2] - 0.5],
    ),
  );
}

function cameraBarrel(p: Parameters): Shape {
  const np = noseParameters(p);
  const stock: Shape = {
    kind: 'revolve',
    profile: [
      [0, 121],
      [26, 121],
      [26, 137.8],
      [23.9, 140.8],
      [15.75, 149],
      [0, 149],
    ],
    segments: 96,
  };
  return fromNose(subtract(stock, guidedCameraMountEnvelope(np, 0.25)));
}

function cameraContacts(): Shape {
  const rear = [-1, 1].flatMap((sign) => [
    ...[-6, 6].map((y) => box([6, 6, 0.6], [-233, y - 3, sign > 0 ? 14.9 : -15.5])),
    box([6, 0.7, 4], [-233, -12.8, sign > 0 ? 4 : -8]),
    box([6, 0.7, 2], [-233, 17.4, sign > 0 ? 10 : -12]),
  ]);
  const r = (z: number) => 19.4 + ((z - 140.8) * (11.5 - 19.4)) / (149 - 140.8);
  const coneBand: Shape = {
    kind: 'revolve',
    profile: [
      [r(143) - 0.14, 143],
      [r(143) + 0.6, 143],
      [r(147) + 0.6, 147],
      [r(147) - 0.14, 147],
    ],
    segments: 96,
  };
  const front = [-1, 1].flatMap((zSign) =>
    [-1, 1].map((ySign) =>
      intersect(
        fromNose(coneBand),
        box([4, 6, 30], [-247, ySign > 0 ? 3 : -9, zSign > 0 ? 0 : -30]),
      ),
    ),
  );
  return union(...rear, ...front);
}

/** A dimensioned crosshead returns the clamp load around the open front FFC mouth. */
function cameraCrosshead(): Shape {
  const points: [number, number][] = [
    [15, -13],
    [24, -13],
    [28, -7],
    [28, 7],
    [24, 13],
    [15, 13],
  ];
  const half = (sign: number) =>
    at(
      prism(
        (sign > 0 ? points : [...points].reverse()).map(([y, z]): [number, number] => [
          -z,
          sign * y,
        ]),
        13,
        0,
      ),
      [noseDatums.cameraJointX - 6.5, 0, 0],
      [0, 90, 0],
    );
  return union(half(-1), half(1));
}

function cameraRearCushion(p: Parameters): Shape {
  const np = noseParameters(p),
    a = guidedCameraProfile(np);
  if (p.cameraSetup === 'ov9281') {
    const side = [-1, 1].flatMap((sign) =>
      [-6.86, 5.64].map((y) => box([0.45, 4, 1], [sign > 0 ? 12.4 : -12.85, y - 2, a.rear + 0.3])),
    );
    const ends = [-1, 1].flatMap((sign) =>
      [-10.5, 10.5].map((x) => box([2, 0.45, 1], [x - 1, sign > 0 ? 14.9 : -9.21, a.rear + 0.3])),
    );
    const backing = box(
      [30, 3.14, a.bodyFront - 0.2 - a.rearStopFront],
      [-15, -12.2, a.rearStopFront],
    );
    return subtract(
      fromNose(union(guidedCameraRearPocketShape(np), backing, ...side, ...ends)),
      cameraCsiPassage(String(p.cameraSetup)),
    );
  }
  return subtract(
    fromNose(
      union(
        guidedCameraRearPocketShape(np),
        box([30, 2.5, a.splitZ - a.rearStopFront], [-15, -12.2, a.rearStopFront]),
        ...[-1, 1].flatMap((sign) => [
          box([0.45, 6, 3], [sign > 0 ? 9.4 : -9.85, -3, a.rear + 2]),
          box([6, 0.45, 3], [-3, sign > 0 ? 9.4 : -9.85, a.rear + 2]),
        ]),
      ),
    ),
    camera19CsiRibbonGauges().find((item) => item.id === 'camera-19-csi-clearance')!.shape,
    ...cameraPortCuts(p),
  );
}

function cameraFrontCushion(p: Parameters): Shape {
  const np = noseParameters(p),
    a = guidedCameraProfile(np);
  if (p.cameraSetup !== 'ov9281') return fromNose(guidedCameraFrontLinerShape(np));
  const relieved = subtract(
    guidedCameraFrontLinerShape(np),
    box([25.4, 24.26, 0.2], [-12.7, -9.06, a.bodyFront]),
  );
  const buttons = ov9281Interface.mountingHoles.map(({ x, y }) =>
    cylinder(1.5, 0.5, [-x, -y, a.bodyFront - 0.1]),
  );
  return subtract(fromNose(union(relieved, ...buttons)), cameraCsiPassage(String(p.cameraSetup)));
}

function cameraFrameComplete(p: Parameters): Shape {
  const np = noseParameters(p);
  const rearCheeks: Shape[] = [
    box([10.5, 26, 6], [noseDatums.cameraJointX - 4, -9, -21]),
    ...[-1, 1].map((sign): Shape => ({
      kind: 'prism',
      axis: 'y',
      depth: 6,
      origin: sign > 0 ? 12 : -18,
      points: [
        [-214.5, 7],
        [-214.5, 13],
        [-223, 21],
        [-225, 21],
        [-225, 15],
      ],
    })),
  ];
  const portCuts = cameraPortCuts(p);
  return union(
    subtract(
      union(cameraBarrel(p), cameraCrosshead(), ...rearCheeks),
      fromNose(guidedCameraMountEnvelope(np, 0.25)),
      ...portCuts,
      cameraCsiPassage(String(p.cameraSetup)),
    ),
    cameraContacts(),
  );
}

function cameraOuterClearance(p: Parameters): Shape {
  const cavity = guidedCavityShape(noseParameters(p));
  if (cavity.kind !== 'revolve')
    throw new Error('The source nose cavity must retain its analytic meridian.');
  return fromNose({
    ...cavity,
    profile: cavity.profile.map(([r, z]) => [Math.max(0, r - 0.3), z]),
  });
}

function cameraJointCuts(): Shape[] {
  return [-noseDatums.cameraJointY, noseDatums.cameraJointY].flatMap((y) => [
    cylinder(1.7, 25, [noseDatums.cameraJointX, y, -9.5]),
    hex(5.8, 2.8, noseDatums.cameraJointX, y, -5.3),
    box([9, 10, 2.8], [noseDatums.cameraJointX - 4.5, y > 0 ? y : y - 10, -5.3]),
  ]);
}

function shellAnchorCuts(): Shape[] {
  return [-1, 1].flatMap((sign) => [
    cylinder(1.7, 20, [noseDatums.shellAnchorX, sign > 0 ? 27 : -47, 0], 'y'),
    at(hex(5.8, 2.8, 0, 0, 0), [noseDatums.shellAnchorX, sign * 34.4, 0], [-sign * 90, 0, 0]),
    box([6.4, 2.8, 10], [noseDatums.shellAnchorX - 3.2, sign > 0 ? 34.4 : -37.2, 0]),
  ]);
}

/** Local curved bearing surfaces carry the shell clamp load without bending a
 * 0.3 mm free gap. Axial lead-outs preserve forward fairing withdrawal. */
function shellBearingLands(): Shape {
  const radial: Shape = {
    kind: 'revolve',
    profile: [
      [0, 0],
      [40.1, 0],
      [40.4, 1.5],
      [40.4, 10.5],
      [40.1, 12],
      [0, 12],
    ],
    segments: 128,
  };
  return subtract(
    intersect(
      at(radial, [noseDatums.shellAnchorX - 6, 0, 0], [0, 90, 0]),
      union(
        ...[-1, 1].map((sign) =>
          box([12, 4, 11], [noseDatums.shellAnchorX - 6, sign > 0 ? 37 : -41, -6]),
        ),
      ),
    ),
    ...shellAnchorCuts(),
  );
}

/** Whole shell pulls forward after its two radial bolts are removed. */
function shell(p: Parameters): Shape {
  const np = noseParameters(p);
  return subtract(
    fromNose(subtract(guidedOutsideShape(np), guidedCavityShape(np))),
    ...shellAnchorCuts(),
    ...[-1, 1].map((sign) =>
      cylinder(3.1, 8, [noseDatums.shellAnchorX, sign > 0 ? 44.5 : -52.5, 0], 'y'),
    ),
  );
}

function skeletonBase(p: Parameters): Shape {
  const barrelBottom = intersect(cameraFrameComplete(p), box([200, 100, 50], [-265, -50, -50]));
  const rails = [-1, 1].map((sign): Shape => ({
    kind: 'prism',
    axis: 'y',
    depth: 6,
    origin: sign > 0 ? 13.5 : -19.5,
    points: [
      [-83, -21.5],
      [-83, -13],
      [-219.75, -13],
      [-224, -17.25],
      [-227, -17.25],
      [-227, -21.5],
    ],
  }));
  // A continuous floor joins the short bare rail bay with 0.2 mm volumetric
  // overlap under both ribs; the tracker can still lift through its open top.
  const forwardRailFloor = box([21.2, 39, 3], [-214.5, -19.5, -24.3]);
  // This root lap is contained in the floor/auxiliary end wall union. It makes
  // both Boolean joins volumetric without changing the finished outer solid.
  const forwardFloorRootLap = box([0.4, 32, 3], [-193.5, -16, -24.3]);
  const coreRails = piSeatFrameStock();
  const bridges = [
    box([6.6, 66, 3], [-178.6, -33, -14]),
    ...[-166.5, -102].map((x) => box([6, 74.6, 3], [x, -37.3, -14])),
    ...[
      [-178.6, 6.6],
      [-166.5, 6],
      [-102, 6],
    ].flatMap(([x, width]) =>
      [-1, 1].map((sign) => box([width, 6, 6], [x, sign > 0 ? 13.5 : -19.5, -17])),
    ),
    box([3, 74.6, 11], [-95.2, -37.3, -14]),
  ];
  // Empty-bed flex and upright tongues have an open entry; the sourcePCB stays
  // at least0.63mm above the fore rigid stop at its actual overhang.
  const cushionStops = [box([3, 66, 10.4], [-181.3, -33, -14])];
  const rearFrame = union(
    box([6, 58, 12], [-86, -29, -25]),
    ...[-1, 1].map((sign) => box([6, 6, 44], [-86, sign > 0 ? 23 : -29, -25])),
    ...[
      [-26, 18],
      [26, 18],
      [0, -22],
    ].map(([y, z]) => box([4.2, 6, 6], [-80.2, y - 3, z - 3])),
  );
  const anchors = [-1, 1].map((sign) =>
    union(
      box([12, 19.1, 11], [noseDatums.shellAnchorX - 6, sign > 0 ? 21 : -40.1, -6]),
      box([12, 18, 16], [noseDatums.shellAnchorX - 6, sign > 0 ? 19 : -37, -18]),
    ),
  );
  const auxShelf = union(
    box([94, 36, 3], [-193, -18, -30.3]),
    ...noseAuxiliaryWallGussets(),
    ...[-1, 1].map((sign) =>
      // The narrow bolted trays no longer need an inward retaining flange.
      // Keep the full wall and its overlap with the primary lower rail.
      box([94, 3, 6.3], [-193, sign > 0 ? 16.3 : -19.3, -27.3]),
    ),
    ...[-193.3, -101.7].map((x) => box([3, 32, 6.3], [x, -16, -27.3])),
  );
  const auxPosts = [-186, -114].flatMap((x) =>
    [-1, 1].map((sign) => box([5, 5, 17.3], [x, sign > 0 ? 16.3 : -21.3, -30.3])),
  );
  return union(
    intersect(
      subtract(
        union(
          barrelBottom,
          ...rails,
          forwardRailFloor,
          forwardFloorRootLap,
          ...coreRails,
          ...bridges,
          ...cushionStops,
          rearFrame,
          ...anchors,
          auxShelf,
          ...auxPosts,
          ...auxiliaryFrameAdditions(),
        ),
        ...cameraJointCuts(),
        ...shellAnchorCuts(),
        ...piSeatFrameTools(),
        ...auxiliaryFrameCuts(),
        // Direct vertical entry for both 25.4 mm trays, before the Pi bed loads.
        box([91, 27, 23], [-190, -13.5, -21.3]),
        ...noseCableTools(),
        piPowerAccess(),
        subtract(box([123, 110, 110], [-213, -55, -55]), cameraOuterClearance(p)),
      ),
      cylinder(40.1, 190, [-260, 0, 0], 'x'),
    ),
    shellBearingLands(),
  );
}

function cameraKeeper(p: Parameters): Shape {
  const upper = intersect(cameraFrameComplete(p), box([200, 100, 50], [-265, -50, 0]));
  return subtract(
    upper,
    ...cameraJointCuts(),
    ...[-noseDatums.cameraJointY, noseDatums.cameraJointY].map((y) =>
      cylinder(3.1, 30, [noseDatums.cameraJointX, y, 7]),
    ),
  );
}

/** One hard insert limits the four bolt stacks and backs the wider soft keys. */
function piCarrier(): Shape {
  const holes = piHoles;
  const stock = union(
    ...[-1, 1].map((sign) => box([73, 7, 3], [-172, sign > 0 ? 27 : -34, -6])),
    ...[-172, -103].map((x) => box([4, 68, 3], [x, -34, -6])),
    ...piCarrierPadStocks(),
    ...piCarrierReinforcementStock(),
    ...holes.map(({ x, y }) => cylinder(2.8, 3.03, [x, y, -6])),
  );
  const packageReliefs = pi5Interface.packages
    .filter((pkg) => pkg.bounds.min[2] < 0.03)
    .map((pkg) => {
      const lo = pkg.bounds.min,
        hi = pkg.bounds.max;
      return fromPi(
        box([hi[0] - lo[0] + 0.6, hi[1] - lo[1] + 0.6, 6], [lo[0] - 0.3, lo[1] - 0.3, -3.1]),
      );
    });
  return subtract(
    stock,
    ...piCarrierRebateTools(),
    ...piCarrierReinforcementCuts(),
    ...piCarrierNutPocketTools(),
    ...holes.map(({ x, y }) => cylinder(1.4, 10, [x, y, -10])),
    ...packageReliefs,
  );
}
function piCushion(free = false): Shape {
  return subtract(piSeatCushionShape(free), piPowerAccess());
}

/** Bolted trays keep the user-accepted device clearances; no source-device preload is assumed. */
export function auxiliaryContactSpecs() {
  return auxiliaryContacts();
}

export function nosePrinted(p: Parameters): PrintedItem[] {
  return [
    {
      id: 'nose-shell',
      name: 'Removable analytic ogive and insertion shoulder',
      shape: shell(p),
      material: 'PETG',
      module: 'nose',
      printRotation: [0, 90, 0],
    },
    {
      id: 'nose-base-frame',
      name: 'Nose rigid frame and lower camera shoe',
      shape: skeletonBase(p),
      material: 'PETG',
      module: 'nose',
      printRotation: [0, 0, 0],
    },
    {
      id: 'nose-camera-keeper',
      name: 'Removable rigid upper camera keeper',
      shape: cameraKeeper(p),
      material: 'PETG',
      module: 'nose',
      printRotation: [0, 0, 0],
    },
    {
      id: 'nose-aft-disc',
      name: 'Nose aft modular keyed disc',
      shape: discShape(-80, p, true, noseCableTools()),
      material: 'PETG',
      module: 'nose',
      printRotation: [0, -90, 0],
    },
    {
      id: 'nose-pi-cushion',
      name: 'Groove-captured TPU Pi frame with integral mounting eyes',
      shape: piCushion(),
      printShape: piCushion(true),
      material: 'TPU',
      module: 'nose',
    },
    {
      id: 'nose-pi-carrier',
      name: 'Rigid Pi stack insert and hard mounting stops',
      shape: piCarrier(),
      material: 'PETG',
      module: 'nose',
      printRotation: [180, 0, 0],
    },
    ...auxiliaryPrinted(),
    {
      id: 'nose-nvme-pad',
      name: 'Captured TPU NVMe underside support pad',
      shape: fromPi(
        subtract(
          box([24, 18, 2.4], [-10, -18.7, 22.6]),
          ...[-7.5, 4.5].map((x) => cylinder(3.3, 4.4, [x, -9.7, 21.6])),
        ),
      ),
      material: 'TPU',
      module: 'nose',
    },
    {
      id: `nose-camera-${p.cameraSetup}-rear`,
      name: 'Source-specific camera TPU rear cradle',
      shape: cameraRearCushion(p),
      material: 'TPU',
      module: 'nose',
      printRotation: [0, 90, 0],
      previewBackend: p.cameraSetup === 'camera-19' ? 'jscad' : 'manifold',
    },
    {
      id: `nose-camera-${p.cameraSetup}-front`,
      name: 'Source-specific camera TPU front liner',
      shape: cameraFrontCushion(p),
      material: 'TPU',
      module: 'nose',
      printRotation: [0, -90, 0],
    },
  ];
}

export function nosePayload(p: Parameters): ConfiguredPiece[] {
  const np = noseParameters(p),
    optics = guidedCameraProfile(np);
  const result = [
    purchased(pi, 'pi-5', 'raspberry-pi-5', noseDatums.pi, [0, 0, 180]),
    purchased(adapter, 'pi-nvme-adapter', 'pcie-m2-d', noseDatums.adapter, [0, 0, 0], 'default'),
    purchased(ssd, 'pi-nvme-2280', '2280-reference', noseDatums.ssd, [0, 0, 0], 'default'),
    ...auxiliaryPayload(),
    ...piHoles.map(({ x, y }, i): ConfiguredPiece => ({
      component: {
        id: `nose-pi-compression-sleeve-${i + 1}`,
        name: `Custom aluminium Pi to adapter sleeve ${i + 1}`,
        libraryId: metalSleeve.id,
        parameters: {
          ...metalSleeve.defaults,
          material: 'aluminium',
          outerDiameter: 5.6,
          bore: 2.8,
          length: noseDatums.adapterBottom - noseDatums.piTop,
        },
        state: 'default',
        quantity: 1,
        supply: 'purchased',
        placement: { translation: [x, y, noseDatums.piTop], rotation: [0, 0, 0] },
        procurement: {
          name: '\u0414\u0438\u0441\u0442\u0430\u043d\u0446\u0456\u0439\u043d\u0456 \u0432\u0442\u0443\u043b\u043a\u0438 (spacer sleeves) \u2014 \u0430\u043b\u044e\u043c\u0456\u043d\u0456\u0439, \u0431\u0435\u0437 \u043f\u043e\u043a\u0440\u0438\u0442\u0442\u044f',
          designation: `DREMEC DH aluminium — customer drawing Ø5.6 / Ø2.8 ×${(noseDatums.adapterBottom - noseDatums.piTop).toFixed(3)} mm`,
          manufacturer: 'DREMEC',
          source: 'https://dremec.ua/product/spacer-sleeves-alu/',
        },
        notes:
          'Customer-requested nominal dimensions within the supplier custom-order range. No stock SKU, availability, manufacturing tolerance, edge-break or order acceptance is asserted.',
      },
      label: `Custom aluminium compression sleeve ${i + 1}`,
      color: 0xbfc5cc,
      preserveLibraryAppearance: true,
    })),
    purchased(
      p.cameraSetup === 'ov9281' ? ov9281 : camera19,
      'nose-camera',
      optics.presetId,
      [noseDatums.rootX - optics.rear, 0, 0],
      // Placement uses ZYX Euler order: this equals Ry(-90) · Rz(-90),
      // retaining optical -X while the camera's original top turns to +Z.
      p.cameraSetup === 'ov9281' ? [180, 90, 0] : [90, 0, -90],
      'default',
    ),
    ...piHoles.flatMap(({ x, y }, i) => [
      purchased(
        bolt,
        `pi-stack-screw-${i + 1}`,
        'gvyntok-040-220-039',
        [x, y, 5.85],
        [0, 0, 0],
        'default',
      ),
      purchased(
        nyloc,
        `pi-stack-nut-${i + 1}`,
        'tr-tr00000407-000',
        [x, y, -6],
        [180, 0, 0],
        'default',
      ),
    ]),
    ...[-noseDatums.cameraJointY, noseDatums.cameraJointY].flatMap((y, i) => [
      purchased(
        bolt,
        `camera-keeper-screw-${i + 1}`,
        'gvyntok-040-190-007',
        [noseDatums.cameraJointX, y, 0.5],
        [0, 0, 0],
        'default',
      ),
      purchased(
        nut,
        `camera-keeper-nut-${i + 1}`,
        'gvyntok-474adfbe1cd7',
        [noseDatums.cameraJointX, y, -4.9],
        [0, 0, 0],
        'default',
      ),
    ]),
    purchased(
      bolt,
      'nvme-end-screw',
      'gvyntok-040-200-001',
      [-188.5, 9.7, 22.8],
      [0, 0, 0],
      'default',
    ),
    purchased(
      washer,
      'nvme-end-washer',
      'gvyntok-1a0b123a60d0',
      [-188.5, 9.7, 23.15],
      [0, 0, 0],
      'default',
    ),
    ...[-1, 1].flatMap((sign, i) => [
      purchased(
        bolt,
        `nose-shell-screw-${i + 1}`,
        'gvyntok-040-190-006',
        [noseDatums.shellAnchorX, sign * 40, 0],
        [-sign * 90, 0, 0],
        'default',
      ),
      purchased(
        nut,
        `nose-shell-nut-${i + 1}`,
        'gvyntok-474adfbe1cd7',
        [noseDatums.shellAnchorX, sign * 34.8, 0],
        [-sign * 90, 0, 0],
        'default',
      ),
    ]),
  ];
  return result;
}

/** Authored 20 mm frontal / 10 mm USB-C allowances; actual mating plugs are unselected. */
export function nosePortServiceReserves() {
  const frontal = pi5Interface.packages
    .filter(({ label }) => /USB-A|Ethernet/.test(label))
    .map(({ label, bounds: { min: lo, max: hi } }) => ({
      label,
      direction: [-1, 0, 0] as Vec,
      shape: box(
        [20, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1],
        [noseDatums.pi[0] - hi[0] - 20, -hi[1] - 0.5, noseDatums.pi[2] + lo[2] - 0.5],
      ),
    }));
  const { min: lo, max: hi } = piUsbC.bounds;
  return [
    ...frontal,
    {
      label: 'USB-C power · authored 10 mm mating allowance, commercial plug unselected',
      direction: [0, 1, 0] as Vec,
      shape: box(
        [hi[0] - lo[0] + 1, 10, hi[2] - lo[2] + 1],
        [noseDatums.pi[0] - hi[0] - 0.5, -lo[1], noseDatums.pi[2] + lo[2] - 0.5],
      ),
    },
  ];
}

/** Bounded compliant intersections; no unrelated TPU contact is exempted. */
export function cameraContactSpecs(p: Parameters) {
  const rear = `nose-camera-${p.cameraSetup}-rear`,
    front = `nose-camera-${p.cameraSetup}-front`;
  const specs = [
    {
      ids: ['nose-base-frame', rear],
      expectedVolume: 10.8,
      maximumVolume: 10.81,
      interference: 0.1,
      direction: 'Rear cradle flat lands; normal Y/Z',
    },
    {
      ids: ['nose-camera-keeper', rear],
      expectedVolume: 10.8,
      maximumVolume: 10.81,
      interference: 0.1,
      direction: 'Rear cradle flat lands; normal Y/Z',
    },
    {
      ids: ['nose-base-frame', front],
      expectedVolume: 7.41404857751,
      maximumVolume: 7.43,
      interference: 0.14,
      direction: 'Radial front-cone interference; approximately 0.101 mm normal to the cone',
    },
    {
      ids: ['nose-camera-keeper', front],
      expectedVolume: 7.41404857751,
      maximumVolume: 7.43,
      interference: 0.14,
      direction: 'Radial front-cone interference; approximately 0.101 mm normal to the cone',
    },
    {
      ids: [rear, 'nose-camera'],
      expectedVolume: p.cameraSetup === 'ov9281' ? 2.4 : 7.2,
      maximumVolume: p.cameraSetup === 'ov9281' ? 2.41 : 7.21,
      interference: 0.1,
      direction:
        p.cameraSetup === 'ov9281'
          ? 'Bare PCB outboard edge contacts'
          : 'Housing side contacts, clear of the side mounting bores',
    },
  ];
  if (p.cameraSetup === 'ov9281')
    specs.push({
      ids: [front, 'nose-camera'],
      expectedVolume: 1.30690254389,
      maximumVolume: 1.32,
      interference: 0.1,
      direction:
        'Four front PCB mounting annuli; solid D3 contact buttons, no lens or connector load',
    });
  return specs;
}

/** Only these measured, source-local compliant contacts are intentional. */
export function piContactSpecs() {
  return [
    {
      ids: ['nose-base-frame', 'nose-pi-cushion'],
      expectedVolume: 23.2195959472,
      maximumVolume: 23.24,
      interference: 0.1,
      direction:
        'Four short matched-bevel and side contacts plus axial end lands; the main groove body retains fitting clearance.',
    },
    {
      ids: ['nose-pi-cushion', 'nose-pi-carrier'],
      expectedVolume: 17.34,
      maximumVolume: 17.36,
      interference: 0.1,
      direction:
        'Six short rigid carrier feet add 0.1 mm take-up on the original fully backed TPU floors; original lower, side and end contacts remain.',
    },
    {
      ids: ['nose-pi-cushion', 'pi-5'],
      expectedVolume: 3.79812116154,
      maximumVolume: 3.82,
      interference: 0.1,
      direction:
        'Four small 6 x 1.8 mm inboard take-up lands on the actual PCB underside beside its standard mounting holes; bulk eyelets have 0.13 mm clearance and do not carry serial bolt preload.',
    },
  ];
}

export const cameraSupportEngineering = {
  baselineRail: { width: 5, height: 5, area: 25, verticalSecondMoment: (5 * 5 ** 3) / 12 },
  reinforcedRail: { width: 6, height: 8.5, area: 51, verticalSecondMoment: (6 * 8.5 ** 3) / 12 },
  cameraEndRoot: {
    width: 6,
    minimumHeight: 4.25,
    transition: '45 degree rise to the 8.5 mm deep rail',
  },
  rearCheekThickness: 6,
  lowerRearCheekAxialLength: 10.5,
  rearTie: { height: 12, axialRibOverlap: 3, fullRibJointArea: 51 },
  minimumBodyWallAfterFittingClearance: 4.15,
  minimumShroudWallAfterFittingClearance: 4,
  minimumCounterboreLand: 3.4,
  keeperHardStopGap: 0,
  scope:
    'Local section comparison at equal material, span and orientation; root geometry, clamp force, print anisotropy and actual loads still require qualification.',
} as const;

export const noseReviewNotes = [
  'The complete nose module is 185 mm long. Its 175 mm shell uses the source analytic circular-ogive construction and interchangeable two-piece source camera cartridges; no original UPS or cells are carried in this module.',
  'The Pi is rotated 180 degrees about Z so its source USB-A and Ethernet mating faces point toward the camera at global -X. All Pi, adapter, SSD, tracker and finder source solids lie ahead of the tube root at X-100. The nearest Pi port face is X-191.55, leaving at least 21.45 mm to the camera-support region ending at X-213; 20 mm service stubs are authored reserves, not selected mating-plug dimensions.',
  'Print the 173 mm rigid frame flat on its broad auxiliary shelf with a brim and automatic local supports, keeping its longitudinal ribs in the layer plane. Recheck the reinforced front channel with the final slicing process; no physical print qualification is asserted. Print the front TPU camera liners optical-ring down. All per-part dimensions fit the 256 mm build volume.',
  'The Pi and NVMe stack uses one rigid insert inside the original wider TPU frame. Four original M2.5 stack bolts close the four TPU mounting eyes under the actual PCB mounting lands. The central 5.6 mm hard bosses reach the source PCB underside at Z-2.97 and bear directly to the existing nuts at Z-6; TPU is outside that serial clamp path. The original 12 mm-wide pads and R6 rebates fit the unchanged printed TPU. Six short rigid feet take up its backed floors by 0.1 mm. Broad 3 mm-deep axial returns and 3.7 mm-wide inner ties bypass the removed feathered margins; the rear source keepout is fully open between its two arms. The PCB is a local mounting cap, not a brace against the fixed frame.',
  'The empty TPU frame seats in double 45-degree PETG grooves before the four nuts and bare rigid insert are loaded. The rigid insert backs the wider soft keys; four integral closed eyes fold into its open recesses, then the Pi and original four bolts lock the assembly. There are no external keeper bars, separate upper liners or extra Pi fasteners. Keys are interrupted around the source USB-C service zone, retain 1.7 mm nominal engagement and have short backed take-up lands. The unchanged fairing has approximately 0.299 mm minimum clearance to the wider frame body, apart from its deliberate clamp-bearing contacts.',
  'The TPU frame has two physical geometry forms of the same manufactured part: upright eyes for printing and folded eyes after assembly. Their neutral bend length is conserved and native material volumes agree. Four 1.4 mm-thick tongues use a 6 mm neutral bend radius; the 11.7 percent outer-fibre strain estimate is geometric only. The closed 6.2 mm eyelets clear the 5.6 mm hard bosses through the folding path. Print the neutral form, not the folded inspection shape. Empty-frame seating requires reversible local TPU flex; actual 95A insertion force, recovery, creep and vibration damping remain prototype checks.',
  'Four DREMEC DH aluminium sleeves use customer-requested 19.694 mm length, 5.6 mm OD and 2.8 mm ID. They replace the thin printed tubes without moving either PCB. This is a custom-order supplier execution, not a stock SKU or availability claim; agree end finish, bore, matched length and clamp torque with the supplier. The published length tolerance is not a qualification of PCB flatness or clamp load.',
  'Camera load path: source camera contacts to formed TPU, supported rear-flat and front-cone lands, 4.15 mm PETG body / 4 mm shroud, 6 mm rear cheeks, two 6 x 8.5 mm lower ribs, auxiliary shelf and aft keyed frame. The short camera-end root is 6 x 4.25 mm before its 45 degree rise. The main rail second moment increases from 52.08 to 307.06 mm4 per rail; this is a local geometric comparison, not a shock rating.',
  'The two M3 x 16 camera clamps close against Z0 hard stops at X-221 and Y+/-21.5. Rear flat lands have 0.1 mm normal TPU preload; front-cone lands have 0.14 mm radial interference, approximately 0.101 mm normal compression. Flat contacts resist transverse motion and roll; the rear shoe and preloaded front taper provide opposing axial stops.',
  'The measured IMX577 objective has a 14.8 mm front and 16 x 5 mm lower collar within its unchanged 15 mm projection. The front TPU opening is 14.9 mm and the collar relief 16.2 mm. Viewed directly into the lens, the source camera turns 90 degrees clockwise; the rear source latch and upper keeper passage turn with it. The source body guides and camera cage joint retain their established datums.',
  'Camera-specific TPU contacts add 0.1 mm housing preload for the 19 mm model. OV contacts only the outboard PCB edges and four D3 mounting-annulus buttons, with 0.2 mm relief over the remaining front PCB face; the lens and FFC housing carry no new clamping load. D3 contact size and safe lands remain authored fitting assumptions requiring physical inspection, not supplier pad dimensions.',
  'The camera cradle has continuous backing within the fairing envelope; Pi connector access remains in the separate compute bay. The front FFC opening runs through the whole positive-Y stock; no 0.1 mm outer cap remains. A 3 mm-wide native circular rear passage joins the OV FFC opening to a high approach at Y8. Its minimum 2.5 mm separation from the six-millimetre upper cheek preserves that load path. Actual cable end shoulders, transition position, contact face, insertion and strain relief remain installation qualification work.',
  'Each M3 x 12 radial shell bolt at X-89 engages a source M3 nut seated at |Y|34.8..37.2. A broad closed outer wall transfers the nut bearing load to local R40.4 curved lands on the actual fairing bore; axial lead-outs preserve fairing withdrawal. Load nuts upward with the fairing and bolts removed. The shoulder retains 0.2 mm nominal radial tube clearance; printed fit, clamp force and tube deformation require qualification.',
  'Release the two radial shell bolts at X-89 and pull the fairing forward. The Pi and auxiliary electronics are now outside the tube and exposed. Remove the two camera keeper screws before opening the two-piece TPU camera cartridge. Release the aft-disc tube anchors and withdraw the keyed module when underside or isolation-raft service is required; do not pry on populated PCBs.',
  'For camera service, disconnect the loose lead, open the camera keeper and lift the two-piece TPU cartridge. For Pi service, disconnect the cables, remove the original four top-entry stack bolts and lift the HAT, spacers and Pi; unfold the eyes, then lift the bare carrier and empty TPU frame. The stack bolts are assembly keys, so the earlier complete rigid-island lift-out procedure does not apply. During assembly, hold the Pi against its hard bosses until the first two diagonal bolts have started; the captive metal nut cages provide counterhold.',
  auxiliaryDatums.assembly,
  'The finder uses a flat open case between the camera and Pi, rotated across the tube so sound and controls face the accessible sides. The tracker uses a plain open TPU case under the Pi. Both cases have positive D-shaped floor keys, M3 x 12 mounting screws and broad washers; source-device clearances and thin removable tape are intentional. The finder screw enters from below before the camera is fitted; the tracker screw is reached from above before the Pi is fitted. There is no unsupported top roof or thick tie across the Pi plug reserve.',
  'Two independent 6 mm harness gauges run from the shared side ports at X-70, Y+/-37.3, Z-10 through 20 mm-long opposed circular transitions to Y+/-30.5, Z-17.5, then forward to X-175. Matching 7 mm nominal cutters and outward mouths accept bare leads before closure. The minimum centerline bend radius is 12.409 mm; actual wire insulation, conductor mix and permissible bend radius remain unspecified. The positive-Y Pi power-port opening follows its source X/Z envelope plus 0.5 mm; a 10 mm mating allowance fits the fairing, but no commercial USB-C plug or GPIO housing is selected.',
  'Pi package/connector surfaces retain the library source geometry. Adapter mounting offsets and populated height, SSD envelope, auxiliary contact lands and 19 mm camera subfeatures remain installation references.',
  'The generic 2280 SSD has a separate M2 x 3 screw and washer at the existing outer blind fixing boss. Nominal modeled engagement is 1.7 mm without penetrating the PCB. Actual boss thread, seating depth and tightening limit remain unresolved; the source reference does not certify a threaded mounting interface. The broad 2.4 mm TPU pad fills the modeled underside gap between the intermediate fixing bosses; actual underside components, thermal behavior and contact pressure require the selected SSD revision.',
  'The tracker and finder seats use the selected complete library executions with the user-accepted device clearances; optional tape can take up those gaps. Acoustic, cancel-switch, SIM and loose-plug access must remain open.',
  'No cooling hardware, power wiring or ribbon cable is inferred. Verify the selected PCIe lead and a sufficiently long Pi5-compatible camera lead with both ribbon edges, insertion lengths and bend radii before fabrication.',
  'Rear-disc keys locate the frame. Recovery forces require an independent metal/tube load path; the printed nose frame is not a qualified parachute attachment.',
];
