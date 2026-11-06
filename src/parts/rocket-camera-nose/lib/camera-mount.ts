import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, cylinder, union, subtract, type Shape } from '../../../core/assembly/boundary/shapes';

type Vec = [number, number, number];
export type CameraMountSide = -1 | 1;
export type FrameRadius = (p: Parameters, z: number) => number;

/** Geometry reference only: procure a qualified serviceable factory nylon-patch execution. */
export const cameraScrewPreset = 'gvyntok-040-150-015';

/** Camera body rear is the datum; the user supplied the 7.5 mm side-hole offset. */
export function cameraMountCoordinates(p: Parameters) {
  const rearZ = n(p, 'noseLength') - 25;
  const sideHoleOffset = typeof p.cameraMountOffset === 'number' ? p.cameraMountOffset : 7.5;
  const sideHoleY = typeof p.cameraMountHeight === 'number' ? p.cameraMountHeight : 0;
  return {
    rearZ,
    bodyFrontZ: rearZ + 12,
    objectiveFrontZ: rearZ + 27,
    rearConnectorBackZ: rearZ - 0.5,
    screwZ: rearZ + sideHoleOffset,
    screwY: sideHoleY,
    sideHoleOffset,
    cameraHalfWidth: 9.5,
    pocketInnerHalf: 9.7,
    pocketOuterHalf: 12.2,
    pocketOuterRadius: 15,
    petgInnerHalf: 12.4,
    petgInnerRadius: 15.2,
    petgSideSeat: 13.4,
    screwBearing: 15.5,
    headFront: 16.875,
    threadEngagement: 2,
    innerGlassRadiusAtObjective: Math.sqrt(8.725 ** 2 - (2 + 3.725) ** 2),
    objectiveRadialClearance: Math.sqrt(8.725 ** 2 - (2 + 3.725) ** 2) - 6,
  };
}

function intersect(...children: Shape[]): Shape {
  return { kind: 'intersect', children };
}
function roundedSquare(half: number, radius: number, z: number, height: number): Shape {
  return intersect(
    box([half * 2, half * 2, height], [-half, -half, z]),
    cylinder(radius, height, [0, 0, z]),
  );
}
function roundedTaper(
  half0: number,
  radius0: number,
  half1: number,
  radius1: number,
  z0: number,
  z1: number,
): Shape {
  const ring = (half: number, z: number): Vec[] => [
    [-half, -half, z],
    [half, -half, z],
    [half, half, z],
    [-half, half, z],
  ];
  return intersect(
    { kind: 'loft', rings: [ring(half0, z0), ring(half1, z1)] },
    {
      kind: 'revolve',
      segments: 64,
      profile: [
        [0, z0],
        [radius0, z0],
        [radius1, z1],
        [0, z1],
      ],
    },
  );
}
function oppositeSide(shape: Shape, side: CameraMountSide, centerY = 0): Shape {
  return side === 1
    ? shape
    : {
        kind: 'transform',
        child: shape,
        translation: [0, 2 * centerY, 0],
        rotation: [0, 0, 180],
      };
}

/** The roof grows downwards from the body in the inverted printing pose at a 45 degree cone. */
function grommetSupportCone(p: Parameters, extra = 0): Shape {
  const a = cameraMountCoordinates(p),
    top = a.screwZ + 4.85 + extra,
    bottom = a.screwZ - 6;
  const count = 64,
    radius = (top - bottom) / Math.cos(Math.PI / count);
  const points: Vec[] = [[a.pocketOuterHalf, a.screwY, top]];
  for (let i = 0; i < count; i++) {
    const t = (2 * Math.PI * i) / count;
    points.push([
      a.pocketOuterHalf + radius * Math.cos(t),
      a.screwY + radius * Math.sin(t),
      bottom,
    ]);
  }
  return {
    kind: 'boundary',
    points,
    faces: [
      ...Array.from({ length: count }, (_, i) => [0, i + 1, ((i + 1) % count) + 1]),
      Array.from({ length: count }, (_, i) => count - i),
    ],
  };
}

function grommetRoof(p: Parameters, extra = 0): Shape {
  const a = cameraMountCoordinates(p);
  return intersect(
    grommetSupportCone(p, extra),
    cylinder(
      4.85 + extra,
      a.petgSideSeat - a.pocketOuterHalf,
      [a.pocketOuterHalf, a.screwY, a.screwZ],
      'x',
    ),
    box([a.petgSideSeat - a.pocketOuterHalf, 10, 6], [a.pocketOuterHalf, a.screwY - 5, a.screwZ]),
  );
}

