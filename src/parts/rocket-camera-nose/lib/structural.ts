import { hasOV9281, opticalLayout, opticalOuterRadius, at } from './optical-layout';
import { opticalFrameAdds, opticalFrameClearances, opticalModulePieces } from './optical-module';
import { csiRibbonReserve } from './csi';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import type { NoseFactory } from './tpu';
import {
  windowRetainerShape,
  windowRearGasketShape,
  windowFrontGasketShape,
  windowFrontSeatShape,
  windowLoadSeatShape,
  windowHousingCuts,
  frameWindowSupportShape,
  windowMountRequirements,
} from './window-mount';
import {
  cameraMountCoordinates,
  petgCameraMountShape,
  tpuCameraPocketShape,
  cameraMountToolAccessShapes,
  cameraFastenerMounts,
  cameraScrewPreset,
  cameraPocketFrameClearanceShape,
  cameraMountRequirements,
} from './camera-mount';
import {
  rearCapBosses,
  rearCapShape,
  rearCapFastenerMounts,
  rearCapScrewPreset,
  serviceFrameCuts,
} from './service-mounts';
import {
  reinforcedPiCradleShape,
  reinforcedUPSCradleShape,
  upsCellCoverShape,
  equipmentFastenerMounts,
  piSideChannelFrameReliefs,
  upsCrossPinY,
  upsCoverServiceClearanceShape,
} from './equipment-mounts';
import bolt from '../../bolt-screw/part';
import pi from '../../raspberry-pi/part';
import ups from '../../waveshare-ups-3s/part';
import adapter from '../../waveshare-pcie-m2-d/part';
import camera from '../../board-camera-19/part';
import dome from '../../optical-dome-window/part';
import cell from '../../li-ion-cell/part';
import ssd from '../../m2-ssd/part';
import gps from '../../gps-tracker/part';
import finder from '../../jhe42b-finder/part';
import {
  accessoryDeviceSpecs,
  accessoryPrintedParts,
  accessoryFixedFrameAdds,
  accessoryFixedFrameCuts,
  accessoryServiceSpec,
  accessoryHardwareSpecs,
} from './accessory-mounts';

import { structuralBodyAnchorAngles } from './body-anchors';
import {
  rearCableFrameAnchors,
  rearCableGrommetShape,
  rearCableRequirements,
} from './cable-feedthroughs';
export { structuralBodyAnchorAngles } from './body-anchors';

export const structuralCoordinates = {
  piX: -11.2,
  piZ: 31,
  piRotation: [0, -90, 180] as [number, number, number],
  adapterX: -16.7,
  ssdX: -20.7,
  upsX: 3.844,
  upsZ: -44,
};

/** New camera layouts move the computer forward 8 mm to keep both leads at 100 mm. */
export function structuralCoordinatesFor(p: Parameters) {
  return { ...structuralCoordinates, piZ: structuralCoordinates.piZ + (hasOV9281(p) ? 8 : 0) };
}

/** Equal angular sampling keeps coincident round interfaces closed after Float32 conversion. */
function consistentRoundSampling(shape: Shape): Shape {
  if (shape.kind === 'cylinder')
    return {
      ...shape,
      segments: shape.segments !== undefined && shape.segments <= 8 ? shape.segments : 96,
    };
  if (shape.kind === 'revolve' && (shape.sweep === undefined || shape.sweep === 360))
    return { ...shape, segments: 96 };
  if (shape.kind === 'transform') return { ...shape, child: consistentRoundSampling(shape.child) };
  if ('children' in shape)
    return { ...shape, children: shape.children.map(consistentRoundSampling) };
  return shape;
}

