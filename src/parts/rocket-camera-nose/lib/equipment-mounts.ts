import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { structuralBodyAnchorAngles } from './body-anchors';
import nyloc from '../../nyloc-nut/part';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';

type Vec = [number, number, number];
export interface EquipmentCoordinates {
  piX: number;
  piZ: number;
  adapterX: number;
  ssdX?: number;
  upsX: number;
  upsZ: number;
}
export interface EquipmentRailSpec {
  id: 'pi' | 'ups';
  centerX: number;
  contactY: number;
  stemWidth: number;
  stemY: [number, number];
  headWidth: number;
  headY: [number, number];
  zMin: number;
  zMax: number;
}
interface FastenerBase {
  id: string;
  group: 'pi' | 'ups';
  removeForTrayService: boolean;
}
export type EquipmentFastenerMount = FastenerBase &
  (
    | { type: 'screw'; diameter: number; length: number; bearing: Vec; axis: 'x' | '-x' }
    | { type: 'nut'; diameter: number; height: number; center: Vec; axis: 'x' | '-x' }
    | {
        type: 'washer';
        outerDiameter: number;
        bore: number;
        thickness: number;
        center: Vec;
        axis: 'x';
      }
    | { type: 'tube'; outerDiameter: number; bore: number; length: number; center: Vec; axis: 'x' }
  );
const planar = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Shape =>
  box([x1 - x0, y1 - y0, z1 - z0], [x0, y0, z0]);
