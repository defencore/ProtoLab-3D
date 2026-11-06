import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { at } from './shared';
import { pi5Interface } from '../../raspberry-pi/interface';
const piOrigin: Vec = [-146, 0, -3];
const mountingXs = [...new Set(pi5Interface.pcb.holes.map(({ x }) => piOrigin[0] - x))].sort(
  (a, b) => a - b,
);
const mountingYs = [...new Set(pi5Interface.pcb.holes.map(({ y }) => -y))].sort((a, b) => a - b);

/** Source-board stack remains fixed; the rigid insert closes the four soft eyes. */
export const noseRetention = {
  piOrigin,
  carrier: {
    front: -172,
    rear: -99,
    outerY: 34,
    bottomZ: -6,
    topZ: -3,
    bossTopZ: -2.97,
    pocketFloorZ: -4.6,
    padBottomZ: -8.4,
  },
  bed: { front: -178, rear: -95.5, outerY: 34.6, bottomZ: -11, floorTopZ: -6.2 },
  groove: {
    front: -161.2,
    rear: -99.8,
    keyFront: -161,
    keyRear: -100,
    innerY: 34.7,
    outerY: 36.6,
    keyOuterY: 36.4,
    segments: [
      [-161, -123],
      [-106.5, -100],
    ],
  },
  hinge: {
    radius: 6,
    thickness: 1.4,
    width: 12,
    eyeDiameter: 6.2,
    neutralZ: -3.8,
    rootZ: -9.8,
    overlap: 0.3,
  },
  mountingXs,
  mountingYs,
  tabs: [
    { rootX: -175, direction: 1, holeX: mountingXs[0], length: 10.8 },
    { rootX: -96.5, direction: -1, holeX: mountingXs[1], length: 11.3 },
  ],
  assemblyBendStrainEstimate: 1.4 / 12,
} as const;
const section = (points: [number, number][], x: number, length: number): Shape =>
  at(prism(points, length, 0), [x, 0, 0], [90, 0, 90]);
const hex = (af: number, height: number, x: number, y: number, z: number): Shape =>
  at(
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const a = ((i + 0.5) * Math.PI) / 3;
        return [(af / Math.sqrt(3)) * Math.cos(a), (af / Math.sqrt(3)) * Math.sin(a)];
      }),
      height,
      0,
    ),
    [x, y, z],
  );
const mirrored = (points: readonly number[][], sign: number): [number, number][] =>
  points.map(([y, z]) => [sign * y, z]);

/** Both sides are grounded in continuous sills; no flat blind groove roof. */
export function piSeatFrameStock(): Shape[] {
  return [-1, 1].flatMap((sign) => [
    box([69.4, 14.5, 3], [-164.2, sign > 0 ? 27.5 : -42, -14]),
    box([69.4, 7.3, 13.2], [-164.2, sign > 0 ? 34.7 : -42, -14]),
  ]);
}
export function piSeatFrameTools(): Shape[] {
  return noseRetention.groove.segments.flatMap(([front, rear]) =>
    [-1, 1].map((sign) =>
      section(
        mirrored(
          [
            [34.7, -10],
            [36.6, -8.1],
            [36.6, -5.8],
            [34.7, -3.9],
          ],
          sign,
        ),
        front - 0.2,
        rear - front + 0.4,
      ),
    ),
  );
}
/** The source camera ribs and auxiliary wall have open45degree transition stock. */
export function noseAuxiliaryWallGussets(): Shape[] {
  return [-1, 1].map((sign) =>
    section(
      mirrored(
        [
          [16.3, -24],
          [16.6, -24],
          [16.6, -21.2],
          [13.5, -21.2],
        ],
        sign,
      ),
      -193,
      94,
    ),
  );
}