function delta(p: Parameters): number {
  return (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 42.8;
}
function radius(p: Parameters, z: number): number {
  if (hasOV9281(p)) return opticalOuterRadius(p, z);
  const r = n(p, 'tubeOD') / 2,
    rise = r - 13.4,
    rho = (n(p, 'noseLength') ** 2 + rise ** 2) / (2 * rise);
  return Math.sqrt(Math.max(0, rho ** 2 - z ** 2)) + r - rho;
}
function bodyBayonetSector(
  d: number,
  angle: number,
  sweep: number,
  entry = false,
  male = false,
): Shape {
  const r0 = (male ? 40.9 : 41.1) + d,
    r1 = (male ? 43.2 : 43.5) + d;
  const bottom = (r: number) => (entry ? -0.2 : r - (male ? 37 : 37.2) - d);
  const top = (r: number) => (male ? 55.4 : 55.6) + d - r;
  return {
    kind: 'transform',
    translation: [0, 0, 0],
    rotation: [0, 0, angle - sweep / 2],
    child: {
      kind: 'revolve',
      segments: 64,
      sweep,
      profile: [
        [r0, bottom(r0)],
        [r1, bottom(r1)],
        [r1, top(r1)],
        [r0, top(r0)],
      ],
    },
  };
}
function ring(ro: number, ri: number, z: number, h: number): Shape {
  return subtract(cylinder(ro, h, [0, 0, z]), cylinder(ri, h + 0.4, [0, 0, z - 0.2]));
}
/** A profile in X/Z, extruded through Y. */
function acrossY(profile: [number, number][], y0: number, y1: number): Shape {
  return {
    kind: 'transform',
    translation: [0, y1, 0],
    rotation: [90, 0, 0],
    child: prism(profile, y1 - y0, 0),
  };
}
function acrossX(profile: [number, number][], x0: number, x1: number): Shape {
  return {
    kind: 'transform',
    translation: [x0, 0, 0],
    rotation: [0, 90, 0],
    child: prism(
      profile.map(([y, z]) => [-z, y]),
      x1 - x0,
      0,
    ),
  };
}
/** The first receiver layer grows from the barrel instead of appearing across its hollow bore. */
function receiverRearRoot(
  p: Parameters,
  left: number,
  right: number,
  face: number,
  side: number,
  front: number,
): Shape {
  const outer = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2,
    start = front - 9.3;
  return {
    kind: 'intersect',
    children: [
      box([right - left, 48 - face, 9.5], [left, side > 0 ? face : -48, start]),
      {
        kind: 'revolve',
        segments: 96,
        profile: [
          [outer, start],
          [outer, front + 0.2],
          [outer - 12.5, front + 0.2],
          [outer - 3, start],
        ],
      },
    ],
  };
}
function hexRoofX(x: number, length: number, across: number, z: number): Shape {
  const half = across / (2 * Math.sqrt(3)),
    top = z + across / 2;
  return acrossX(
    [
      [-half, top - 0.05],
      [half, top - 0.05],
      [half, top],
      [0, top + half],
      [-half, top],
    ],
    x,
    x + length,
  );
}
function plugReserve(p: Parameters): Shape {
  const a = structuralCoordinatesFor(p);
  const top = a.piZ + 80.55;
  return union(
    box([18, 20, 35], [a.piX - 1, 7.75, a.piZ + 45.55]),
    acrossY(
      [
        [a.piX - 1.2, top - 0.2],
        [a.piX + 17.2, top - 0.2],
        [a.piX + 8, top + 11.5],
      ],
      7.75,
      50,
    ),
  );
}
/** The supplied Pi5 solids project to these offsets; the whole purchased unit can pass rearwards. */
function piPurchasedRearServiceCorridor(p: Parameters): Shape {
  const a = structuralCoordinatesFor(p),
    x0 = a.piX - 1.65,
    x1 = a.piX + 17.726,
    y0 = -28.2,
    y1 = 29.4;
  const rear = -n(p, 'shoulderLength') - 0.2,
    front = a.piZ + 45.75;
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    rise = Math.hypot((x1 - x0) / 2, (y1 - y0) / 2) + 0.05;
  const outline: [number, number][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const points: [number, number, number][] = [
    ...outline.map(([x, y]) => [x, y, rear] as [number, number, number]),
    ...outline.map(([x, y]) => [x, y, front] as [number, number, number]),
    [cx, cy, front + rise],
  ];
  return {
    kind: 'boundary',
    points,
    faces: [
      [3, 2, 1, 0],
      ...[0, 1, 2, 3].map((i) => [i, (i + 1) % 4, ((i + 1) % 4) + 4, i + 4]),
      ...[0, 1, 2, 3].map((i) => [i + 4, ((i + 1) % 4) + 4, 8]),
    ],
  };
}
/** One solid wall supplies each new layer; the service apertures close on steep roofs. */
function forwardSkin(p: Parameters, end: number): Shape {
  const stations = Array.from({ length: 65 }, (_, i) => {
    const z = (end * i) / 64;
    return [frameRadius(p, z), z] as [number, number];
  });
  const skin: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      ...stations,
      ...stations
        .slice()
        .reverse()
        .map(([r, z]) => [r - 3, z] as [number, number]),
    ],
  };
  const aux = acrossY(
    [
      [10.3, 27.6],
      [35.2, 27.6],
      [35.2, 64.6],
      [22.75, 86.6],
      [10.3, 74],
    ],
    -60,
    60,
  );
  const rear = -n(p, 'shoulderLength') + 2.4;
  const returns = [-1, 1].map((side) =>
    acrossY(
      [
        [structuralCoordinates.piX - 5.8, rear],
        [structuralCoordinates.piX - 1.8, rear],
        [structuralCoordinates.piX - 1.8, 74.2],
        [structuralCoordinates.piX - 3.5, 76.4],
        [structuralCoordinates.piX - 5.8, 74.2],
      ],
      side > 0 ? 27.1 : -29.8,
      side > 0 ? 29.8 : -27.1,
    ),
  );
  const board = acrossY(
    [
      [structuralCoordinates.adapterX - 2.2, rear],
      [structuralCoordinates.adapterX + 0.6, rear],
      [structuralCoordinates.adapterX + 0.6, 73.7],
      [structuralCoordinates.adapterX - 0.8, 75.5],
      [structuralCoordinates.adapterX - 2.2, 73.7],
    ],
    -29.1,
    29.1,
  );
  const stack = [-1, 1].map((side) =>
    acrossY(
      [
        [structuralCoordinates.piX - 14.6, rear],
        [structuralCoordinates.piX - 12.6, rear],
        [structuralCoordinates.piX - 12.6, 52.2],
        [structuralCoordinates.piX - 13.6, 53.6],
        [structuralCoordinates.piX - 14.6, 52.2],
      ],
      side > 0 ? 23 : -26.2,
      side > 0 ? 26.2 : -23,
    ),
  );
  return subtract(skin, aux, board, ...returns, ...stack);
}
/** Root a bearing in the wall with a real1:1 inward ramp, not a floating shelf. */
function rootedSector(p: Parameters, start: number, top: number, region: Shape): Shape {
  const inner0 = frameRadius(p, start) - 3;
  const outer = Array.from({ length: 33 }, (_, i) => {
    const z = start + ((top - start) * i) / 32;
    return [frameRadius(p, z) + 0.1, z] as [number, number];
  });
  const inner = outer
    .slice()
    .reverse()
    .map(([, z]) => [Math.max(0, inner0 - (z - start)), z] as [number, number]);
  return {
    kind: 'intersect',
    children: [{ kind: 'revolve', segments: 96, profile: [...outer, ...inner] }, region],
  };
}
function supportedAccessorySaddle(p: Parameters): Shape {
  const original = subtract(
    union(...accessoryFixedFrameAdds(p)),
    box([11.6, 31.5, 13.7], [5, -17, 25.3]),
  );
  return union(
    original,
    rootedSector(p, 3, 25.5, box([10, 25, 22.5], [6.5, -42, 3])),
    rootedSector(p, 3, 25.5, box([10, 30.5, 22.5], [6.5, 14.5, 3])),
    rootedSector(p, 3, 39, box([5.5, 43, 36], [5, -42, 3])),
  );
}
/** Circular tool clearance with a45-degree roof above its untouched round fit. */
function xRoof(
  x: number,
  length: number,
  y: number,
  z: number,
  r: number,
  apexY = y,
  apexZ = z + r * Math.sqrt(2),
): Shape {
  const corner = r / Math.sqrt(2);
  return {
    kind: 'transform',
    translation: [x, 0, 0],
    rotation: [0, 90, 0],
    child: prism(
      [
        [-z - corner, y - corner],
        [-apexZ, apexY],
        [-z - corner, y + corner],
      ],
      length,
      0,
    ),
  };
}
function radialGusset(
  inner: number,
  outer: number,
  front: number,
  width: number,
  angle: number,
  limit: number,
): Shape {
  return {
    kind: 'transform',
    translation: [0, 0, 0],
    rotation: [0, 0, angle],
    child: {
      kind: 'intersect',
      children: [
        acrossY(
          [
            [inner, front],
            [outer, front],
            [outer, front - (outer - inner)],
          ],
          -width / 2,
          width / 2,
        ),
        cylinder(limit, outer - inner + 0.4, [0, 0, front - (outer - inner) - 0.2]),
      ],
    },
  };
}
function frameRadius(p: Parameters, z: number): number {
  // Every forward section can pass back through the cylindrical bayonet throat.
  return Math.min(41.2 + delta(p), radius(p, z) - n(p, 'wall') - 0.3);
}
function hexX(x: number, h: number, across: number, z: number): Shape {
  const r = across / Math.sqrt(3);
  return {
    kind: 'transform',
    rotation: [0, 90, 0],
    translation: [x, 0, z],
    child: prism(
      Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
      }),
      h,
      0,
    ),
  };
}

