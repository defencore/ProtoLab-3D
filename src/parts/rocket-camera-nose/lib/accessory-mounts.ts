import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
type Vec = [number, number, number];
const b = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Shape =>
  box([x1 - x0, y1 - y0, z1 - z0], [x0, y0, z0]);
const clip = (shape: Shape, tool: Shape): Shape => ({ kind: 'intersect', children: [shape, tool] });
export const accessoryCoordinates = {
  gps: { translation: [13.5, -17.5, 48.5] as Vec, rotation: [0, 90, 0] as Vec },
  buzzer: { translation: [22, 3, 42.5] as Vec, rotation: [0, -90, -90] as Vec },
  clamp: { x: 26.8, y: -4, z: 44 },
};
export const accessoryDeviceSpecs = [
  {
    id: 'aux-gps',
    libraryId: 'gps-tracker',
    presetId: 'zx908',
    parameters: { model: 'zx908' },
    state: 'assembled',
    ...accessoryCoordinates.gps,
  },
  {
    id: 'aux-buzzer',
    libraryId: 'jhe42b-finder',
    presetId: 'jhe42b',
    parameters: { model: 'jhe42b' },
    state: 'default',
    ...accessoryCoordinates.buzzer,
  },
];
export interface AccessoryPrintedPart {
  id: string;
  name: string;
  material: 'TPU';
  shape: Shape;
  backend: 'manifold';
}
function bedShape(): Shape {
  const backing = union(
    b(10.5, 13.5, -30.7, 23.2, 27.8, 57.2),
    b(10.5, 13.5, -30.7, -4.3, 57.2, 69.2),
  );
  const gpsRim = subtract(
    b(13.5, 16.5, -30.7, -4.3, 27.8, 69.2),
    b(13.4, 17, -27.7, -7.3, 30.8, 66.2),
  );
  const buzzerRim = subtract(
    b(13.5, 16.5, -0.2, 23.2, 27.8, 57.2),
    b(13.4, 17, 2.8, 20.2, 30.8, 54.2),
    b(13.4, 17, 5, 18.5, 53.8, 58),
    b(13.4, 17, 20, 24, 32, 53),
  );
  return subtract(
    union(backing, gpsRim, buzzerRim, b(13.5, 23, -7, -1, 40, 48)),
    cylinder(1.7, 25, [5, -4, 44], 'x'),
  );
}
function clampShape(): Shape {
  return subtract(
    {
      kind: 'prism',
      axis: 'z',
      origin: 40,
      depth: 8,
      points: [
        [16.5, -10],
        [26, -10],
        [26, -0.3],
        [33.5, -0.3],
        [33.5, 6.5],
        [30.5, 6.5],
        [30.5, 2.8],
        [23, 2.8],
        [23, -7.3],
        [14.8, -7.3],
        [14.8, -9.3],
        [16.5, -9.3],
      ],
    },
    cylinder(1.7, 25, [5, -4, 44], 'x'),
  );
}
export function accessoryPrintedParts(_p: Parameters): AccessoryPrintedPart[] {
  return [
    {
      id: 'aux-bed',
      name: 'Common flat TPU finder bed',
      material: 'TPU',
      backend: 'manifold',
      shape: bedShape(),
    },
    {
      id: 'aux-clamp',
      name: 'Flat printed TPU clamp strap',
      material: 'TPU',
      backend: 'manifold',
      shape: clampShape(),
    },
  ];
}
function frameEnvelope(p: Parameters): Shape {
  const base = n(p, 'tubeOD') / 2,
    rise = base - 13.4,
    rho = (n(p, 'noseLength') ** 2 + rise ** 2) / (2 * rise);
  const points: [number, number][] = Array.from({ length: 17 }, (_, i) => {
    const z = 25.5 + (i * 23.5) / 16;
    return [Math.min(41.2, Math.sqrt(rho ** 2 - z ** 2) + base - rho - n(p, 'wall') - 0.3), z];
  });
  return { kind: 'revolve', segments: 64, profile: [[0, 25.5], ...points, [0, 49]] };
}
export function accessoryFixedFrameAdds(p: Parameters): Shape[] {
  return [
    clip(
      union(
        b(6.5, 10.5, -42, -1, 27.8, 48),
        b(5, 10.5, -9, 1, 39, 49),
        b(10.5, 16.5, -30.7, 23.2, 25.5, 27.8),
        b(6.5, 10.5, -42, 23.2, 25.5, 35),
      ),
      frameEnvelope(p),
    ),
  ];
}
export function accessoryFixedFrameCuts(_p: Parameters): Shape[] {
  return [
    cylinder(1.7, 8, [4, -4, 44], 'x'),
    cylinder(3.1, 18, [30, -4, 44], 'x'),
    {
      kind: 'transform',
      translation: [6.3, -4, 44],
      rotation: [0, 90, 0],
      child: {
        kind: 'prism',
        points: Array.from({ length: 6 }, (_, i) => [
          3.64 * Math.cos(((i * 60 + 30) * Math.PI) / 180),
          3.64 * Math.sin(((i * 60 + 30) * Math.PI) / 180),
        ]),
        depth: 4.2,
        origin: 0,
        axis: 'z',
      },
    },
  ];
}
export function accessoryHardwareSpecs(_p: Parameters) {
  return [
    {
      id: 'aux-clamp-screw',
      type: 'screw' as const,
      axis: 'x' as const,
      diameter: 3,
      length: 22,
      bearing: [26.8, -4, 44] as Vec,
      fixed: false,
    },
    {
      id: 'aux-clamp-nut',
      type: 'nut' as const,
      axis: 'x' as const,
      diameter: 3,
      center: [8.5, -4, 44] as Vec,
      fixed: true,
    },
    {
      id: 'aux-clamp-washer',
      type: 'washer' as const,
      axis: 'x' as const,
      outerDiameter: 7,
      bore: 3.2,
      thickness: 0.8,
      center: [26.4, -4, 44] as Vec,
      fixed: false,
    },
  ];
}
export function accessoryServiceSpec(_p: Parameters) {
  const devices = ['aux-gps', 'aux-buzzer'],
    prints = ['aux-bed', 'aux-clamp'];
  const group = [...prints, ...devices, 'aux-clamp-washer'];
  return {
    caseIds: prints,
    carrierGroupIds: group,
    carrierDirection: '+Y',
    carrierTravel: 80,
    carrierRemovedBefore: ['aux-clamp-screw'],
    hardwareIds: ['aux-clamp-screw', 'aux-clamp-nut', 'aux-clamp-washer'],
    seatedContactGroups: devices.map((deviceId) => ({
      id: deviceId + '-soft-seat',
      deviceId,
      softIds: prints,
    })),
    installedCaptureGroups: [
      { id: 'complete-bed', componentIds: [...prints, ...devices] },
      { id: 'bed', componentIds: ['aux-bed'] },
      { id: 'clamp', componentIds: ['aux-clamp'] },
    ],
    stages: [
      {
        id: 'remove-single-clamp-screw',
        movingIds: ['aux-clamp-screw'],
        direction: '+X',
        travel: 50,
        removeAfter: true,
      },
      {
        id: 'withdraw-complete-bed',
        movingIds: group,
        direction: '+Y',
        travel: 80,
        removeAfter: false,
      },
      {
        id: 'remove-washer',
        movingIds: ['aux-clamp-washer'],
        direction: '+X',
        travel: 8,
        removeAfter: true,
      },
      {
        id: 'lift-clamp-strap',
        movingIds: ['aux-clamp'],
        direction: '+X',
        travel: 25,
        removeAfter: true,
      },
      { id: 'lift-gps', movingIds: ['aux-gps'], direction: '+X', travel: 25, removeAfter: true },
      {
        id: 'lift-buzzer',
        movingIds: ['aux-buzzer'],
        direction: '+X',
        travel: 25,
        removeAfter: true,
      },
    ],
    maintenanceCableDisconnections: [
      'Disconnect the selected finder/GPS service leads before withdrawing the common bed; keep their service loops fixed to the frame.',
    ],
    requirements: [
      'One common flat bed and one flat-profile strap, both TPU. Straight shallow locating walls, no undercuts, keys, closed shell or long clamp post.',
      'Bed backing is 3 mm thick and its locating rims are 3 mm high. Strap is an 8 mm-wide extrusion of a simple stepped outline and prints flat on that broad face.',
      'One M3x22 screw, wide M3 washer and nylon insert nut form the single clamp point. Nominal contacts do not simulate TPU compression or establish a tightening torque/load rating.',
      'GPS uses the existing35x20x4.5 reference. JHE42B is confirmed; exact real control and connector positions still need checking against the open faces.',
      'The bed supports the two auxiliary devices only; it is not a recovery anchor.',
    ],
  };
}
export function accessoryServiceKeepouts(
  _p: Parameters,
): { id: string; shape: Shape; intendedContactIds: string[] }[] {
  return [
    {
      id: 'aux-gps-antenna',
      shape: b(15.05, 35, -24.7, -10.3, 49.8, 64.4),
      intendedContactIds: ['aux-gps'],
    },
    {
      id: 'aux-buzzer-front-service',
      shape: b(14.3, 29.7, 20, 70, 32, 53),
      intendedContactIds: ['aux-buzzer'],
    },
    {
      id: 'aux-buzzer-connector-end',
      shape: b(14.3, 29.7, 5, 18.5, 54, 64),
      intendedContactIds: ['aux-buzzer'],
    },
  ];
}
export function accessoryDriverKeepouts(_p: Parameters) {
  return [
    {
      id: 'aux-clamp-driver',
      shape: cylinder(2.1, 20.2, [29.8, -4, 44], 'x'),
      intendedContactIds: ['aux-clamp-screw'],
    },
  ];
}