function boreRadius(p: Parameters): number {
  return Math.min(39.4, (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 3.4);
}
function crop(p: Parameters, shape: Shape, z0: number, z1: number): Shape {
  return {
    kind: 'intersect',
    children: [shape, cylinder(boreRadius(p), z1 - z0 + 2, [0, 0, z0 - 1])],
  };
}
export const upsCrossPinY = 34;

/** Complete conservative projection of each retained DIN985 M4 nut during rear tray service. */
function retainedBodyNutServiceCuts(p: Parameters, front: number): Shape[] {
  const selected = nyloc.presets.find((preset) => Number(preset.parameters.bore) === 4);
  if (!selected) throw new Error('The retained M4 locknut is missing.');
  const clearance = 0.2,
    height = n(selected.parameters, 'height'),
    across = n(selected.parameters, 'acrossFlats');
  const d = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 42.8;
  const inner = 36.8 + d - height / 2 - clearance,
    outer = 36.8 + d + height / 2 + clearance;
  const tangent = across / Math.sqrt(3) + clearance;
  const rear = Math.floor((-20 - tangent) * 100) / 100;
  return structuralBodyAnchorAngles.map((angle) => {
    const a = (angle * Math.PI) / 180;
    const points: [number, number][] = [
      [inner, -tangent],
      [outer, -tangent],
      [outer, tangent],
      [inner, tangent],
    ].map(([r, t]) => [r * Math.cos(a) - t * Math.sin(a), r * Math.sin(a) + t * Math.cos(a)]);
    return prism(points, front + 1 - rear, rear);
  });
}

/** Full-depth dovetails replace the former 0.6 mm retaining lips. */
function railShape(rail: EquipmentRailSpec): Shape {
  return union(
    ...[-1, 1].map((sign): Shape => {
      const points: [number, number][] = [
        [rail.centerX - rail.stemWidth / 2, sign * rail.stemY[0]],
        [rail.centerX + rail.stemWidth / 2, sign * rail.stemY[0]],
        [rail.centerX + rail.headWidth / 2, sign * rail.headY[1]],
        [rail.centerX - rail.headWidth / 2, sign * rail.headY[1]],
      ];
      if (sign < 0) points.reverse();
      return prism(points, rail.zMax - rail.zMin, rail.zMin);
    }),
  );
}
export function equipmentRailClearanceShape(rail: EquipmentRailSpec, clearance = 0.2): Shape {
  return railShape({
    ...rail,
    stemWidth: rail.stemWidth + 2 * clearance,
    headWidth: rail.headWidth + 2 * clearance,
    stemY: [rail.stemY[0] - clearance, rail.stemY[1]],
    headY: [rail.headY[0], rail.headY[1] + clearance],
  });
}
/** Horizontal holes have a 45-degree roof toward -Z, the tray print direction. */
function roofBoreX(radius: number, length: number, origin: Vec): Shape {
  const a = radius / Math.sqrt(2);
  return union(cylinder(radius, length, origin, 'x'), {
    kind: 'transform',
    translation: origin,
    rotation: [0, 90, 0],
    child: prism(
      [
        [a, -a],
        [radius * Math.sqrt(2), 0],
        [a, a],
      ],
      length,
      0,
    ),
  });
}
function padRoof(back: number, front: number, y: number, z: number, half = 4): Shape {
  return sideWeb(
    [
      [back, z + half + Math.abs(front - back) + 0.3],
      [back, z + half - 0.7],
      [front, z + half - 0.7],
    ],
    y - half,
    y + half,
  );
}

/** A side web in the X/Z plane, extruded across a measured Y interval. */
function sideWeb(profile: [number, number][], y0: number, y1: number): Shape {
  return {
    kind: 'transform',
    translation: [0, y1, 0],
    rotation: [90, 0, 0],
    child: prism(profile, y1 - y0, 0),
  };
}

/** Follow the nose rather than letting a forward brace protrude through it. */
function piSideEnvelope(p: Parameters, z0: number, z1: number): Shape {
  const base = n(p, 'tubeOD') / 2,
    rise = base - 13.4,
    rho = (n(p, 'noseLength') ** 2 + rise ** 2) / (2 * rise);
  const profile: [number, number][] = Array.from({ length: 65 }, (_, i) => {
    const z = z0 + ((z1 - z0) * i) / 64;
    const radius = Math.min(
      boreRadius(p),
      Math.sqrt(Math.max(0, rho ** 2 - Math.max(0, z) ** 2)) + base - rho - n(p, 'wall') - 0.4,
    );
    return [radius, z];
  });
  return { kind: 'revolve', segments: 64, profile: [[0, z0], ...profile, [0, z1]] };
}

/** Deep edge channels turn the flat backing into a U-section with tapered upper haunches. */
function piSideChannels(p: Parameters, c: EquipmentCoordinates): Shape {
  const z0 = c.piZ - 42,
    z1 = c.piZ + 43,
    profile: [number, number][] = [
      [c.piX - 11, z0],
      [c.piX - 4.6, z0],
      [c.piX - 4.6, z1],
      [c.piX - 5, z1],
      [c.piX - 11, c.piZ + 21],
    ];
  const sides = [-1, 1].flatMap((sign) => [
    sideWeb(profile, sign > 0 ? 28.9 : -31.3, sign > 0 ? 31.3 : -28.9),
    // This inner return joins the upper haunch to the backing along its full height.
    planar(c.piX - 5, c.piX - 2, sign > 0 ? 27.5 : -29.4, sign > 0 ? 29.4 : -27.5, z0, z1),
  ]);
  return { kind: 'intersect', children: [union(...sides), piSideEnvelope(p, z0, z1)] };
}

/** Rear-open clearance also admits every intermediate pose of the deeper Pi channels. */
export function piSideChannelFrameReliefs(p: Parameters, c: EquipmentCoordinates): Shape[] {
  const rear = -n(p, 'shoulderLength') + 2.4;
  return [-1, 1].map((sign) =>
    planar(
      c.piX - 11.2,
      c.piX - 4.4,
      sign > 0 ? 28.7 : -31.3,
      sign > 0 ? 31.3 : -28.7,
      rear,
      c.piZ + 43.2,
    ),
  );
}
export function equipmentRailSpecs(_p: Parameters, c: EquipmentCoordinates): EquipmentRailSpec[] {
  return [
    {
      id: 'pi',
      centerX: c.piX - 1.07,
      contactY: 30.8,
      stemWidth: 3.2,
      stemY: [29.8, 32],
      headWidth: 6.4,
      headY: [32, 35.8],
      zMin: c.piZ - 42,
      zMax: c.piZ + 43,
    },
    {
      id: 'ups',
      centerX: c.upsX - 3,
      contactY: 33.4,
      stemWidth: 3.2,
      stemY: [32.4, 34.6],
      headWidth: 6.4,
      headY: [34.6, 39.15],
      zMin: c.upsZ - 46,
      zMax: c.upsZ + 49.5,
    },
  ];
}

/** Continuous orthogonal 2.2 mm wall; a sloping X-thick strip would be thinner along its normal. */
export function barrierShape(_p: Parameters, c: EquipmentCoordinates): Shape {
  const x = c.upsX - 3.844,
    z0 = c.piZ - 45,
    z1 = c.upsZ + 49.5;
  return union(
    planar(x - 0.6, x + 1.6, -33.4, -20.6, z0, z1),
    planar(x - 4, x - 1.8, -18.4, 33.4, z0, z1),
    planar(x - 4, x + 1.6, -20.6, -18.4, z0, z1),
  );
}

/** A broad 45-degree scarf supports the Pi feet without an inverted cantilever. */
function piRearShoulderShape(c: EquipmentCoordinates): Shape {
  const outer = c.piX - 5,
    inner = c.upsX - 7.144,
    seat = c.piZ - 42;
  return union(
    ...[-1, 1].map((sign) =>
      sideWeb(
        [
          [outer, seat - 3],
          [inner, seat - 3],
          [inner, seat + inner - outer],
          [outer, seat],
        ],
        sign > 0 ? 29.4 : -30.8,
        sign > 0 ? 30.8 : -29.4,
      ),
    ),
  );
}

/** A solid 3 mm backing plate and short broad PCB seats replace the forked clips. */
export function reinforcedPiCradleShape(p: Parameters, c: EquipmentCoordinates): Shape {
  const back = c.piX + 0.03,
    rail = equipmentRailSpecs(p, c)[0];
  const items: Shape[] = [
    planar(c.piX - 5, c.piX - 2, -28.5, 28.5, c.piZ - 43, c.piZ + 43),
    planar(c.piX - 5, c.piX - 0.4, -30.8, -27, rail.zMin, rail.zMax),
    planar(c.piX - 5, c.piX - 0.4, 27, 30.8, rail.zMin, rail.zMax),
    railShape(rail),
    piSideChannels(p, c),
  ];
  const cuts: Shape[] = [piRearShoulderShape(c)];
  for (const z of [c.piZ - 39, c.piZ + 19])
    for (const y of [-24.5, 24.5]) {
      items.push(
        cylinder(4, back - c.adapterX, [c.adapterX, y, z], 'x'),
        padRoof(c.piX - 2, back, y, z),
        padRoof(c.piX - 5, c.adapterX, y, z),
      );
      const yy: [number, number] = y > 0 ? [23.9, 29.5] : [-29.5, -23.9];
      items.push(
        planar(c.piX - 5, c.piX - 0.4, yy[0], yy[1], z - 3, z + 3),
        sideWeb(
          [
            [c.piX - 2, z + 5.0],
            [c.piX - 2, z + 2.8],
            [c.piX - 0.4, z + 2.8],
          ],
          yy[0],
          yy[1],
        ),
      );
      cuts.push(roofBoreX(2.95, 12, [c.piX - 8, y, z]));
    }
  return {
    kind: 'intersect',
    children: [
      subtract(union(...items), ...cuts, ...retainedBodyNutServiceCuts(p, c.piZ + 43)),
      piSideEnvelope(p, c.piZ - 43, c.piZ + 43),
    ],
  };
}

function hexPocketX(across: number, x0: number, x1: number, y: number, z: number): Shape {
  const r = across / Math.sqrt(3),
    flat = across / 2,
    h = r / 2;
  return union(
    {
      kind: 'transform',
      translation: [x0, y, z],
      rotation: [0, 90, 0],
      child: prism(
        Array.from({ length: 6 }, (_, i) => {
          const a = Math.PI / 6 + (i * Math.PI) / 3;
          return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
        }),
        x1 - x0,
        0,
      ),
    },
    {
      kind: 'transform',
      translation: [x0, y, z],
      rotation: [0, 90, 0],
      child: prism(
        [
          [flat, -h],
          [flat + h, 0],
          [flat, h],
        ],
        x1 - x0,
        0,
      ),
    },
  );
}

/** Front carrier includes the complete insulating wall and cap/Pi axial support chain. */
export function reinforcedUPSCradleShape(p: Parameters, c: EquipmentCoordinates): Shape {
  const rear = -n(p, 'shoulderLength') + 2.6,
    front = c.upsZ + 49.5,
    pcbFront = c.upsX - 1.6;
  const lowerTop = c.piZ - 44,
    lowerBack = c.upsX - 9.844,
    lowerFront = c.upsX - 7.144;
  const items: Shape[] = [
    planar(lowerBack, lowerFront, -28, 28, rear, lowerTop),
    barrierShape(p, c),
    railShape(equipmentRailSpecs(p, c)[1]),
    piRearShoulderShape(c),
    planar(c.upsX - 4.444, pcbFront, -28, -20.6, c.upsZ + 46.9, front),
    planar(c.upsX - 7.844, pcbFront, -18.4, 28, c.upsZ + 46.9, front),
    planar(c.upsX - 7.844, pcbFront, -20.6, -18.4, c.upsZ + 46.9, front),
    sideWeb(
      [
        [-0.6, -7.6],
        [1.6, -7.6],
        [lowerFront, lowerTop],
        [lowerBack, lowerTop],
      ],
      -28,
      -20.6,
    ),
    sideWeb(
      [
        [-4, -10.8],
        [-1.8, -10.8],
        [lowerFront, lowerTop],
        [lowerBack, lowerTop],
      ],
      -18.4,
      28,
    ),
    sideWeb(
      [
        [-4, -7.6],
        [1.6, -7.6],
        [lowerFront, lowerTop],
        [lowerBack, lowerTop],
      ],
      -20.6,
      -18.4,
    ),
  ];
  const cuts: Shape[] = [];
  for (const sign of [-1, 1]) {
    const yy: [number, number] = sign > 0 ? [30.4, 33.4] : [-33.4, -30.4];
    items.push(planar(lowerBack, 12.2, yy[0], yy[1], c.upsZ - 46, front));
    // These full-height rear gussets join the lower plate to both side walls.
    const link: [number, number] = sign > 0 ? [27, 31.2] : [-31.2, -27];
    items.push(planar(lowerBack, lowerFront, link[0], link[1], rear, lowerTop));
    cuts.push(
      sideWeb(
        [
          [4.044, c.upsZ + 39.3],
          [12.4, c.upsZ + 39.3],
          [12.4, c.upsZ + 30.944],
        ],
        sign > 0 ? 30.2 : -33.6,
        sign > 0 ? 33.6 : -30.2,
      ),
    );
    const boltY = sign * upsCrossPinY;
    items.push(cylinder(4.5, 7.5, [-10.8, boltY, c.upsZ], 'x'));
    items.push({
      kind: 'loft',
      rings: [
        [
          [lowerBack, sign * 30.4, c.upsZ + 17],
          [lowerFront, sign * 30.4, c.upsZ + 17],
          [lowerFront, sign * 33.4, c.upsZ + 17],
          [lowerBack, sign * 33.4, c.upsZ + 17],
        ],
        [
          [-10.8, sign * 30.4, c.upsZ + 7],
          [lowerFront, sign * 30.4, c.upsZ + 7],
          [lowerFront, sign * 38.8, c.upsZ + 7],
          [-10.8, sign * 38.8, c.upsZ + 7],
        ],
        [
          [-10.8, sign * 30.4, c.upsZ + 3],
          [lowerFront, sign * 30.4, c.upsZ + 3],
          [lowerFront, sign * 38.8, c.upsZ + 3],
          [-10.8, sign * 38.8, c.upsZ + 3],
        ],
      ],
    });
    items.push(
      planar(-6, 4.044, sign > 0 ? 37.2 : -39.15, sign > 0 ? 39.15 : -37.2, c.upsZ - 7, c.upsZ + 7),
    );
    cuts.push(
      hexPocketX(6, -10.9, -6.5, boltY, c.upsZ),
      roofBoreX(3.7, 0.6, [-6.6, boltY, c.upsZ]),
      roofBoreX(2.95, 30, [-11.5, boltY, c.upsZ]),
      roofBoreX(3.7, 8, [10.5, boltY, c.upsZ]),
    );
    const recessY: [number, number] = sign > 0 ? [30.2, 40.2] : [-40.2, -30.2];
    cuts.push(planar(6.3, 12.4, recessY[0], recessY[1], c.upsZ - 7.2, c.upsZ + 7.2));
    cuts.push(
      sideWeb(
        [
          [6.3, c.upsZ - 7.2],
          [12.4, c.upsZ - 7.2],
          [12.4, c.upsZ - 13.3],
        ],
        recessY[0],
        recessY[1],
      ),
    );
    const endY: [number, number] = sign > 0 ? [30.2, 33.6] : [-33.6, -30.2];
    for (const [z0, z1] of [
      [c.upsZ - 47.2, c.upsZ - 39.3],
      [c.upsZ + 39.3, c.upsZ + 47.2],
    ]) {
      const rearEnd = z1 < c.upsZ;
      // Opposed inner faces carry the cover into the carrier without loading the PCB.
      cuts.push(
        planar(
          c.upsX + 0.2,
          c.upsX + 14.356,
          endY[0],
          endY[1],
          z0 - (rearEnd ? 0.2 : 0),
          z1 + (rearEnd ? 0 : 0.2),
        ),
      );
    }
  }
  for (const z of [c.upsZ - 43, c.upsZ + 43])
    for (const y of [-23, 23]) {
      const upper = z > c.upsZ;
      const start = upper ? (y < 0 ? c.upsX - 4.444 : c.upsX - 7.844) : lowerBack;
      items.push(
        cylinder(4, pcbFront - start, [start, y, z], 'x'),
        {
          kind: 'intersect',
          children: [
            cylinder(1.4, 1.6, [pcbFront, y, z], 'x'),
            sideWeb(
              [
                [pcbFront, z + 1.5],
                [pcbFront + 1.6, z - 0.1],
                [pcbFront + 1.6, z - 1.5],
                [pcbFront, z - 1.5],
              ],
              y - 1.5,
              y + 1.5,
            ),
          ],
        },
        ...(upper ? [] : [padRoof(lowerFront, pcbFront, y, z)]),
      );
    }
  // The structural body bolts leave before tray service. Their installed tips
  // need clearance at the slightly clocked body anchors, not a weaker short bolt.
  for (const angle of structuralBodyAnchorAngles)
    cuts.push({
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angle],
      child: union(cylinder(2.4, 14, [32, 0, -20], 'x'), roofBoreX(4.7, 7.5, [33.1, 0, -20])),
    });
  // Preserve the verified continuous rearward clearance around the retained M4 nuts.
  for (const sign of [-1, 1])
    cuts.push(
      prism(
        [
          [-6.1, 33.25],
          [-5.5, 33.4],
          [-5.5, 40],
          [-6.1, 40],
        ].map(([x, y]) => [x, sign * y] as [number, number]),
        30,
        -24,
      ),
    );
  // The rear negative-Y auxiliary header needs clearance beside the D8 PCB seat.
  cuts.push(planar(c.upsX - 6, c.upsX - 1.6 + 0.1, -19.4, -8.6, c.upsZ - 43.9, c.upsZ - 38.1));
  return subtract(
    crop(p, union(...items), rear, front),
    ...cuts,
    ...retainedBodyNutServiceCuts(p, front),
  );
}

