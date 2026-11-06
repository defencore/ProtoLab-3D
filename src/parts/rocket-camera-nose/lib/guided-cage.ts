import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import {
  guidedDatums,
  guidedLayout,
  guidedGpioReserve,
  guidedGpioServiceOpening,
  guidedEthernetReserve,
  piPackageClearances,
  worldPoint,
  at,
} from './guided-layout';
import { guidedPowerFrameClearance } from './guided-power';
import { guidedNoseProfile } from './guided-profile';
import { guidedCameraMountEnvelope, guidedCameraRearStopShape } from './guided-camera';
import { guidedCsiMountingReserves, guidedPcieReserve } from './guided-routing';
import { guidedSupportBackplate, guidedSupportGroove } from './guided-supports';
import {
  upsPlugReserves,
  powerCarrierShape,
  adapterCushionShape,
  cellCoverShape,
} from './guided-geometry';
import { pi5Interface } from '../../raspberry-pi/part';

const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const acrossX = (points: [number, number][], x: number, length: number): Shape =>
  at(
    prism(
      points.map(([y, z]) => [-z, y] as [number, number]),
      length,
      0,
    ),
    { translation: [x, 0, 0], rotation: [0, 90, 0] },
  );
const hexX = (across: number, x: number, length: number, y: number, z: number): Shape =>
  acrossX(
    Array.from(
      { length: 6 },
      (_, i) =>
        [
          y + (across / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3),
          z + (across / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3),
        ] as [number, number],
    ),
    x,
    length,
  );

/** Purchased board placements remain in guided-layout; these are authored cage interfaces. */
export function guidedCageDatums(p: Parameters) {
  const rear = -n(p, 'shoulderLength');
  return {
    rear,
    baseBackX: -28,
    baseInnerX: -20.5,
    coverBackX: 26.5,
    coverFrontX: 30.5,
    piLowerX: guidedDatums.pi.translation[0] - pi5Interface.pcb.bounds.max[2],
    piUpperX: guidedDatums.pi.translation[0] - pi5Interface.pcb.bounds.min[2],
    piPressureBackX: 7.5,
    plateRear: rear + 2.5,
    plateFront: rear + 5.5,
    plateRadius: 35.5,
    frontJoint: {
      id: 'cage-joint-front',
      y: 14,
      z: n(p, 'noseLength') - 40,
      bearingX: -21.6,
      nutX: 20,
      diameter: 4,
      length: 45,
    },
    rearJoint: {
      id: 'cage-joint-rear',
      y: 34.5,
      z: rear + 13,
      bearingX: -9,
      nutX: 8,
      diameter: 4,
      length: 20,
    },
  };
}
export function guidedCageJointSpecs(p: Parameters) {
  const a = guidedCageDatums(p);
  return [a.rearJoint, a.frontJoint].map((j) => ({
    ...j,
    axis: '-x' as const,
    nutId: j.id + '-nut',
    headRecessRadius: 4.1,
    headRecessDepth: 2.4,
  }));
}

/** Actual circular cavity, reduced by the existing 0.6 mm radial running allowance. */
export function guidedCageEnvelopeShape(p: Parameters): Shape {
  const a = guidedCageDatums(p),
    profile = guidedNoseProfile(p);
  const end = n(p, 'noseLength') - 5,
    clearance = 0.6,
    maximum = 39.9;
  const clampAngle = Math.acos(
    Math.max(
      -1,
      Math.min(1, (maximum + clearance - profile.mainCenter[0]) / profile.innerMainRadius),
    ),
  );
  const clampZ = profile.rootZ + profile.innerMainRadius * Math.sin(clampAngle);
  const mainEnd =
    end < profile.innerTangent[1]
      ? Math.asin((end - profile.rootZ) / profile.innerMainRadius)
      : profile.tangentAngle;
  const arc = (
    center: [number, number],
    radius: number,
    from: number,
    to: number,
  ): [number, number][] =>
    Array.from({ length: 65 }, (_, i) => {
      const angle = from + ((to - from) * i) / 64;
      return [
        center[0] + radius * Math.cos(angle) - clearance,
        center[1] + radius * Math.sin(angle),
      ];
    });
  const stations: [number, number][] = [
    [0, a.rear],
    [maximum, a.rear],
    [maximum, Math.min(end, clampZ)],
    ...(end > clampZ ? arc(profile.mainCenter, profile.innerMainRadius, clampAngle, mainEnd) : []),
    ...(end > profile.innerTangent[1]
      ? arc(
          profile.capCenter,
          profile.innerCapRadius,
          profile.tangentAngle,
          Math.asin((end - profile.capCenter[1]) / profile.innerCapRadius),
        )
      : []),
    [0, end],
  ];
  return { kind: 'revolve', segments: 96, profile: stations };
}