/** Shared cavity meridian: wall-bearing ribs must use the same linear segments. */
function housingInnerSamples(p: Parameters, outer = radius): [number, number][] {
  const l = n(p, 'noseLength');
  return Array.from({ length: 49 }, (_, i) => {
    const z = l - 11 - ((l - 26) * i) / 48;
    return [outer(p, z) - n(p, 'wall'), z];
  });
}

export function structuralWallContactRibs(p: Parameters): Shape[] {
  const samples = housingInnerSamples(p).reverse(),
    rear = 32,
    front = Math.min(100, n(p, 'noseLength') - 12);
  const at = (z: number): [number, number] => {
    const i = samples.findIndex((point) => point[1] >= z);
    const [r0, z0] = samples[Math.max(0, i - 1)],
      [r1, z1] = samples[Math.max(0, i)];
    return [z0 === z1 ? r0 : r0 + ((r1 - r0) * (z - z0)) / (z1 - z0), z];
  };
  const outside: [number, number][] = [
    at(rear),
    ...samples.filter(([, z]) => z > rear && z < front),
    at(front),
  ];
  return [0, 180, 270].map((angle) => ({
    kind: 'transform',
    translation: [0, 0, 0],
    rotation: [0, 0, angle - 15],
    child: {
      kind: 'revolve',
      segments: 64,
      sweep: 30,
      profile: [
        ...outside,
        ...outside
          .slice()
          .reverse()
          .map(([r, z]) => [r - 3.2, z] as [number, number]),
      ],
    },
  }));
}