/** Subtract once from the complete fused frame; the sloped seat is exact nominal TPU contact. */
export function cameraPocketFrameClearanceShape(p: Parameters, frameRadius?: FrameRadius): Shape {
  const a = cameraMountCoordinates(p),
    start = a.rearZ - 8;
  const lead: Shape = frameRadius
    ? roundedTaper(
        frameRadius(p, start) - 3,
        frameRadius(p, start) - 3,
        14.2,
        16.8,
        start,
        a.rearZ - 0.8,
      )
    : roundedSquare(14.4, 17, a.rearZ - 6, 5.2);
  return union(
    lead,
    // Extrapolate the exact seat profile by0.02mm to overlap adjacent cuts in Float32.
    roundedTaper(14.22, 16.818, 12.18, 14.982, a.rearZ - 0.82, a.rearZ + 1.22),
    roundedSquare(a.petgInnerHalf, a.petgInnerRadius, a.rearZ + 1.2, 11.6),
    ...([-1, 1] as const).map((side) => oppositeSide(grommetRoof(p, 0.2), side, a.screwY)),
  );
}

/** Straight screw/plunger ports replace fragile drive plugs and their blade slots. */
export function cameraMountToolAccessShapes(p: Parameters, reach = 40): Shape[] {
  const a = cameraMountCoordinates(p);
  return [
    cylinder(3.8, 2 * reach, [-reach, a.screwY, a.screwZ], 'x'),
    ...([-1, 1] as const).map((side) =>
      oppositeSide(
        cylinder(4.85, reach - a.petgSideSeat, [a.petgSideSeat, a.screwY, a.screwZ], 'x'),
        side,
        a.screwY,
      ),
    ),
  ];
}

/** Opposed 6 mm plungers approach the empty pocket after all camera hardware is removed. */
export function cameraPocketRemovalToolEnvelopes(p: Parameters, reach = 40): Shape[] {
  const a = cameraMountCoordinates(p);
  return ([-1, 1] as const).map((side) =>
    oppositeSide(cylinder(3, reach - 10.85, [10.85, a.screwY, a.screwZ], 'x'), side, a.screwY),
  );
}

/** Raw receiver blank: fuse into the frame, then apply all camera clearances once globally. */
export function petgCameraMountShape(p: Parameters, frameRadius: FrameRadius): Shape {
  const a = cameraMountCoordinates(p),
    z0 = a.rearZ - 8,
    z1 = a.bodyFrontZ;
  const outside: [number, number][] = Array.from({ length: 17 }, (_, i) => {
    const z = z0 + ((z1 - z0) * i) / 16;
    return [frameRadius(p, z) - 0.1, z];
  });
  return { kind: 'revolve', segments: 64, profile: [...outside, [0, z1], [0, z0]] };
}

/** Rear-open 2.5 mm sleeve, three-millimetre rear flange and matched conical load seat. */
export function tpuCameraPocketShape(p: Parameters, serviceClearance?: Shape): Shape {
  const a = cameraMountCoordinates(p),
    parts: Shape[] = [
      roundedSquare(a.pocketOuterHalf, a.pocketOuterRadius, a.rearZ - 0.9, 13.7),
      roundedSquare(14.2, 16.8, a.rearZ - 3.8, 3),
      roundedTaper(14.2, 16.8, 12.2, 15, a.rearZ - 0.8, a.rearZ + 1.2),
    ];
  for (const side of [-1, 1] as const) {
    const grommet = intersect(
      union(
        cylinder(3.5, a.petgSideSeat - 10.7, [10.7, a.screwY, a.screwZ], 'x'),
        cylinder(4.6, 1.6, [a.petgSideSeat, a.screwY, a.screwZ], 'x'),
        grommetRoof(p),
      ),
      grommetSupportCone(p),
    );
    parts.push(oppositeSide(grommet, side, a.screwY));
  }
  const tangent = 2.1 / Math.SQRT2;
  // The downward triangle becomes a 45 degree bore roof when the front lip faces the bed.
  const boreRoof: Shape = {
    kind: 'loft',
    rings: [-17, 17].map((x): Vec[] => [
      [x, a.screwY - tangent, a.screwZ - tangent],
      [x, a.screwY, a.screwZ - 2.1 * Math.SQRT2],
      [x, a.screwY + tangent, a.screwZ - tangent],
    ]),
  };
  return subtract(
    union(...parts),
    box([19.4, 19.4, 16], [-9.7, -9.7, a.rearZ - 4]),
    cylinder(6.2, 19, [0, 0, a.rearZ - 4]),
    cylinder(2.1, 34, [-17, a.screwY, a.screwZ], 'x'),
    boreRoof,
    ...(serviceClearance ? [serviceClearance] : []),
  );
}