function cableCuts(p: Parameters): Shape[] {
  const a = guidedCageDatums(p);
  return [
    guidedPowerFrameClearance(p),
    guidedGpioServiceOpening(),
    ...guidedCsiMountingReserves(p),
    guidedPcieReserve(p),
    guidedGpioReserve(),
    box(
      [18, 20, n(p, 'noseLength') + 20],
      [guidedDatums.pi.translation[0] - 17, -29.75, guidedDatums.pi.translation[2] + 45.55],
    ),
    ...upsPlugReserves(),
    cylinder(2, 55, [-25, 28.5, 22], 'x'),
    cylinder(4, 8, [20, -12, a.rear - 1]),
    cylinder(4, 8, [20, 12, a.rear - 1]),
  ];
}
export function guidedCageRearPlateShape(p: Parameters): Shape {
  const a = guidedCageDatums(p);
  return subtract(
    cylinder(a.plateRadius, 3, [0, 0, a.plateRear]),
    cylinder(4, 4, [20, -12, a.plateRear - 0.5]),
    cylinder(4, 4, [20, 12, a.plateRear - 0.5]),
  );
}
/** Exact captured plate envelope, with prototype per-side/axial running clearance. */
export function guidedCageRearPlateClearance(p: Parameters): Shape {
  const a = guidedCageDatums(p);
  return cylinder(a.plateRadius + 0.2, 3.4, [0, 0, a.plateRear - 0.2]);
}
const piPoints = () =>
  pi5Interface.pcb.holes.map((h) => worldPoint([h.x, h.y, h.z], guidedDatums.pi));

/** Four broad TPU mounting lands connected on the populated-face side. */
export function guidedCagePiSupportShape(p: Parameters): Shape {
  const a = guidedCageDatums(p),
    h = piPoints();
  return subtract(
    union(
      box([a.piLowerX, 3.5, 66], [0, -35, 3]),
      // A broad outer return bypasses the GPIO header and the power-wire bore.
      box([a.piLowerX, 13, 72], [0, 21, 3]),
      box([a.piLowerX, 69, 7], [0, -35, 3]),
      box([a.piLowerX, 69, 10], [0, -35, 65]),
      ...h.map((v) => cylinder(4, a.piLowerX, [0, v[1], v[2]], 'x')),
      ...[h[0], h[3]].map((v) => cylinder(1.15, 0.6, [a.piLowerX - 0.2, v[1], v[2]], 'x')),
    ),
    ...piPackageClearances(0.25),
    guidedGpioReserve(),
    guidedPcieReserve(p),
    guidedPowerFrameClearance(p),
    // Open the inner side of the wire passage instead of leaving a narrow TPU strip.
    box([4, 3.4, 4.6], [-0.1, 25.1, 19.7]),
    // The lower connector opening is intentional; retain no unsupported membrane below it.
    box([4, 14.4, 1.6], [-0.1, -7.2, 2.9]),
  );
}
/** A broad rim joins the four pressure lands; the cage backs its positive-X face. */
export function guidedCagePiPressureShape(p: Parameters): Shape {
  const a = guidedCageDatums(p);
  return subtract(
    union(
      subtract(box([2.8, 56, 66], [7, -30, 3]), box([3.2, 44, 54], [6.8, -24, 9])),
      ...piPoints().map((v) =>
        union(
          cylinder(2.5, 3.53, [a.piUpperX, v[1], v[2]], 'x'),
          cylinder(4, 1, [7, v[1], v[2]], 'x'),
        ),
      ),
    ),
    ...piPackageClearances(0.25),
    guidedGpioReserve(),
    guidedPcieReserve(p),
    cylinder(2, 5, [6, 28.5, 22], 'x'),
  );
}
function pressureClearances(p: Parameters) {
  return [guidedCagePiPressureShape(p)];
}