export function structuralHousingShape(p: Parameters, outer = radius): Shape {
  const l = n(p, 'noseLength'),
    d = delta(p);
  const outside: [number, number][] = Array.from({ length: 65 }, (_, i) => {
    const z = (l * i) / 64;
    return [outer(p, z), z];
  });
  if (hasOV9281(p)) return opticalHousing(p, outside, d);
  outside.push([13.25, l + 0.6], [13.1, l + 1.4], [12.1, l + 2.4], [11.4, l + 3.4]);
  const neckStart = l - 12.1,
    neckRadius = frameRadius(p, neckStart) + 0.2;
  const inside: [number, number][] = [
    [9.8, l + 3.4],
    [10.5, l + 2.4],
    [11.5, l + 1.4],
    [11.7, l + 1.2],
    [11.7, l - 1.3],
    [12.4, l - 2],
    [12.4, l - 5.8],
    [frameRadius(p, l - 8.8) + 0.2, l - 8.8],
    [neckRadius, neckStart],
    ...housingInnerSamples(p, outer).filter(([, z]) => z < neckStart),
  ];
  inside.push([41.5 + d, 15], [41.5 + d, 0]);
  const body: Shape = { kind: 'revolve', segments: 64, profile: [...outside, ...inside] };
  return subtract(
    body,
    ...[0, 120, 240].flatMap((a) => [
      bodyBayonetSector(d, a, 22, true),
      bodyBayonetSector(d, a + 15.5, 53),
    ]),
    ...windowHousingCuts(p),
    cylinder(1.7, 8, [39 + d, 0, 5], 'x'),
    cylinder(2.9, 6, [42 + d, 0, 5], 'x'),
  );
}

function opticalHousing(p: Parameters, outside: [number, number][], d: number): Shape {
  const l = n(p, 'noseLength'),
    a = opticalLayout(p),
    r = a.crownRadius;
  const body: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [...outside, [r, l + 2.4], [r - 1, l + 3.4], [0, l + 3.4], [0, 0]],
  };
  const inside: [number, number][] = [
    [0, l - 10.4],
    [radius(p, l - 10.4) - n(p, 'wall'), l - 10.4],
    ...housingInnerSamples(p).filter(([, z]) => z < l - 10.4),
    [41.5 + d, 15],
    [41.5 + d, 0],
    [0, 0],
  ];
  // The crown is solid around each socket; the retaining rings release from the rear.
  const socket: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      [0, l - 11],
      [11.7, l - 11],
      [11.7, l + 1.2],
      [11.5, l + 1.4],
      [10.5, l + 2.4],
      [9.8, l + 3.4],
      [0, l + 3.4],
    ],
  };
  return subtract(
    body,
    { kind: 'revolve', segments: 96, profile: inside },
    ...a.windows.flatMap((w) => [socket, ...windowHousingCuts(p)].map((s) => at(s, [w.x, w.y, 0]))),
    ...[0, 120, 240].flatMap((angle) => [
      bodyBayonetSector(d, angle, 22, true),
      bodyBayonetSector(d, angle + 15.5, 53),
    ]),
    cylinder(1.7, 8, [39 + d, 0, 5], 'x'),
    cylinder(2.9, 6, [42 + d, 0, 5], 'x'),
  );
}

/** Broad continuous receivers replace the four isolated socket pedestals. */
function continuousReceiver(
  p: Parameters,
  x: number,
  face: number,
  side: number,
  rear: number,
  front: number,
  backReach: number,
): Shape {
  const shoulder = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2;
  const profile: [number, number][] = [
    [shoulder, rear],
    [shoulder, 0],
    [frameRadius(p, 0), 0],
  ];
  for (let i = 1; i <= 32; i++) {
    const z = (front * i) / 32;
    profile.push([frameRadius(p, z), z]);
  }
  const envelope: Shape = {
    kind: 'revolve',
    segments: 64,
    profile: [...profile, [0, front], [0, rear]],
  };
  const left = Math.min(x - backReach, -5),
    right = Math.max(x + 5, 5);
  return {
    kind: 'intersect',
    children: [
      box([right - left, 48 - face, front - rear], [left, side > 0 ? face : -48, rear]),
      envelope,
    ],
  };
}