export interface CameraScrewMount {
  id: string;
  diameter: 2.5;
  length: 8;
  bearing: Vec;
  axis: 'x' | '-x';
  nominalThreadEngagement: number;
}
export interface CameraSleeveMount {
  type: 'tube' | 'washer';
  id: string;
  name: string;
  outerDiameter: number;
  bore: number;
  length: number;
  center: Vec;
  axis: 'x';
}

/** The source catalogue supplies geometry; the separate nylon-patch execution must be qualified. */
export function cameraFastenerMounts(p: Parameters): {
  screws: CameraScrewMount[];
  sleeves: CameraSleeveMount[];
} {
  const a = cameraMountCoordinates(p),
    screws: CameraScrewMount[] = [],
    sleeves: CameraSleeveMount[] = [];
  for (const side of [-1, 1] as const) {
    const tag = side > 0 ? 'right' : 'left';
    screws.push({
      id: `camera-side-screw-${tag}`,
      diameter: 2.5,
      length: 8,
      bearing: [side * a.screwBearing, a.screwY, a.screwZ],
      axis: side > 0 ? 'x' : '-x',
      nominalThreadEngagement: a.threadEngagement,
    });
    sleeves.push({
      type: 'tube',
      id: `camera-compression-tube-${tag}`,
      name: 'Camera isolation compression limiter',
      outerDiameter: 4,
      bore: 2.7,
      length: 5.5,
      center: [side * 12.25, a.screwY, a.screwZ],
      axis: 'x',
    });
    sleeves.push({
      type: 'washer',
      id: `camera-side-washer-${tag}`,
      name: 'Camera isolation pressure washer',
      outerDiameter: 6,
      bore: 2.7,
      length: 0.5,
      center: [side * 15.25, a.screwY, a.screwZ],
      axis: 'x',
    });
  }
  return { screws, sleeves };
}

export const cameraMountRequirements = [
  'Camera rear-to-hole offset 7.5 mm is supplied by the user; verify the hole height, M2.5 thread depth and blind-hole bottoming clearance on the delivered camera.',
  'Use two M2.5 x 8 ISO 7380-1 button screws with a qualified serviceable factory nylon locking patch, 2 mm nominal engagement and 1.375 mm head height. The catalogue preset is a geometry reference; it does not establish that the linked ordinary screw includes a locking patch.',
  'An ordinary unpatched screw is not an equivalent anti-loosening solution. Qualify patch installation torque, removal torque, reuse limit, compatibility and vibration retention for the actual camera thread.',
  'The 5.5 mm compression tubes stop between the camera and the pressure washers. They must remain clear of PETG; the TPU grommets isolate the metal stack.',
  'The 1.6 mm side flange has a sloped printing roof and establishes nominal seating only. No elastic preload or dynamic strength is inferred; qualify TPU hardness, physical fits and repeated service.',
  'Expose the cassette and disconnect the camera flex. Remove both side screws, washers and compression tubes through the straight ports, then withdraw the camera rearwards while the TPU pocket stays seated.',
  'Remove the EMPTY pocket with opposed 6 mm plungers. Depress the grommets inward by at least 2.6 mm and fold the outer flange through the 7.6 mm inner port before drawing the pocket rearwards.',
  'Empty-pocket extraction is an elastic operation requiring physical qualification of the 2.5 mm TPU walls, flange folding, tool access and service cycles; it is not represented as a rigid clearance fit.',
  'The integrated rear flange is locally relieved for the supplied Ethernet plug corridor. Keep the actual plug, latch and cable bend clear; the local service relief does not change the matched conical seat.',
  'Print the pocket front-lip-down. The broad rear flange grows through a matched 45 degree seat transition; validate the actual slicer, material and dimensional fit before release.',
];