/** Negative-X half: flat-backed load plate, broad source-cleared Pi lands and adapter rails. */
export function guidedCageBaseShape(p: Parameters, extraCuts: Shape[] = []): Shape {
  const a = guidedCageDatums(p),
    parts: Shape[] = [box([3.5, 66, 208], [-24, -33, a.rear]), guidedSupportBackplate(p)];
  for (const sign of [-1, 1])
    parts.push(box([11.2, 5, 170], [-20.7, sign > 0 ? 32 : -34.5, a.rear]));
  // A continuous 45-degree haunch joins the positive wall to the full backplate,
  // rather than relying on its former 1 mm overlap at the plate's Y=33 edge.
  // It remains behind the adapter cushion and inside the existing cage envelope.
  parts.push(
    prism(
      [
        [-24, 29.5],
        [-24, 31.5],
        [-18, 37.5],
        [-18, 29.5],
      ],
      170,
      a.rear,
    ),
  );
  parts.push(
    box([4, 5.5, 105], [-20.5, -27, -94]),
    box([4, 4.9, 105], [-20.5, 26.5, -94]),
    box([4, 58.4, 10], [-20.5, -27, -94]),
    box([4, 58.4, 8], [-20.5, -27, 3]),
  );
  for (const v of piPoints()) {
    const outer = v[1] < 0 ? -30 : 27;
    parts.push(
      cylinder(4, -a.baseInnerX, [a.baseInnerX, v[1], v[2]], 'x'),
      box(
        [-a.baseInnerX, Math.abs(outer - v[1]) + 2, 8],
        [a.baseInnerX, Math.min(outer, v[1]), v[2] - 4],
      ),
    );
  }
  parts.push(
    box([11, 34, 35], [-24, -17, 100]),
    box([24.9, 40, 6], [-25, -20, n(p, 'noseLength') - 11]),
  );
  parts.push(
    cylinder(7, 7, [-24, a.frontJoint.y, a.frontJoint.z], 'x'),
    // The full +X entry envelope of the TPU cheeks reaches Y33.2. Leave a
    // 0.3 mm running gap and open the lower bore mouth instead of a thin lip.
    intersect(
      union(
        cylinder(6.8, 22.5, [-20.5, a.rearJoint.y, a.rearJoint.z], 'x'),
        box([22.5, 8.5, 18], [-20.5, 30.5, a.rearJoint.z - 9]),
      ),
      box([22.5, 8, 18], [-20.5, 33.5, a.rearJoint.z - 9]),
    ),
  );
  parts.push(
    cylinder(6, a.frontJoint.nutX + 11, [-17, a.frontJoint.y, a.frontJoint.z], 'x'),
    box([27, 48, 2.3], [-20.5, -24, a.rear]),
  );
  parts.push(guidedCameraRearStopShape(p, 'base'));
  return subtract(
    intersect(
      union(...parts),
      guidedCageEnvelopeShape(p),
      // Preserve one planar print bed and the negative-X fixed-nut guide clearance.
      union(box([49, 82, 240], [-24, -41, -99]), guidedSupportBackplate(p)),
    ),
    ...piPackageClearances(0.3),
    ...cableCuts(p),
    guidedCameraMountEnvelope(p),
    guidedCageRearPlateClearance(p),
    guidedSupportGroove(p),
    ...guidedCageJointSpecs(p).flatMap((j) => [
      cylinder(2.2, 60, [-29, j.y, j.z], 'x'),
      cylinder(4.1, j.bearingX + 29, [-29, j.y, j.z], 'x'),
    ]),
    cylinder(3.5, 14, [-29, 12.95, -82.5], 'x'),
    ...sharedCageCuts(p),
    ...extraCuts,
  );
}