export function structuralFrameShape(p: Parameters): Shape {
  const s = n(p, 'shoulderLength'),
    d = delta(p),
    shoulder = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2,
    cam = cameraMountCoordinates(p).rearZ,
    parts: Shape[] = [
      ring(shoulder, shoulder - 3, -s + 2.6, s - 2.6),
      {
        kind: 'revolve',
        segments: 96,
        profile: [
          [shoulder - 3, -1.6],
          [shoulder, -1.6],
          [shoulder, 0],
          [38.2 + d, 0],
        ],
      },
      forwardSkin(p, hasOV9281(p) ? 100.1 : cam + 12.2),
      ...(hasOV9281(p)
        ? [opticalFrameAdds(p)]
        : [petgCameraMountShape(p, frameRadius), frameWindowSupportShape(p, frameRadius)]),
      ...rearCapBosses(p),
      ...rearCableFrameAnchors(p),
      supportedAccessorySaddle(p),
      ...structuralWallContactRibs(p),
    ];
  const a = structuralCoordinatesFor(p);
  for (const [x, face, rear, front, backReach] of [
    [a.piX - 1.07, 30.8, a.piZ - 42.2, a.piZ + 43.6, 11.5],
    [a.upsX - 3, 33.4, -s + 2.6, 6.1, 9.544],
  ])
    for (const side of [-1, 1])
      parts.push(continuousReceiver(p, x, face, side, rear, front, backReach));
  for (const side of [-1, 1])
    parts.push(receiverRearRoot(p, a.piX - 12.57, 5, 30.8, side, a.piZ - 42.2));
  for (const a of [30, 150, 270]) parts.push(bodyBayonetSector(d, a, 20, false, true));
  parts.push({
    kind: 'intersect',
    children: [box([8.3, 10, 12], [33 + d, -5, 0]), cylinder(41.2 + d, 12, [0, 0, 0])],
  });
  parts.push(radialGusset(33 + d, 41.2 + d, 0, 10, 0, shoulder));
  // The body attachments carry rocket weight into the rigid frame, bypassing the TPU cradles.
  for (const angle of structuralBodyAnchorAngles)
    parts.push({
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angle],
      child: {
        kind: 'intersect',
        children: [box([8.8, 12, 14.2], [34 + d, -6, -26]), cylinder(shoulder, 14.2, [0, 0, -26])],
      },
    });
  for (const angle of structuralBodyAnchorAngles)
    parts.push(radialGusset(34 + d, shoulder, -26, 12, angle, shoulder));
  // The service-side barrel remains outside the full R39.2 UPS removal envelope.
  for (const side of [-1, 1]) {
    const rear = a.upsZ - 9.1,
      front = a.upsZ + 8.7;
    parts.push({
      kind: 'intersect',
      children: [
        {
          kind: 'revolve',
          segments: 96,
          profile: [
            [shoulder, rear],
            [shoulder, front],
            [shoulder - 3.6, front],
            [shoulder - 3.6, rear + 0.6],
            [shoulder - 3, rear],
          ],
        },
        box([14, 14.4, front - rear], [17, side > 0 ? 30.6 : -45, rear]),
      ],
    });
  }
  const anchorCuts = structuralBodyAnchorAngles.flatMap((angle) => [
    {
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angle],
      child: cylinder(2.2, 12, [33 + d, 0, -20], 'x'),
    } as Shape,
    {
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angle],
      child: hexX(33.8 + d, 5.5, 7.5, -20),
    } as Shape,
  ]);
  return subtract(
    union(...parts),
    plugReserve(p),
    ...(hasOV9281(p) ? [box([3.1, 58, 4], [-19, -29, 77.5])] : []),
    piPurchasedRearServiceCorridor(p),
    cylinder(1.7, 12, [32 + d, 0, 5], 'x'),
    hexX(32.8 + d, 5.1, 6, 5),
    hexRoofX(32.8 + d, 5.1, 6, 5),
    ...(hasOV9281(p)
      ? [...opticalFrameClearances(p), csiRibbonReserve(p)]
      : [cameraPocketFrameClearanceShape(p, frameRadius), ...cameraMountToolAccessShapes(p)]),
    ...serviceFrameCuts(p, a),
    ...piSideChannelFrameReliefs(p, a),
    ...[-1, 1].map((side) =>
      acrossY(
        [
          [a.piX - 11.2, -s + 2.4],
          [a.piX - 0.2, -s + 2.4],
          [a.piX - 0.2, 74.2],
          [a.piX - 5.7, 80],
          [a.piX - 11.2, 74.2],
        ],
        side > 0 ? 25.8 : -31.3,
        side > 0 ? 31.3 : -25.8,
      ),
    ),
    upsCoverServiceClearanceShape(p, a),
    ...accessoryFixedFrameCuts(p),
    // Thick UPS side walls nest inside the receiver, with broad seating at |Y|33.4.
    ...[-1, 1].map((side) => box([24.4, 3.2, s + 5.9], [-6.2, side > 0 ? 30.2 : -33.4, -s + 2.4])),
    ...[-1, 1].map((side) =>
      acrossX(
        [
          [side * 30.2, 8.1],
          [side * 33.4, 8.1],
          [side * 33.4, 8.3],
          [side * 30.2, 11.5],
        ],
        -6.2,
        18.2,
      ),
    ),
    // Rear-open clearance for the large captive-nut lugs throughout tray withdrawal.
    ...[-1, 1].map((side) =>
      acrossY(
        [
          [-11, -s + 2.4],
          [4.244, -s + 2.4],
          [4.244, -26.8],
          [-3.378, -19],
          [-11, -26.8],
        ],
        side > 0 ? 32.6 : -39.35,
        side > 0 ? 39.35 : -32.6,
      ),
    ),
    // Removable cross pins positively retain the complete UPS cage in flight.
    ...[-upsCrossPinY, upsCrossPinY].map((y) => cylinder(3.15, 14, [-7, y, a.upsZ], 'x')),
    ...[-upsCrossPinY, upsCrossPinY].map((y) => cylinder(4.1, 40, [10, y, a.upsZ], 'x')),
    ...anchorCuts,
    ...structuralBodyAnchorAngles.map(
      (angle) =>
        ({
          kind: 'transform',
          translation: [0, 0, 0],
          rotation: [0, 0, angle],
          child: hexRoofX(33.8 + d, 5.5, 7.5, -20),
        }) as Shape,
    ),
    xRoof(30, 18, -4, 44, 3.1),
    xRoof(32 + d, 12, 0, 5, 1.7),
    ...[-upsCrossPinY, upsCrossPinY].flatMap((y) => [
      xRoof(-7, 14, y, a.upsZ, 3.15, Math.sign(y) * (upsCrossPinY - 0.8), a.upsZ + 5.5),
      xRoof(10, 40, y, a.upsZ, 4.1),
    ]),
    ...structuralBodyAnchorAngles.map(
      (angle) =>
        ({
          kind: 'transform',
          translation: [0, 0, 0],
          rotation: [0, 0, angle],
          child: xRoof(33 + d, 12, 0, -20, 2.2),
        }) as Shape,
    ),
  );
}

