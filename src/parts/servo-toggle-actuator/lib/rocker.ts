import { Euler, Quaternion, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
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
import { screw, hexNut } from './hardware';
import type { DetailSpec } from './types';

const rad = Math.PI / 180;
const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const rockerLayout = (p: Parameters) => ({
  switchZ: Number(p.deckHeight),
  axisZ: Number(p.deckHeight) + 12.5,
  servoY: 51.7,
});

/** Rounded noses contact the reconstructed lever tangentially; no forced rigid overlap. */
export function rockerKinematics(p: Parameters) {
  const a = 10.3,
    h = 12,
    radius = 3;
  const contactAngle =
    (Math.atan2(a, h) + 12 * rad - Math.asin((3.5 + radius) / Math.hypot(a, h))) / rad;
  const direction = p.phase === 'press-on' ? 1 : p.phase === 'press-off' ? -1 : 0;
  return {
    servoAngle: -direction * contactAngle,
    rockerAngle: direction * contactAngle,
    contactAngle,
    direction,
    slide: 0,
    travel: 0,
    workingStroke: 0,
    maxPadCompression: 0,
    neutralClearance: a * Math.cos(12 * rad) - h * Math.sin(12 * rad) - (3.5 + radius),
    switchPosition: p.phase === 'on' || p.phase === 'press-on' ? 'last' : 'first',
  };
}

function nutPocket(x: number, y: number, z: number): Shape {
  const r = 5.8 / Math.sqrt(3);
  return pose(
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => [
        r * Math.cos(((i + 0.5) * Math.PI) / 3),
        r * Math.sin(((i + 0.5) * Math.PI) / 3),
      ]),
      2.6,
      0,
    ),
    [x, y, z],
    [90, 0, 0],
  );
}

export function rockerDetails(p: Parameters): DetailSpec[] {
  const m = rockerLayout(p),
    k = rockerKinematics(p),
    z = m.axisZ;
  const L = Number(p.baseLength),
    W = Number(p.baseWidth);
  const slot = (x: number, y: number) =>
    union(
      box([8, 4.5, 8], [x - 4, y - 2.25, -1]),
      cylinder(2.25, 8, [x - 4, y, -1]),
      cylinder(2.25, 8, [x + 4, y, -1]),
    );
  const tieCuts = [-18, 18].flatMap((dz) => [
    cylinder(1.7, 48, [25, 13, z + dz], 'y'),
    nutPocket(25, 16.7, z + dz),
  ]);
  const panelHole = subtract(
    cylinder(6.1, 5, [0, 0, m.switchZ + 2]),
    box([1, 1.9, 7], [-6.2, -0.95, m.switchZ + 1]),
  );
  const base = subtract(
    union(
      box([L, W, 6], [12 - L / 2, 21 - W / 2, 0]),
      // Open-sided keyed switch panel and two narrow piers leave the terminals accessible.
      box([38, 24, 3], [-19, -12, m.switchZ + 3]),
      ...[-19, 15.5].map((x) => box([3.5, 24, m.switchZ - 2.9], [x, -12, 6])),
      // Low cradle lips locate the case while leaving its ends open for cable access.
      ...[-14, 35.4].map((x) => box([3.6, 28, z - 16], [x, 23, 6])),
      ...[24, 47].map((y) => box([53, 4, z - 18.5], [-14, y, 6])),
      // Positive-X reaction wall avoids the swept output disc and finger envelope.
      box([11, 5.6, z + 18], [20, 14.1, 6]),
      ...[-11, 9].map((dz) => box([8, 1.5, 2], [19, 19.7, z + dz])),
    ),
    panelHole,
    box([12, 10, 6], [-25, -5, m.switchZ - 6]),
    ...tieCuts,
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => slot(12 + sx * (L / 2 - 10), 21 + sy * (W / 2 - 8))),
    ),
  );
  const clamp = subtract(
    union(
      box([12, 3, 48], [19, 55.7, z - 24]),
      ...[-11, 9.5].map((dz) => box([8, 2.5, 1.5], [19, 53.2, z + dz])),
    ),
    ...[-18, 18].map((dz) => cylinder(1.7, 8, [25, 52, z + dz], 'y')),
  );
  const fork = pose(
    subtract(
      union(
        cylinder(13, 4, [0, 14, 0], 'y'),
        box([26.6, 4, 8], [-13.3, 14, 8]),
        ...[-10.3, 10.3].map((x) => cylinder(3, 22, [x, -4, 12], 'y')),
      ),
      cylinder(4, 6, [0, 13, 0], 'y'),
      ...[
        [7, 0],
        [0, 7],
        [-7, 0],
        [0, -7],
      ].map(([x, zz]) => cylinder(0.95, 6, [x, 13, zz], 'y')),
    ),
    [0, 0, z],
    [0, k.rockerAngle, 0],
  );
  const make = (
    id: string,
    label: string,
    shape: Shape,
    blank: string,
    color: number,
    requirements: string[],
  ): DetailSpec => ({
    id,
    label,
    shape,
    color,
    material: 'PETG or PA; qualify the printed prototype',
    blank,
    processes: ['printing', 'drilling'],
    requirements,
  });
  return [
    make(
      'printed-base',
      'Printed base with servo cradle and switch panel',
      base,
      `${L} × ${W} mm footprint; integrated 6 mm mounting floor`,
      0x526477,
      [
        'Print the floor flat; use removable supports beneath the switch panel. At least 5 perimeters and local solid regions at clamp and mounting holes are starting print settings, subject to physical qualification.',
        'Fit the keyed diameter 12.2 mm switch opening. The source M12 nuts clamp the 3 mm printed panel at case datum +3 to +6 mm.',
        'Clearance-fit the servo case and use two M3 through ties with captured hexagon nuts. Smooth contact pads and tighten progressively without distorting the case.',
        'Four 12.5 × 4.5 mm mounting slots accept M4 through hardware selected for the enclosure wall or plate thickness; mounting hardware is not included.',
      ],
    ),
    make(
      'printed-clamp',
      'Printed servo rear clamp',
      clamp,
      '12 × 48 mm web, 3 mm thick with integral contact pads',
      0x73889c,
      [
        'Print the broad rear face flat. The two inset 8 × 1.5 mm pads meet measured source case patches; relieve for the rear disc and projections.',
        'Two ordinary M3 × 45 mm ties clamp front and rear pads across the nominal 32 mm case contact spacing. Adjust the pads to the actual case before tightening.',
      ],
    ),
    make(
      'printed-rocker',
      'Printed two-finger rocker',
      fork,
      'Diameter 26 × 4 mm hub with two diameter 6 × 22 mm rounded fingers',
      0xe7a34a,
      [
        'Print the disc mating face flat, fingers pointing upward. Ream the four diameter 1.9 mm mounting holes after printing.',
        'Attach to the unchanged supplier diameter 19.2 mm disc with four M1.6 × 8 mm screws and AF3.2 × 1.3 mm nuts; keep nut flats radial to clear the central hub. Retain the supplied shaft fastener.',
        'The rounded fingers push alternately, then return to neutral. They do not clamp the lever. Calibrate the endpoints, speed and torque limit against the delivered switch; its actual pivot and actuation force are unpublished.',
      ],
    ),
  ];
}