/** Positive-X half: rear-up ribs, formed-seat backing and common camera closing cheek. */
export function guidedCageCoverShape(p: Parameters, extraCuts: Shape[] = []): Shape {
  const a = guidedCageDatums(p),
    parts: Shape[] = [
      box([4, 52, 103], [26.5, -26, a.rear]),
      // Three axial millimetres carry the rear-disk capture; no thin annular lip.
      intersect(
        subtract(
          cylinder(39.9, 3, [0, 0, a.plateFront + 0.2]),
          cylinder(35.2, 3.4, [0, 0, a.plateFront]),
        ),
        box([34, 80, 9], [6.5, -40, a.rear]),
      ),
      intersect(
        {
          kind: 'revolve',
          segments: 96,
          profile: [
            [0, a.rear],
            [39.9, a.rear],
            [39.9, a.rear + 6],
            [35.2, a.rear + 6],
            [35.7, a.rear + 5.5],
            [35.7, a.rear + 2.3],
            [0, a.rear + 2.3],
          ],
        },
        box([34, 80, 6.1], [6.5, -40, a.rear]),
      ),
    ];
  for (const sign of [-1, 1]) parts.push(box([22, 4, 173], [6.5, sign > 0 ? 31.5 : -35.5, a.rear]));
  parts.push(
    subtract(box([3.5, 68, 75], [9.8, -33, 3]), box([4, 44, 68.2], [9.6, -24, 3])),
    box([10, 24, 29.8], [17, -12, 80.2]),
    box([5, 27, 30], [13, -9, 105]),
    box([24.9, 40, 6], [0.1, -20, n(p, 'noseLength') - 11]),
    at(
      prism(
        [
          [9.8, 65],
          [13.3, 65],
          [27, 78.7],
          [27, 86],
          [9.8, 86],
        ],
        6,
        0,
      ),
      { translation: [0, 28, 0], rotation: [90, 0, 0] },
    ),
    at(
      prism(
        [
          [13.2, 66.4],
          [27, 80.2],
          [27, 87],
          [13.2, 87],
        ],
        38,
        0,
      ),
      { translation: [0, 26, 0], rotation: [90, 0, 0] },
    ),
  );
  // Two straight-sided panels form one clear opening above the common bed support.
  parts.push(
    acrossX(
      [
        [-35, 27.6],
        [-5.3, 27.6],
        [-5.3, 57.3],
        [8.5, 71.2],
        [-35, 71.2],
      ],
      9.8,
      3.5,
    ),
  );
  parts.push(
    acrossX(
      [
        [20.2, 27.6],
        [35, 27.6],
        [35, 71.2],
        [6.4, 71.2],
        [20.2, 57.4],
      ],
      9.8,
      3.5,
    ),
  );
  // Broad outside haunches connect the lower lands without entering the cell envelope.
  for (const sign of [-1, 1])
    parts.push(
      acrossX(
        [
          [33.4, -8],
          [35.5, -8],
          [35.5, 20],
          [16.5, 20],
          [33.4, 3],
        ].map(([y, z]) => [sign * y, z] as [number, number]),
        9.8,
        3.5,
      ),
    );
  // A continuous 45-degree band grows from the existing UPS spine, replacing
  // the separate hooks with one common support plane 0.2 mm below the TPU bed.
  parts.push(
    at(
      prism(
        [
          [26.5, 4.8],
          [30.5, 4.8],
          [15.5, 19.8],
          [15.5, 27.6],
          [9.8, 27.6],
          [9.8, 21.5],
        ],
        46.2,
        0,
      ),
      { translation: [0, 20.2, 0], rotation: [90, 0, 0] },
    ),
  );
  parts.push(
    at(
      prism(
        [
          [9.8, 20],
          [13.3, 20],
          [15.5, 22.2],
          [15.5, 27.6],
          [9.8, 27.6],
        ],
        4.7,
        0,
      ),
      { translation: [0, -26, 0], rotation: [90, 0, 0] },
    ),
  );
  for (const v of piPoints())
    parts.push(
      subtract(
        union(
          intersect(cylinder(6, 3.5, [9.8, v[1], v[2]], 'x'), box([5, 80, 150], [9, -40, 3])),
          box(
            [
              3.5,
              v[1] < 0 ? Math.abs(-33 - v[1]) + 2 : Math.abs(33 - v[1]) + 2,
              v[2] + 4.5 - Math.max(3, v[2] - 4.5),
            ],
            [9.8, v[1] < 0 ? -33 : v[1], Math.max(3, v[2] - 4.5)],
          ),
        ),
        // The source pressure rim has no material here; remove cosmetic round
        // intrusions before adding/merging the separate common-floor stock.
        box([5, 44, 54], [9.6, -24, 9]),
      ),
    );
  parts.push(
    box([13.8, 14.1, 9.1], [13.2, a.frontJoint.y - 2.1, a.frontJoint.z - 13.1]),
    cylinder(8, 12, [a.frontJoint.nutX - 6, a.frontJoint.y, a.frontJoint.z], 'x'),
    intersect(
      cylinder(8, 12, [a.rearJoint.nutX - 6, a.rearJoint.y, a.rearJoint.z], 'x'),
      box([12, 12, 20], [a.rearJoint.nutX - 6, 33.5, a.rearJoint.z - 10]),
    ),
    box([12, 6.7, 18], [a.rearJoint.nutX - 6, 33.2, a.rearJoint.z - 9]),
  );
  parts.push(guidedCameraRearStopShape(p, 'cover'));
  return subtract(
    intersect(
      union(...parts),
      guidedCageEnvelopeShape(p),
      union(box([55, 82, 240], [-24.5, -41, -99]), box([34, 80, 9], [6.5, -40, a.rear])),
    ),
    ...piPackageClearances(0.3),
    ...cableCuts(p),
    // One working port replaces the three fragile 1 mm separators between UPS sockets.
    box([30, 39, 7], [9, -19.5, -4]),
    // The opened rear fastener corner has no unsupported 0.75 mm inner lip.
    box([19, 2.1, 8.7], [6.49, 31.4, a.rearJoint.z - 4]),
    // The lower UPS socket reaches the service edge without a 1.3 mm floor remnant.
    box([1.6, 9.2, 1.5], [26.45, -4.1, a.plateFront + 0.1]),
    // Open the matching side-foot clearance; disk retention stays on the full-depth outer sectors.
    box([14.7, 4.8, 1.5], [6.4, -33.3, a.plateFront + 0.1]),
    // Open the negative-X cable entry through the complete rear shoe, without a thin roof.
    box([29, 8.8, 4.4], [-25, 3.3, n(p, 'noseLength') - 32.2]),
    guidedCameraMountEnvelope(p),
    guidedCageRearPlateClearance(p),
    ...pressureClearances(p),
    box([26, 25.4, 29.8], [9.8, -5.2, 27.6]),
    box([26.7, 27, 41.8], [13.3, -31, 27.6]),
    box([5.5, 12, guidedAuxiliaryFixing.bearing[2] + 6 - 56], [25.5, -6, 56]),
    cylinder(6.3, 1.2, [12.8, a.frontJoint.y, a.frontJoint.z], 'x'),
    cylinder(1.7, 18, [15, 0, guidedAuxiliaryFixing.bearing[2]], 'x'),
    hexX(
      5.8,
      13,
      guidedAuxiliaryFixing.nutCenter[0] + 2.2 - 13,
      0,
      guidedAuxiliaryFixing.nutCenter[2],
    ),
    box(
      [guidedAuxiliaryFixing.nutCenter[0] + 2.2 - 13, 25, 6.5],
      [13, -25, guidedAuxiliaryFixing.nutCenter[2] - 3.25],
    ),
    // Open the inner bearing-collar lip around the shaft, rather than printing a sub-millimetre shelf.
    box(
      [35 - (a.rearJoint.nutX - 6.2), 7, 7.7],
      [a.rearJoint.nutX - 6.2, a.rearJoint.y - 6, a.rearJoint.z - 3.85],
    ),
    ...guidedCageJointSpecs(p).flatMap((j) => [
      cylinder(2.2, 56, [-25, j.y, j.z], 'x'),
      hexX(7.3, j.nutX - 2.5, 35 - (j.nutX - 2.5), j.y, j.z),
    ]),
    ...sharedCageCuts(p),
    ...extraCuts,
  );
}