type Segment = { kind: 'line' | 'arc'; points: [number, number][] };
const line = (a: [number, number], b: [number, number]): Segment => ({
  kind: 'line',
  points: [a, b],
});
/** A single true-arc outline carries both the bend and its tangent tongue. */
function stripProfile(length: number, clearance = 0, tool = false, angle = Math.PI / 2): Segment[] {
  const h = noseRetention.hinge,
    R = tool ? h.radius : (Math.PI * h.radius) / 2 / angle,
    z = h.rootZ,
    t = h.thickness,
    ri = R - t / 2 - clearance,
    ro = R + t / 2;
  if (tool) {
    const a: [number, number] = [R - ri, z],
      b: [number, number] = [R, z + ri],
      c: [number, number] = [R + length + 0.3, z + ri],
      d: [number, number] = [R + length + 0.3, 3],
      e: [number, number] = [R - ri, 3];
    return [
      { kind: 'arc', points: [a, [R - ri / Math.SQRT2, z + ri / Math.SQRT2], b] },
      line(b, c),
      line(c, d),
      line(d, e),
      line(e, a),
    ];
  }
  const tangent: [number, number] = [Math.sin(angle), Math.cos(angle)];
  const a: [number, number] = [t / 2, z - h.overlap],
    b: [number, number] = [t / 2, z];
  const c: [number, number] = [R - ri * Math.cos(angle), z + ri * Math.sin(angle)];
  const d: [number, number] = [c[0] + length * tangent[0], c[1] + length * tangent[1]];
  const f: [number, number] = [R - ro * Math.cos(angle), z + ro * Math.sin(angle)];
  const e: [number, number] = [f[0] + length * tangent[0], f[1] + length * tangent[1]];
  const g: [number, number] = [-t / 2, z],
    j: [number, number] = [-t / 2, z - h.overlap];
  return [
    line(a, b),
    { kind: 'arc', points: [b, [R - ri * Math.cos(angle / 2), z + ri * Math.sin(angle / 2)], c] },
    line(c, d),
    line(d, e),
    line(e, f),
    { kind: 'arc', points: [f, [R - ro * Math.cos(angle / 2), z + ro * Math.sin(angle / 2)], g] },
    line(g, j),
    line(j, a),
  ];
}
function extrudeProfile(segments: Segment[], width: number): Shape {
  return {
    kind: 'curve-loft',
    segments,
    layers: [
      { scale: 1, angle: 0, z: 0 },
      { scale: 1, angle: 0, z: width },
    ],
    previewSamples: 96,
  };
}
function tabWorld(shape: Shape, rootX: number, rowY: number, direction: number, width = 12): Shape {
  return at(shape, [rootX, rowY + (direction * width) / 2, 0], [90, 0, direction > 0 ? 0 : 180]);
}
function eyeHole(distance: number, free: boolean): Shape {
  const h = noseRetention.hinge,
    r = h.eyeDiameter / 2,
    a = r / Math.SQRT2,
    c = h.radius + distance;
  if (!free)
    return union(
      cylinder(r, 2, [c, h.neutralZ - 1, h.width / 2], 'y'),
      prism(
        [
          [c + a, h.width / 2 - a],
          [c + a, h.width / 2 + a],
          [c + r * Math.SQRT2, h.width / 2],
        ],
        2,
        h.neutralZ - 1,
        'y',
      ),
    );
  const z = h.rootZ + (Math.PI * h.radius) / 2 + distance;
  return union(
    cylinder(r, 2, [-1, z, h.width / 2], 'x'),
    at(
      prism(
        [
          [z + a, h.width / 2 - a],
          [z + a, h.width / 2 + a],
          [z + r * Math.SQRT2, h.width / 2],
        ],
        2,
        0,
      ),
      [-1, 0, 0],
      [90, 0, 90],
    ),
  );
}
function contactLand(distance: number, rowY: number, direction: number, free: boolean): Shape {
  const h = noseRetention.hinge,
    u = h.radius + distance,
    z = -3.1;
  const vc = h.width / 2 + direction * Math.sign(rowY) * 4.5;
  const shape = prism(
    [
      [u - 3, z - 0.1],
      [u - 3, z],
      [u - 2.77, z + 0.23],
      [u + 3, z + 0.23],
      [u + 3, z - 0.1],
    ],
    1.8,
    vc - 0.9,
    'z',
  );
  return free
    ? at(shape, [h.neutralZ, h.rootZ + (Math.PI * h.radius) / 2 - h.radius, 0], [0, 0, 90])
    : shape;
}
function plateBendTransform(shape: Shape, angle: number): Shape {
  const h = noseRetention.hinge,
    L = (Math.PI * h.radius) / 2;
  const bendRadius = angle ? L / angle : 0;
  const endpoint: [number, number] = angle
    ? [bendRadius * (1 - Math.cos(angle)), h.rootZ + bendRadius * Math.sin(angle)]
    : [0, h.rootZ + L];
  const rotation = Math.PI / 2 - angle,
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  return at(
    shape,
    [
      endpoint[0] - (c * h.radius - s * h.neutralZ),
      endpoint[1] - (s * h.radius + c * h.neutralZ),
      0,
    ],
    [0, 0, (rotation * 180) / Math.PI],
  );
}
function eyeTab(tab: (typeof noseRetention.tabs)[number], rowY: number, angle: number): Shape {
  const h = noseRetention.hinge,
    d = tab.direction * (tab.holeX - tab.rootX) - h.radius;
  const base =
    angle === 0
      ? box(
          [h.thickness, h.overlap + (Math.PI * h.radius) / 2 + tab.length, h.width],
          [-h.thickness / 2, h.rootZ - h.overlap, 0],
        )
      : extrudeProfile(stripProfile(tab.length, 0, false, angle), h.width);
  const land = plateBendTransform(contactLand(d, rowY, tab.direction, false), angle);
  const hole = plateBendTransform(eyeHole(d, false), angle);
  return tabWorld(subtract(union(base, land), hole), tab.rootX, rowY, tab.direction);
}
export function piCarrierPadBounds() {
  return noseRetention.tabs.map((tab) => ({
    holeX: tab.holeX,
    front:
      tab.direction > 0
        ? noseRetention.carrier.front
        : tab.rootX - noseRetention.hinge.radius - tab.length - 0.5,
    rear:
      tab.direction > 0
        ? tab.rootX + noseRetention.hinge.radius + tab.length + 0.5
        : noseRetention.carrier.rear,
  }));
}
export function piCarrierPadStocks(): Shape[] {
  return piCarrierPadBounds().flatMap((p) =>
    noseRetention.mountingYs.map((y) => box([p.rear - p.front, 12, 5.4], [p.front, y - 6, -8.4])),
  );
}