/** Separate cover bears on the PCB and limits cell movement through the open holder windows. */
export function upsCellCoverShape(p: Parameters, c: EquipmentCoordinates): Shape {
  const x1 = c.upsX + 24.8,
    rear = c.upsZ - 47,
    front = c.upsZ + 47;
  const height = front - rear;
  const pads: Shape[] = [];
  const panel: Shape[] = [planar(x1 - 3.2, x1, -30.4, 30.4, rear, front)];
  for (const sign of [-1, 1]) {
    const pts: [number, number][] = [
      [x1, 19.9],
      [x1, 30.4],
      [20, 33.6],
      [14.8, 36.3],
      [8, 37.7],
      [8, 33.8],
      [12.2, 33.8],
      [14.8, 31.7],
    ];
    const mirrored = pts.map(([x, y]) => [x, sign * y] as [number, number]);
    if (sign < 0) mirrored.reverse();
    panel.push(prism(mirrored, height, rear));
  }
  panel.push(
    planar(6.5, x1, -38, 38, rear, c.upsZ - 39.3),
    planar(6.5, x1, -38, 38, c.upsZ + 39.3, front),
  );
  for (const z of [c.upsZ - 21, c.upsZ - 1, c.upsZ + 19])
    for (const y of [-19.5, 0, 19.5])
      pads.push(planar(c.upsX + 20.9, x1 - 2.4, y - 3, y + 3, z - 3, z + 3));
  const main: Shape = {
    kind: 'intersect',
    children: [
      subtract(
        union(...panel),
        planar(c.upsX - 0.1, c.upsX + 21.9, -30.4, 30.4, c.upsZ - 39.3, c.upsZ + 39.3),
      ),
      cylinder(40.5 + (n(p, 'tubeID') - 86) / 2, height, [0, 0, rear]),
    ],
  };
  const parts: Shape[] = [main, ...pads],
    cuts: Shape[] = [];
  for (const sign of [-1, 1]) {
    const y0 = sign > 0 ? 30.4 : -40,
      y1 = sign > 0 ? 40 : -30.4;
    const a0 = sign > 0 ? 30.4 : -33,
      a1 = sign > 0 ? 33 : -30.4;
    const boss = union(planar(6.5, 10.5, y0, y1, c.upsZ - 7, c.upsZ + 7), {
      kind: 'loft',
      rings: [
        [
          [18, a0, c.upsZ - 7],
          [18, a1, c.upsZ - 7],
          [18, a1, c.upsZ + 7],
          [18, a0, c.upsZ + 7],
        ],
        [
          [10.5, y0, c.upsZ - 7],
          [10.5, y1, c.upsZ - 7],
          [10.5, y1, c.upsZ + 7],
          [10.5, y0, c.upsZ + 7],
        ],
      ],
    });
    parts.push({
      kind: 'intersect',
      children: [boss, cylinder(40.5 + (n(p, 'tubeID') - 86) / 2, height, [0, 0, rear])],
    });
    cuts.push(
      cylinder(2.95, 8, [5, sign * upsCrossPinY, c.upsZ], 'x'),
      cylinder(3.7, 40, [10.5, sign * upsCrossPinY, c.upsZ], 'x'),
    );
  }
  for (const z of [c.upsZ - 43, c.upsZ + 43])
    for (const y of [-23, 23]) {
      const seat = cylinder(4, 4.4, [c.upsX, y, z], 'x');
      const clearEnd =
        z < c.upsZ
          ? planar(c.upsX - 1, x1 + 1, y - 5, y + 5, z + 3.7, z + 6)
          : planar(c.upsX - 1, x1 + 1, y - 5, y + 5, z - 6, z - 3.7);
      parts.push(subtract(seat, clearEnd));
      cuts.push(cylinder(1.65, 6.4, [c.upsX - 1, y, z], 'x'));
    }
  cuts.push(
    subtract(
      cylinder(40.7 + (n(p, 'tubeID') - 86) / 2, 8.95, [0, 0, -1.65]),
      cylinder((n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 5, 10.95, [0, 0, -2.65]),
    ),
  );
  return subtract(
    {
      kind: 'intersect',
      children: [union(...parts), cylinder(40.5 + (n(p, 'tubeID') - 86) / 2, height, [0, 0, rear])],
    },
    ...cuts,
  );
}

/** Rearward clearance for the broad cover pads, without narrowing them into thin necks. */
export function upsCoverServiceClearanceShape(p: Parameters, c: EquipmentCoordinates): Shape {
  const rear = -n(p, 'shoulderLength') - 2,
    top = c.upsZ + 47.3,
    peak = top + (29 - 6.3) / 2;
  return union(
    ...[-1, 1].map((sign): Shape => ({
      kind: 'intersect',
      children: [
        union(
          planar(6.3, 29, sign > 0 ? 27.5 : -40.2, sign > 0 ? 40.2 : -27.5, rear, top),
          sideWeb(
            [
              [6.3, top],
              [29, top],
              [17.65, peak],
            ],
            sign > 0 ? 27.5 : -40.2,
            sign > 0 ? 40.2 : -27.5,
          ),
        ),
        cylinder(40.8 + (n(p, 'tubeID') - 86) / 2, peak - rear + 0.1, [0, 0, rear]),
      ],
    })),
  );
}

/** Metal stacks are separate library occurrences; only the outside UPS cross hardware is removed for tray service. */
export function equipmentFastenerMounts(
  _p: Parameters,
  c: EquipmentCoordinates,
): EquipmentFastenerMount[] {
  const result: EquipmentFastenerMount[] = [];
  let index = 0;
  for (const z of [c.piZ - 39, c.piZ + 19])
    for (const y of [-24.5, 24.5]) {
      const base = { group: 'pi' as const, removeForTrayService: false };
      result.push(
        {
          ...base,
          type: 'screw',
          id: `pi-stack-screw-${index}`,
          diameter: 2.5,
          length: 16,
          bearing: [c.piX + 1.806, y, z],
          axis: 'x',
        },
        {
          ...base,
          type: 'washer',
          id: `pi-front-washer-${index}`,
          outerDiameter: 6,
          bore: 2.7,
          thickness: 0.5,
          center: [c.piX + 1.556, y, z],
          axis: 'x',
        },
        {
          ...base,
          type: 'tube',
          id: `pi-compression-tube-${index}`,
          outerDiameter: 5.5,
          bore: 2.7,
          length: c.piX + 0.03 - c.adapterX,
          center: [(c.piX + 0.03 + c.adapterX) / 2, y, z],
          axis: 'x',
        },
        {
          ...base,
          type: 'washer',
          id: `pi-back-washer-${index}`,
          outerDiameter: 6,
          bore: 2.7,
          thickness: 0.5,
          center: [c.adapterX - 1.85, y, z],
          axis: 'x',
        },
        {
          ...base,
          type: 'nut',
          id: `pi-stack-nut-${index}`,
          diameter: 2.5,
          height: 3.8,
          center: [c.adapterX - 4, y, z],
          axis: '-x',
        },
      );
      index++;
    }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'negative-y' : 'positive-y',
      y = side * upsCrossPinY;
    result.push(
      {
        type: 'screw',
        id: `ups-cross-screw-${tag}`,
        group: 'ups',
        removeForTrayService: true,
        diameter: 3,
        length: 25,
        bearing: [11, y, c.upsZ],
        axis: 'x',
      },
      {
        type: 'washer',
        id: `ups-cross-head-washer-${tag}`,
        group: 'ups',
        removeForTrayService: true,
        outerDiameter: 7,
        bore: 3.2,
        thickness: 0.5,
        center: [10.75, y, c.upsZ],
        axis: 'x',
      },
      {
        type: 'tube',
        id: `ups-cross-tube-${tag}`,
        group: 'ups',
        removeForTrayService: true,
        outerDiameter: 5.5,
        bore: 3.2,
        length: 16.5,
        center: [2.25, y, c.upsZ],
        axis: 'x',
      },
      {
        type: 'washer',
        id: `ups-cross-front-washer-${tag}`,
        group: 'ups',
        removeForTrayService: false,
        outerDiameter: 7,
        bore: 3.2,
        thickness: 0.5,
        center: [-6.25, y, c.upsZ],
        axis: 'x',
      },
      {
        type: 'nut',
        id: `ups-cross-nut-${tag}`,
        group: 'ups',
        removeForTrayService: false,
        diameter: 3,
        height: 4,
        center: [-8.5, y, c.upsZ],
        axis: '-x',
      },
    );
  }
  return result;
}