export const guidedAuxiliaryFixing = {
  bearing: [28.5, 0, 86.5] as Vec,
  nutCenter: [20, 0, 86.5] as Vec,
  diameter: 3,
  length: 12,
};

/** One broad flat keeper uses one accessible fastener instead of thin locking fingers. */
export function guidedCageAuxiliaryKeeperShape(p: Parameters): Shape {
  return subtract(
    intersect(
      union(
        box([4, 11, 20], [30.5, -21, 40]),
        box([4, 10, 20], [30.5, 10, 40]),
        box([4, 35, 4], [26.5, -15, 56]),
        box([5, 12, guidedAuxiliaryFixing.bearing[2] + 6 - 56], [25.5, -6, 56]),
      ),
      guidedCageEnvelopeShape(p),
    ),
    cylinder(1.7, 8, [25, 0, guidedAuxiliaryFixing.bearing[2]], 'x'),
    cylinder(3.1, 3, [...guidedAuxiliaryFixing.bearing], 'x'),
  );
}

/** Actual pressure form and its open rear fastener corner share one assembly/clearance definition. */
export function guidedCageCellCoverShape(p: Parameters): Shape {
  const j = guidedCageDatums(p).rearJoint;
  return union(
    cellCoverShape(p, [box([53.5, 11, 13.7], [-18.5, j.y - 5.5, j.z - 9.2])]),
    // Reconnect the retained rear foot behind the actual holder, below the open
    // fastener corner. The outer continuation joins the full 3 mm pressure roof.
    box([14.5, 5.5, 5.8], [12, 23.5, j.z - 4]),
    box([3, 5.5, 9], [23.5, 23.5, j.z - 4]),
  );
}