/** Carrier-only reinforcement fits the original printed TPU cup and eyelets. */
export const piCarrierReinforcement = {
  links: [
    { front: -158.1, rear: -154.2 },
    { front: -117.8, rear: -113.9 },
  ],
  ties: [
    { front: -172, rear: -154.2 },
    { front: -117.8, rear: -99 },
  ],
  tieY: 16,
  tieWidth: 3.7,
  bottomZ: -6,
  topZ: -3,
  rearOpening: { front: -117.9, rear: -113.8 },
  feet: [
    ...mountingYs.flatMap((y) =>
      [-4.5, 4.5].map((offset) => ({ x: mountingXs[0], y: y + offset, length: 3 })),
    ),
    ...mountingYs.map((y) => ({ x: mountingXs[1], y: y + Math.sign(y) * 4.5, length: 6 })),
  ],
  footWidth: 2.4,
  footBottomZ: -8.7,
  footTopZ: -8.2,
} as const;

export function piCarrierReinforcementStock(): Shape[] {
  const d = piCarrierReinforcement;
  return [
    ...d.links.map(({ front, rear }) =>
      box([rear - front, 68, d.topZ - d.bottomZ], [front, -34, d.bottomZ]),
    ),
    ...d.ties.flatMap(({ front, rear }) =>
      [-1, 1].map((sign) =>
        box(
          [rear - front, d.tieWidth, d.topZ - d.bottomZ],
          [front, sign * d.tieY - d.tieWidth / 2, d.bottomZ],
        ),
      ),
    ),
    ...d.feet.map(({ x, y, length }) =>
      box(
        [length, d.footWidth, d.footTopZ - d.footBottomZ],
        [x - length / 2, y - d.footWidth / 2, d.footBottomZ],
      ),
    ),
  ];
}

export function piCarrierReinforcementCuts(): Shape[] {
  const d = piCarrierReinforcement,
    openingHalfWidth = d.tieY - d.tieWidth / 2;
  return [
    ...piCarrierPadBounds().flatMap(({ front, rear }) =>
      mountingYs.flatMap((y) =>
        [y - 6.2, y + 6].map((edge) => box([rear - front, 0.2, 15], [front, edge, -12])),
      ),
    ),
    // Open the source microSD clearance through the rear link to its tie roots;
    // no sub-nozzle bridge or unused central horns remain.
    box(
      [d.rearOpening.rear - d.rearOpening.front, 2 * openingHalfWidth, 6],
      [d.rearOpening.front, -openingHalfWidth, -6.1],
    ),
  ];
}
export function piCarrierRebateTools(): Shape[] {
  return noseRetention.tabs.flatMap((tab) =>
    noseRetention.mountingYs.map((rowY) => {
      const tool = tabWorld(
        extrudeProfile(stripProfile(tab.length, 0.1, true), 12.4),
        tab.rootX,
        rowY,
        tab.direction,
        12.4,
      );
      return subtract(tool, cylinder(2.8, 15, [tab.holeX, rowY, -10]));
    }),
  );
}