export function rockerHardware(p: Parameters): ConfiguredPiece[] {
  const m = rockerLayout(p),
    k = rockerKinematics(p),
    result: ConfiguredPiece[] = [];
  for (const dz of [-18, 18]) {
    result.push(screw(`clamp-tie-${dz}`, 3, 45, [25, 58.7, m.axisZ + dz], [-90, 0, 0]));
    result.push(hexNut(`clamp-nut-${dz}`, 3, 5.5, 2.4, [25, 16.7, m.axisZ + dz], [90, 0, 0]));
  }
  const q = new Quaternion()
    .setFromEuler(new Euler(Math.PI / 2, 0, 0, 'ZYX'))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), k.servoAngle * rad));
  const installed = (piece: ConfiguredPiece): ConfiguredPiece => {
    const t = new Vector3(...piece.component.placement!.translation)
      .applyQuaternion(q)
      .add(new Vector3(0, m.servoY, m.axisZ));
    const r = piece.component.placement!.rotation;
    const qr = new Quaternion().setFromEuler(new Euler(...(r.map((v) => v * rad) as Vec), 'ZYX'));
    const e = new Euler().setFromQuaternion(q.clone().multiply(qr), 'ZYX');
    piece.component.placement = {
      translation: t.toArray() as Vec,
      rotation: [e.x / rad, e.y / rad, e.z / rad],
    };
    return piece;
  };
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      x = 7 * Math.cos(a),
      y = 7 * Math.sin(a);
    result.push(installed(screw(`rocker-disc-screw-${i + 1}`, 1.6, 8, [x, y, 37.7])));
    result.push(
      installed(hexNut(`rocker-disc-nut-${i + 1}`, 1.6, 3.2, 1.3, [x, y, 29.9], [0, 0, i * 90])),
    );
  }
  return result;
}