function sharedCageCuts(p: Parameters): Shape[] {
  return [
    guidedCagePiSupportShape(p),
    powerCarrierShape(p),
    adapterCushionShape(),
    guidedCageCellCoverShape(p),
    cylinder(6.4, 31, [0, 0, n(p, 'noseLength') - 28]),
    cylinder(4.2, 58, [-29, 0, n(p, 'noseLength') - 17.5], 'x'),
    ...[-20, -32].map((z) => cylinder(2.2, 61, [-29, 0, z], 'x')),
  ];
}

/** Shared positive compression faces; these are measured again by the native review. */
export function guidedCageStopContacts(p: Parameters) {
  const a = guidedCageDatums(p);
  return [
    {
      id: 'cage-fore-compression-stop',
      first: 'cassette-cage-base',
      second: 'cassette-cage-cover',
      axis: 'x',
      planeCoordinate: a.frontJoint.nutX - 6,
      minArea: 1,
    },
    {
      id: 'cage-rear-compression-stop',
      first: 'cassette-cage-base',
      second: 'cassette-cage-cover',
      axis: 'x',
      planeCoordinate: 2,
      minArea: 1,
    },
  ];
}

export const guidedCageRequirements = [
  'Close both rigid cage halves against PETG stops; the formed TPU seats do not establish bolt preload.',
  'The four tube fasteners are positive steel pins through the cage lands, not friction-only TPU clamps.',
  'Board placements and the measured short PCIe routing remain source-bound to guided-layout.',
  'The rear plate is trapped in the two half-grooves before closure; it is not a parachute attachment.',
  'This initial geometry requires integrated native fit, closure paths, driver access and print-layer review.',
];