/** Sideways metal nuts are loaded into the empty bed before the carrier lowers. */
export function piSeatCushionShape(form: boolean | number = false): Shape {
  const angle = typeof form === 'number' ? (form * Math.PI) / 180 : form ? 0 : Math.PI / 2;
  if (angle < 0 || angle > Math.PI / 2)
    throw new Error('The eyelet bend must remain between0and90degrees.');
  const d = noseRetention.bed,
    h = noseRetention.hinge;
  const ring = subtract(
    box([d.rear - d.front, 69.2, 4.8], [d.front, -34.6, -11]),
    box([65, 50.2, 12], [-168, -25.1, -12]),
  );
  const endWalls = [
    box([10, 68.2, 7.5], [-178, -34.1, -11]),
    box([7.5, 68.2, 7.5], [-103, -34.1, -11]),
  ];
  const cups = noseRetention.mountingXs.flatMap((x) =>
    noseRetention.mountingYs.map((y) => cylinder(9, 4.8, [x, y, -11])),
  );
  const keyBody = noseRetention.groove.segments.flatMap(([front, rear]) =>
    [-1, 1].map((sign) =>
      section(
        mirrored(
          [
            [34.1, -10.4],
            [36.4, -8.1],
            [36.4, -5.8],
            [34.1, -3.5],
          ],
          sign,
        ),
        front,
        rear - front,
      ),
    ),
  );
  const lands = [
    [-157, 6],
    [-103.25, 4],
  ].flatMap(([x, length]) =>
    [-1, 1].flatMap((sign) => [
      section(
        mirrored(
          [
            [36.2, -7.9],
            [36.7, -7.4],
            [36.7, -6.1],
            [36.2, -6.1],
          ],
          sign,
        ),
        x - length / 2,
        length,
      ),
      section(
        mirrored(
          [
            [34.6, -4.3],
            [36.1, -5.8],
            [36.1, -5.1585786438],
            [34.6, -3.6585786438],
          ],
          sign,
        ),
        x - length / 2,
        length,
      ),
      section(
        mirrored(
          [
            [34.6, -9.9],
            [36.1, -8.4],
            [36.1, -8.7414213562],
            [34.6, -10.2414213562],
          ],
          sign,
        ),
        x - length / 2,
        length,
      ),
    ]),
  );
  const carrierLands = [
    [-154, 6],
    [-103.25, 4],
  ].flatMap(([x, length]) =>
    [-1, 1].flatMap((sign) => [
      box([length, 2.5, 0.5], [x - length / 2, sign > 0 ? 31 : -33.5, -6.4]),
      section(
        mirrored(
          [
            [34.2, -5.8],
            [33.9, -5.5],
            [33.9, -4.3],
            [34.6, -4.3],
            [34.6, -5.8],
          ],
          sign,
        ),
        x - length / 2,
        length,
      ),
    ]),
  );
  const endLands = [-172.6, -99.1].flatMap((x) =>
    [-12, 12].map((y) => box([0.7, 6, 1.9], [x, y - 3, -6.2])),
  );
  const outerEndLands = [
    [-178.4, -177.7],
    [-95.8, -95.1],
  ].flatMap(([x0, x1]) => [-15, 15].map((y) => box([x1 - x0, 6, 6], [x0, y - 3, -10])));
  const clearances = piCarrierPadBounds().flatMap((p) =>
    noseRetention.mountingYs.flatMap((y) => [
      box([p.rear - p.front + 0.4, 12.4, 14], [p.front - 0.2, y - 6.2, -8.6]),
      cylinder(2.6, 1.4, [p.holeX, y, -9.8]),
      cylinder(1.4, 3.2, [p.holeX, y, -11.2]),
    ]),
  );
  const rootChannels = noseRetention.tabs.flatMap((tab) =>
    noseRetention.mountingYs.map((y) =>
      box(
        [h.radius + h.thickness + 1.1, 12.4, 16],
        [
          tab.direction > 0
            ? tab.rootX - h.thickness / 2 - 0.3
            : tab.rootX - h.radius - h.thickness / 2 - 0.7,
          y - 6.2,
          h.rootZ,
        ],
      ),
    ),
  );
  const body = subtract(
    union(ring, ...endWalls, ...cups, ...keyBody, ...lands, ...outerEndLands),
    box([73.2, 68.2, 13], [-172.1, -34.1, -6.2]),
    ...clearances,
    ...rootChannels,
  );
  return union(
    body,
    ...carrierLands,
    ...endLands,
    ...noseRetention.tabs.flatMap((tab) =>
      noseRetention.mountingYs.map((y) => eyeTab(tab, y, angle)),
    ),
  );
}

export function piCarrierNutPocketTools(): Shape[] {
  return noseRetention.mountingXs.flatMap((x) =>
    noseRetention.mountingYs.map((y) => hex(5.3, 4.1, x, y, -10.1)),
  );
}

/** Verification-only intermediate isometric bends; no extra product selector. */
export function piSeatTabsAtAngle(angleDegrees: number): Shape[] {
  const a = (angleDegrees * Math.PI) / 180;
  if (a < 0 || a > Math.PI / 2)
    throw new Error('The eyelet bend must remain between0and90degrees.');
  return noseRetention.tabs.flatMap((tab) =>
    noseRetention.mountingYs.map((y) => eyeTab(tab, y, a)),
  );
}