export function structuralPieces(p: Parameters, make: NoseFactory) {
  const a = structuralCoordinatesFor(p),
    l = n(p, 'noseLength'),
    d = delta(p),
    items = [];
  const cameraPreset = camera.presets.find((preset) => preset.id === 'imx577-19x19-rear-mipi-m25');
  if (!cameraPreset)
    throw new Error('The fitted rear-MIPI camera library configuration is missing.');
  const printed = (id: string, name: string, shape: Shape, material: string, fixed = false) => {
    const meshBackend = [
      'pi-cradle',
      'rear-cable-grommet',
      'camera-pocket',
      'window-front-seat',
      'window-load-seat',
      'window-retainer',
      'rear-cap',
    ].includes(id)
      ? 'jscad'
      : 'manifold';
    const item = make.custom(
      id,
      name,
      ['load-frame', 'nose-shell'].includes(id) ? consistentRoundSampling(shape) : shape,
      fixed,
      meshBackend,
    );
    item.component.parameters.meshConform = false;
    if (id === 'nose-shell' && hasOV9281(p)) item.component.parameters.printPose = 'front-down';
    if (id === 'load-frame') item.component.parameters.nativeRefine = false;
    item.component.manufacturing = {
      material,
      blank: 'One connected printed body',
      processes: ['printing'],
      requirements: [
        'Measure and qualify printed fits, load paths, impact, thermal exposure and repeated service before use.',
        'Nominal assembled CAD does not simulate elastic assembly or prove load capacity.',
      ],
    };
    if (material.startsWith('TPU')) item.color = 0x466f78;
    return item;
  };
  items.push(
    printed(
      'nose-shell',
      'Ogive housing with internal window and bayonet sockets',
      structuralHousingShape(p, make.outerRadius),
      'PETG structural shell; printed execution to be qualified',
      true,
    ),
    printed(
      'window-retainer',
      'Cassette-backed PETG window retaining ring',
      windowRetainerShape(p),
      'PETG window retaining ring with rear-release bayonet dogs',
      true,
    ),
    printed(
      'window-rear-gasket',
      'Full annular TPU window rear seat',
      windowRearGasketShape(p),
      'TPU full annular window seat; qualified fit required',
      true,
    ),
    printed(
      'window-front-gasket',
      'TPU window front edge cushion',
      windowFrontGasketShape(p),
      'TPU front window edge cushion; qualified fit required',
      true,
    ),
    printed(
      'window-front-seat',
      'Conical PETG front window seat',
      windowFrontSeatShape(p),
      'PETG flat-printed window seat; full conical bearing in the housing',
      true,
    ),
    printed(
      'window-load-seat',
      'Conical PETG rear window load seat',
      windowLoadSeatShape(p),
      'PETG flat-printed annular load seat; full conical bearing in the frame',
    ),
    make.occurrence(
      dome,
      'optical-window',
      'D23 / D17 optical dome window',
      { ...dome.defaults },
      [0, 0, l],
      [0, 0, 0],
      true,
    ),
    printed(
      'load-frame',
      'Conformal PETG load frame',
      structuralFrameShape(p),
      'PETG structural frame; print and loads to be qualified',
    ),
    printed(
      'pi-cradle',
      'Fitted TPU Pi and NVMe cradle',
      reinforcedPiCradleShape(p, a),
      'TPU fitted board cradle; hardness and fits to be qualified',
    ),
    printed(
      'ups-cradle',
      'Fitted TPU UPS cradle',
      reinforcedUPSCradleShape(p, a),
      'TPU fitted UPS cradle; hardness and fits to be qualified',
    ),
    printed(
      'ups-cell-cover',
      'Reinforced removable TPU cell cover',
      upsCellCoverShape(p, a),
      'TPU structural cell cover; captured by two outboard cross bolts',
    ),
    printed(
      'camera-pocket',
      'Rear-open TPU camera isolation pocket',
      tpuCameraPocketShape(p, box([18.4, 20.4, 35.4], [a.piX - 1.2, 7.55, a.piZ + 45.35])),
      'TPU camera pocket; fits, seating and elastic service travel to be qualified',
    ),
    printed(
      'rear-cap',
      'Flush PETG rear cable cap with closed center',
      rearCapShape(p),
      'PETG rear closure; fastened to captive M3 prevailing-torque nuts',
    ),
    printed(
      'rear-cable-grommet',
      'Linked TPU D6 rear cable feedthroughs',
      rearCableGrommetShape(p),
      'TPU cable edge protection; positively flanged and linked',
    ),
    make.screw('cassette-lock-screw', 3, 10, [42 + d, 0, 5], 'x', true),
    make.lockNut('cassette-lock-nut', 3, [35.9 + d, 0, 5], '-x'),
    make.occurrence(
      pi,
      'pi5',
      'Raspberry Pi 5',
      { model: 'raspberry-pi-5', detail: 'lightweight' },
      [a.piX, 0, a.piZ],
      a.piRotation,
    ),
    make.occurrence(
      adapter,
      'nvme-adapter',
      'Waveshare PCIe TO M.2 Board (D)',
      { ...adapter.defaults },
      [a.adapterX, 0.25, a.piZ],
      [180, 90, 0],
    ),
    make.occurrence(
      ups,
      'ups3s',
      'Waveshare UPS Module 3S',
      { ...ups.defaults },
      [a.upsX, 0, a.upsZ],
      [0, -90, 0],
    ),
    make.occurrence(
      ssd,
      'nvme-ssd',
      'M.2 2280 NVMe module',
      { format: '2280' },
      [a.ssdX, -9.7, a.piZ + 2.5],
      [180, 90, 0],
    ),
    make.sleeve('ssd-screw-washer', 4, 2.2, 1, [a.ssdX - 1.5, -9.7, a.piZ + 42.5], 'x'),
    make.screw('ssd-retention-screw', 2, 4, [a.ssdX - 2, -9.7, a.piZ + 42.5], '-x'),
    make.occurrence(
      camera,
      'csi-camera',
      '19 mm CSI camera body',
      { ...cameraPreset.parameters },
      [0, 0, cameraMountCoordinates(p).rearZ],
      [0, 0, 0],
      false,
      cameraPreset,
    ),
  );
  for (const part of accessoryPrintedParts(p)) {
    const item = printed(part.id, part.name, part.shape, part.material);
    item.component.parameters.meshBackend = part.backend;
    item.component.manufacturing!.requirements.push(...accessoryServiceSpec(p).requirements);
    items.push(item);
  }
  for (const specification of accessoryDeviceSpecs) {
    const definition = [gps, finder].find((part) => part.id === specification.libraryId);
    if (!definition) throw new Error('Missing accessory library: ' + specification.libraryId);
    const selected = definition.presets.find((preset) => preset.id === specification.presetId);
    if (!selected) throw new Error('Missing accessory preset: ' + specification.presetId);
    items.push(
      make.occurrence(
        definition,
        specification.id,
        definition.name,
        specification.parameters,
        specification.translation,
        specification.rotation,
        false,
        selected,
      ),
    );
  }
  for (const mount of accessoryHardwareSpecs(p)) {
    const item =
      mount.type === 'screw'
        ? make.screw(mount.id, mount.diameter, mount.length!, mount.bearing!, mount.axis)
        : mount.type === 'nut'
          ? make.lockNut(mount.id, mount.diameter, mount.center!, mount.axis)
          : make.washer(
              mount.id,
              mount.outerDiameter!,
              mount.bore!,
              mount.thickness!,
              mount.center!,
              mount.axis,
            );
    items.push(item);
  }
  const cameraMounts = cameraFastenerMounts(p);
  const cameraButton = bolt.presets.find((candidate) => candidate.id === cameraScrewPreset);
  if (!cameraButton) throw new Error('The required M2.5x8 button camera screw preset is missing.');
  for (const mount of cameraMounts.screws) {
    const side = mount.axis === 'x' ? 1 : -1,
      offset = (mount.length - Number(cameraButton.parameters.headHeight)) / 2;
    const item = make.occurrence(
      bolt,
      mount.id,
      'M2.5x8 button camera screw · qualified factory nylon patch required',
      { ...cameraButton.parameters },
      [mount.bearing[0] - side * offset, mount.bearing[1], mount.bearing[2]],
      [0, side * 90, 0],
      false,
      cameraButton,
    );
    item.component.notes = cameraMountRequirements.join(' ');
    if (item.component.procurement)
      item.component.procurement.designation +=
        ' · qualified factory nylon patch required; catalogue geometry alone is not the patched execution';
    items.push(item);
  }
  for (const mount of cameraMounts.sleeves) {
    const item = (mount.type === 'washer' ? make.washer : make.sleeve)(
      mount.id,
      mount.outerDiameter,
      mount.bore,
      mount.length,
      mount.center,
      mount.axis,
    );
    item.component.manufacturing = {
      material: 'Steel compression tube or pressure washer; select a compatible finished component',
      blank: 'Precision round spacer stock',
      processes: ['turning', 'cutting', 'drilling'],
      requirements: [...cameraMountRequirements],
    };
    items.push(item);
  }
  for (const mount of equipmentFastenerMounts(p, a)) {
    const item =
      mount.type === 'screw'
        ? make.screw(mount.id, mount.diameter, mount.length, mount.bearing, mount.axis)
        : mount.type === 'nut'
          ? make.lockNut(mount.id, mount.diameter, mount.center, mount.axis)
          : mount.type === 'washer'
            ? make.washer(
                mount.id,
                mount.outerDiameter,
                mount.bore,
                mount.thickness,
                mount.center,
                mount.axis,
              )
            : make.sleeve(
                mount.id,
                mount.outerDiameter,
                mount.bore,
                mount.length,
                mount.center,
                mount.axis,
              );
    item.component.notes =
      (item.component.notes ?? '') +
      (mount.removeForTrayService
        ? ' Remove this UPS cross-pin stack before withdrawing the UPS tray. It positively restrains the cage in the installed frame.'
        : ' Compression-limited reinforced electronics mounting stack; verify fit and fastening torque.');
    if (mount.type === 'tube' && item.component.manufacturing)
      item.component.manufacturing.material =
        'Metal compression limiter; select qualified finished stock and end-face tolerances';
    items.push(item);
  }
  const capScrew = bolt.presets.find((candidate) => candidate.id === rearCapScrewPreset);
  if (!capScrew) throw new Error('The M3x16 DIN7991 rear-cap screw is missing.');
  for (const mount of rearCapFastenerMounts(p)) {
    const capNut = make.lockNut(`${mount.id}-nut`, 3, mount.nutCenter, 'z');
    capNut.component.placement.rotation[2] = mount.angle;
    items.push(
      make.occurrence(
        bolt,
        `${mount.id}-screw`,
        'M3x16 DIN7991 flush rear-cap screw',
        { ...capScrew.parameters },
        [mount.x, mount.y, mount.boltBearing[2] + mount.screwLength / 2],
        [180, 0, 0],
        false,
        capScrew,
      ),
      capNut,
    );
  }
  for (const [i, y] of [-19.5, 0, 19.5].entries())
    items.push(
      make.occurrence(
        cell,
        `ups-cell-${i}`,
        'Molicel P28A 18650 cell',
        { model: 'molicel-p28a' },
        [a.upsX + 11.4, y, a.upsZ - 32.6],
        [0, 0, 0],
      ),
    );
  for (const angle of structuralBodyAnchorAngles) {
    const item = make.lockNut(`body-anchor-nut-${angle}`, 4, [36.8 + d, 0, -20], '-x');
    const [x, y, z] = item.component.placement.translation,
      rad = (angle * Math.PI) / 180;
    item.component.placement.translation = [
      x * Math.cos(rad) - y * Math.sin(rad),
      x * Math.sin(rad) + y * Math.cos(rad),
      z,
    ];
    item.component.placement.rotation = [0, -90, angle];
    items.push(item);
  }
  for (const item of items) {
    if (
      ['rear-cap', 'rear-cable-grommet', 'load-frame'].includes(item.component.id) &&
      item.component.manufacturing
    )
      item.component.manufacturing.requirements.push(...rearCableRequirements);
    if (item.component.id.startsWith('window-') && item.component.manufacturing)
      item.component.manufacturing.requirements.push(...windowMountRequirements);
    if (item.component.id.startsWith('camera-') && item.component.manufacturing)
      item.component.manufacturing.requirements = [
        ...new Set([...item.component.manufacturing.requirements, ...cameraMountRequirements]),
      ];
    if (item.component.id === 'ssd-retention-screw')
      item.component.notes +=
        ' Use a serviceable prevailing-torque factory patch compatible with the M2 metal adapter thread; no generic chemical threadlocker is specified.';
  }
  if (hasOV9281(p)) {
    const a = opticalLayout(p);
    const remove = new Set([
      'window-retainer',
      'window-rear-gasket',
      'window-front-gasket',
      'window-front-seat',
      'window-load-seat',
      'optical-window',
      'camera-pocket',
    ]);
    const kept = items.filter(
      (item) =>
        !remove.has(item.component.id) &&
        (a.dual ||
          !(item.component.id === 'csi-camera' || item.component.id.startsWith('camera-'))),
    );
    if (a.dual)
      for (const item of kept)
        if (item.component.id === 'csi-camera' || item.component.id.startsWith('camera-')) {
          const v = item.component.placement.translation;
          item.component.placement.translation = [v[1] - 15, -v[0] - 5, v[2]];
          item.component.placement.rotation[2] -= 90;
        }
    return [...kept, ...opticalModulePieces(p, make)];
  }
  return items;
}
