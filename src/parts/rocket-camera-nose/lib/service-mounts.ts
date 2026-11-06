import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { equipmentRailSpecs, equipmentRailClearanceShape } from './equipment-mounts';
import { rearCableCapBosses, rearCableCapCuts } from './cable-feedthroughs';

export interface ServiceMountCoordinates {
  piX: number;
  piZ: number;
  adapterX: number;
  upsX: number;
  upsZ: number;
}

type Vec = [number, number, number];
export const rearCapScrewPreset = 'gvyntok-040-070-007';

export interface RearCapFastenerMount {
  id: string;
  angle: number;
  x: number;
  y: number;
  boltBearing: Vec;
  nutCenter: Vec;
  screwLength: number;
  shaftDiameter: number;
  nutAcrossFlats: number;
  nutHeight: number;
}

/** Axial M3 fasteners keep their heads inside the existing rear Z datum. */
export function rearCapFastenerMounts(p: Parameters): RearCapFastenerMount[] {
  const rear = -n(p, 'shoulderLength'),
    radius = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 4.8;
  return [0, 145.5, 214.5].map((angle, index) => {
    const radians = (angle * Math.PI) / 180,
      x = radius * Math.cos(radians),
      y = radius * Math.sin(radians);
    return {
      id: `rear-cap-${index}`,
      angle,
      x,
      y,
      // Countersunk length is measured overall: its rear head face is exactly flush.
      boltBearing: [x, y, rear],
      nutCenter: [x, y, rear + 13.2],
      screwLength: 16,
      shaftDiameter: 3.3,
      nutAcrossFlats: 6,
      nutHeight: 4,
    };
  });
}

/** Fuse these bosses into the frame, then apply serviceFrameCuts to that union. */
export function rearCapBosses(p: Parameters): Shape[] {
  const rear = -n(p, 'shoulderLength'),
    outer = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2;
  return rearCapFastenerMounts(p).map(({ x, y }): Shape => ({
    kind: 'intersect',
    children: [
      cylinder(5.5, 11.2, [x, y, rear + 5]),
      {
        kind: 'revolve',
        segments: 96,
        profile: [
          [outer, rear + 5],
          [outer, rear + 16.2],
          [outer - 10.3, rear + 16.2],
          [outer - 10.3, rear + 12.3],
          [outer - 3, rear + 5],
        ],
      },
    ],
  }));
}

function nutPocket(x: number, y: number, z: number, height: number, clock = 0): Shape {
  const radius = 6 / Math.sqrt(3);
  return prism(
    Array.from({ length: 6 }, (_, index) => {
      const angle = Math.PI / 6 + (index * Math.PI) / 3 + (clock * Math.PI) / 180;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)] as [number, number];
    }),
    height,
    z,
  );
}

/** Rear-open T-slots let complete TPU trays translate out without pinching blind heads. */
export function serviceFrameCuts(p: Parameters, coords: ServiceMountCoordinates): Shape[] {
  const rear = -n(p, 'shoulderLength'),
    cuts: Shape[] = [];
  for (const { x, y, angle } of rearCapFastenerMounts(p)) {
    cuts.push(
      // The substantial conical cap seat ends 0.2 mm below this recess.
      cylinder(5.7, 2.6, [x, y, rear + 2.4]),
      // The cap recess closes on a 45-degree cone, leaving 2.15 mm below the nut floor.
      {
        kind: 'transform',
        translation: [x, y, 0],
        rotation: [0, 0, 33],
        child: {
          kind: 'revolve',
          segments: 96,
          profile: [
            [0, rear + 4.8],
            [5.7, rear + 4.8],
            [5.7, rear + 5],
            [1.65, rear + 9.05],
            [0, rear + 9.05],
          ],
        },
      },
      // A circular cutter with a displaced native seam avoids the coincident axial BRep seam.
      {
        kind: 'transform',
        translation: [x, y, rear + 2.4],
        rotation: [0, 0, 33],
        child: cylinder(1.65, 15, [0, 0, 0]),
      },
      // The hex seat opens inward for radial nut loading before either tray is installed.
      nutPocket(x, y, rear + 11.2, 5.2, angle),
      // An empty conical crown closes above the nut and screw tip without a flat bridge.
      {
        kind: 'transform',
        translation: [x, y, 0],
        rotation: [0, 0, 33],
        child: {
          kind: 'revolve',
          segments: 96,
          profile: [
            [0, rear + 16.2],
            [3.7, rear + 16.2],
            [0, rear + 19.9],
          ],
        },
      },
    );
  }
  for (const rail of equipmentRailSpecs(p, coords)) {
    cuts.push(
      equipmentRailClearanceShape({ ...rail, zMin: rear - 0.2, zMax: rail.zMax + 0.2 }, 0.2),
    );
    for (const side of [-1, 1]) {
      const stemHalf = rail.stemWidth / 2 + 0.2,
        headHalf = rail.headWidth / 2 + 0.2,
        lowY = rail.stemY[0] - 0.2,
        highY = rail.headY[1] + 0.2,
        z = rail.zMax + 0.15,
        centerY = lowY + ((highY - lowY) * (stemHalf + 2 * headHalf)) / (3 * (stemHalf + headHalf));
      const base: Vec[] = [
        [rail.centerX - stemHalf, side * lowY, z],
        [rail.centerX + stemHalf, side * lowY, z],
        [rail.centerX + headHalf, side * highY, z],
        [rail.centerX - headHalf, side * highY, z],
      ];
      if (side < 0) base.reverse();
      const height =
        Math.max(...base.map(([x, y]) => Math.hypot(x - rail.centerX, y - side * centerY))) + 0.05;
      // A closed pyramid closes every slot edge on a slope of at least 45 degrees.
      cuts.push({
        kind: 'boundary',
        points: [...base, [rail.centerX, side * centerY, z + height]],
        faces: [
          [3, 2, 1, 0],
          [0, 1, 4],
          [1, 2, 4],
          [2, 3, 4],
          [3, 0, 4],
        ],
      });
    }
  }
  return cuts;
}

/** Flush countersunk heads seat on exact 90 degree cones, backed by substantial pads. */
export function rearCapShape(p: Parameters): Shape {
  const rear = -n(p, 'shoulderLength'),
    radius = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 0.2,
    mounts = rearCapFastenerMounts(p);
  return subtract(
    {
      kind: 'intersect',
      children: [
        union(
          cylinder(radius, 2.6, [0, 0, rear]),
          ...mounts.map(({ x, y }) => cylinder(5.5, 4.8, [x, y, rear])),
          ...rearCableCapBosses(p),
        ),
        cylinder(radius, 9, [0, 0, rear]),
      ],
    },
    ...rearCableCapCuts(p),
    ...mounts.flatMap(({ x, y }) => [
      {
        kind: 'transform',
        translation: [x, y, 0],
        rotation: [0, 0, 0],
        child: {
          kind: 'revolve',
          segments: 64,
          profile: [
            [0, rear - 0.1],
            [3, rear - 0.1],
            [3, rear + 0.2],
            [1.5, rear + 1.7],
            [0, rear + 1.7],
          ],
        },
      } as Shape,
      cylinder(1.65, 5.2, [x, y, rear - 0.1]),
    ]),
  );
}
