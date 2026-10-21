import { Euler, Quaternion, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyDefinition, AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import detail from '../../manufactured-detail/part';
import {
  hardwareLibraries,
  motor,
  screw,
  nut,
  bearing,
  eRing,
  standoff,
  stud,
  bolt,
  hexNut,
  motorParameters,
  screwParameters,
  nutParameters,
  outputBearingParameters,
  screwBearingParameters,
  followerBearingParameters,
  outputEClipParameters,
  screwEClipParameters,
  lowerStandoffParameters,
  upperStandoffParameters,
  socketBoltParameters,
} from './hardware';
export const libraries: PartDefinition[] = [detail, ...hardwareLibraries];
export const layout = {
  tubeOD: 90,
  tubeID: 86,
  length: 65,
  screwX: 23,
  screwY: -17.5,
  screwBottom: 12,
  screwLength: 52,
  screwThreadStart: 32,
  screwThreadEnd: 58,
  outputZ: 45,
  arm: 8.5,
  nutOffset: 0,
  bearingStarts: [16, 34] as const,
};
export const driveInterface = {
  rollerX: [29.3, 32.3] as const,
  rollerCenterX: 30.8,
  rollerDiameter: 7,
  slotY: [-14.8, -4.3] as const,
  slotHeight: 7.2,
  rollerPocketX: [29.0, 32.6] as const,
  captureX: [27.8, 28.4] as const,
  capturePocketX: [27.7, 28.5] as const,
  capturePocketY: [-14.9, -5.3] as const,
  keeperX: [26.9, 29.0] as const,
  rockerMaxX: 26.7,
  captureDiameter: 5,
  capturePocketHeight: 5.6,
  captureMouthHeight: 4.4,
  sleeveDiameter: 4,
  nutAxialEndplay: 0.1,
};
const nutLidAxes: [number, number][] = [
  [27, -27.5],
  [12, -7],
];
const steel = 0xb8c1cc,
  print = 0x276b8c,
  moving = 0xf0a346,
  dark = 0x343e4d;
/** Peripheral posts sit between the output lugs and adjacent screw/nut envelopes. */
export const framePosts = Array.from({ length: 4 }, (_, i) => {
  const angle = 24 + i * 90;
  return {
    x: 38 * Math.cos((angle * Math.PI) / 180),
    y: 38 * Math.sin((angle * Math.PI) / 180),
    rotation: angle + 30,
  };
});
const move = (child: Shape, translation: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const clip = (a: Shape, b: Shape): Shape => ({ kind: 'intersect', children: [a, b] });
const ring = (r: number, inner: number, h: number, origin: Vec, axis: 'x' | 'y' | 'z' = 'z') =>
  subtract(
    cylinder(r, h, origin, axis),
    cylinder(
      inner,
      h + 2,
      origin.map((v, i) => v - (i === (axis === 'x' ? 0 : axis === 'y' ? 1 : 2) ? 1 : 0)) as Vec,
      axis,
    ),
  );
const xRing = (
  outer: number,
  inner: number,
  start: number,
  width: number,
  y = 0,
  z = layout.outputZ,
) => ring(outer, inner, width, [start, y, z], 'x');
const tubeTool = (p: Parameters, z: number, h: number) =>
  cylinder(43 - Number(p.fitClearance), h, [0, 0, z]);
const hex = (af: number, depth: number, position: Vec, axis: 'x' | 'z' = 'z', phase = 0): Shape => {
  const r = af / Math.sqrt(3);
  const points = Array.from({ length: 6 }, (_, i): [number, number] => [
    r * Math.cos(((i + 0.5) * Math.PI) / 3 + (phase * Math.PI) / 180),
    r * Math.sin(((i + 0.5) * Math.PI) / 3 + (phase * Math.PI) / 180),
  ]);
  const shape: Shape = { kind: 'prism', points, depth, origin: 0, axis: 'z' };
  return move(shape, position, axis === 'x' ? [0, 90, 0] : [0, 0, 0]);
};

export function kinematics(p: Parameters, channel = 0) {
  const angle = Number(p[`angle${channel + 1}`]),
    a = (angle * Math.PI) / 180;
  const travel = -layout.arm * Math.sin(a);
  return {
    angle,
    travel,
    followerY: -layout.arm * Math.cos(a),
    followerZ: layout.outputZ + travel,
    nutZ: layout.outputZ + layout.nutOffset + travel,
    screwTurns: travel, // SFK0601: one millimetre per turn.
  };
}

function made(
  id: string,
  name: string,
  shape: Shape,
  color = print,
  printed = true,
): ConfiguredPiece {
  const component = detailComponent(id, name, shape, { nativeRefine: id !== 'upper-disc' });
  component.manufacturing = {
    material: printed ? 'PETG or PA; qualify the selected grade' : 'Steel; select a suitable grade',
    blank: printed ? 'FDM print' : 'Ground round stock',
    processes: printed ? ['printing', 'drilling'] : ['cutting', 'turning', 'drilling'],
    requirements: printed
      ? [
          'Print a fit coupon, finish bearing seats and sliding contact faces, and verify free motion by hand.',
        ]
      : ['Deburr grooves and holes; verify straightness, bearing fits and retaining-ring seating.'],
  };
  return { component, label: name, color, requireSingleSolid: true };
}
function bought(
  part: PartDefinition,
  id: string,
  name: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
  state = 'assembled',
): ConfiguredPiece {
  const component: AssemblyComponent = {
    id,
    name,
    libraryId: part.id,
    parameters,
    state,
    quantity: 1,
    supply: ['bolt-screw', 'hex-nut', 'e-ring', 'threaded-rod'].includes(part.id)
      ? 'standard'
      : 'purchased',
    placement: { translation, rotation },
    procurement: {
      designation: name,
      manufacturer: part.id === 'stepper-motor' ? 'STEPPERONLINE' : 'Select supplier',
      source:
        part.id === 'stepper-motor'
          ? 'https://www.omc-stepperonline.com/image/catalog/dimensions/8HS12-0506S_Dimension.svg'
          : part.id === 'ball-screw' || part.id === 'ball-nut'
            ? 'https://www.wangong.net/product/ball-screw/mini-type-sfk-series-ball-screw.html'
            : 'Select the specified standard size; inspect the delivered article.',
    },
  };
  return { component, label: name, color: steel };
}
/** Bolt library is centred between its tip and head; input is its under-head face. */
function fastener(
  id: string,
  d: 2 | 3 | 5,
  length: number,
  underHead: Vec,
  rotation: Vec = [0, 0, 0],
  countersunk = false,
) {
  const parameters = countersunk
    ? {
        ...bolt.defaults,
        ...bolt.presets.find(
          (p) =>
            p.parameters.diameter === d &&
            p.parameters.length === length &&
            p.parameters.head === 'countersunk',
        )!.parameters,
      }
    : socketBoltParameters(d, length);
  const offset = new Vector3(
    0,
    0,
    (length - Number(parameters.headHeight) * (countersunk ? 2 : 1)) / 2,
  ).applyEuler(new Euler(...(rotation.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'));
  return bought(
    bolt,
    id,
    `${countersunk ? 'Countersunk' : 'Socket'} screw M${d} × ${length}`,
    parameters,
    underHead.map((v, i) => v - offset.getComponent(i)) as Vec,
    rotation,
    'default',
  );
}

function flushFastener(id: string, d: 2, length: number, face: Vec, rotation: Vec) {
  const preset = bolt.presets.find(
    (row) =>
      row.parameters.diameter === d &&
      row.parameters.length === length &&
      row.parameters.head === 'countersunk',
  );
  if (!preset) throw new Error(`Missing countersunk M${d} × ${length}.`);
  const normal = new Vector3(0, 0, 1).applyEuler(
    new Euler(...(rotation.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'),
  );
  const underHead = face.map(
    (v, i) => v - Number(preset.parameters.headHeight) * normal.getComponent(i),
  ) as Vec;
  return fastener(id, d, length, underHead, rotation, true);
}

function motorPlate(p: Parameters) {
  let shape: Shape = tubeTool(p, 0, 3);
  const holes: Shape[] = [cylinder(5, 5, [0, 0, -1])];
  for (let i = 0; i < 4; i++) {
    const cuts = [cylinder(8.15, 5, [21, -17.5, -1])];
    const clock = Math.atan2(-17.5, 23);
    for (const dx of [-7.7, 7.7])
      for (const dy of [-7.7, 7.7])
        cuts.push(
          cylinder(1.1, 5, [
            21 + dx * Math.cos(clock) - dy * Math.sin(clock),
            -17.5 + dx * Math.sin(clock) + dy * Math.cos(clock),
            -1,
          ]),
        );
    holes.push(move(move(union(...cuts), [2, 0, 0]), [0, 0, 0], [0, 0, i * 90]));
  }
  for (const { x, y } of framePosts) holes.push(cylinder(2.65, 5, [x, y, -1]));
  shape = subtract(shape, ...holes);
  return made('motor-plate', 'Printed four-motor mounting plate', shape);
}

function screwDeck(p: Parameters) {
  const bearingRadius = (9 - Number(p.bearingPressFit)) / 2;
  const bosses: Shape[] = [],
    holes: Shape[] = [];
  for (let i = 0; i < 4; i++) {
    bosses.push(move(cylinder(7, 9, [23, -17.5, 23]), [0, 0, 0], [0, 0, i * 90]));
    holes.push(
      move(
        union(
          // A one-millimetre shoulder contacts only the outer ring below the adjacent pair.
          cylinder(4.05, 11, [23, -17.5, 22]),
          cylinder(bearingRadius, 8.1, [23, -17.5, 24]),
        ),
        [0, 0, 0],
        [0, 0, i * 90],
      ),
    );
  }
  for (const { x, y } of framePosts) holes.push(cylinder(2.65, 11, [x, y, 22]));
  return made(
    'front-deck',
    'Printed paired screw bearing disc',
    subtract(union(tubeTool(p, 23, 3), ...bosses), ...holes),
  );
}

function upperDisc(p: Parameters) {
  const bearingRadius = (16 - Number(p.bearingPressFit)) / 2,
    solids: Shape[] = [tubeTool(p, 56, 4)],
    cuts: Shape[] = [];
  for (let i = 0; i < 4; i++) {
    const local = union(
      // Two rectangular lugs grow directly down from the disc, as in the reference.
      box([6, 20.4, 25.2], [16, -10.2, 34.8]),
      box([5.5, 20.4, 25.2], [33.5, -10.2, 34.8]),
      cylinder(7, 6, [23, -17.5, 57]),
    );
    const localCuts: Shape[] = [
      cylinder(7.1, 26, [15, 0, layout.outputZ], 'x'),
      cylinder(bearingRadius, 5.1, [15.9, 0, layout.outputZ], 'x'),
      cylinder(bearingRadius, 5.1, [34, 0, layout.outputZ], 'x'),
      // The purchased nut flange passes this corner below the bearing seat.
      box([6.4, 1.2, 9.3], [15.8, -10.3, 34.7]),
      // The rear bearing slides axially in this unshouldered bore.
      cylinder(4.55, 9, [23, -17.5, 55]),
      // Only the tall fork ears enter the upper-disc plane in the compact stack.
      box([6.8, 6.6, 9], [26.6, -9.3, 55]),
    ];
    solids.push(move(local, [0, 0, 0], [0, 0, i * 90]));
    cuts.push(move(union(...localCuts), [0, 0, 0], [0, 0, i * 90]));
  }
  for (const { x, y } of framePosts) cuts.push(cylinder(2.65, 6, [x, y, 55]));
  return made(
    'upper-disc',
    'Printed upper disc with output and floating screw bearing housings',
    subtract(union(...solids), ...cuts),
  );
}

function sweptHousing(start: number, length: number, radius = 10.5): Shape {
  return union(
    cylinder(radius, length, [start, 0, -3.2], 'x'),
    cylinder(radius, length, [start, 0, 3.2], 'x'),
    box([length, radius * 2, 6.4], [start, -radius, -3.2]),
  );
}
function nutFlangePocket(p: Parameters): Shape {
  const c = Number(p.printClearance),
    bottom = layout.nutOffset - 7.5;
  return clip(
    cylinder(12 + c, 3.6, [23, -17.5, bottom - 0.05]),
    box([30, 16 + 2 * c, 3.8], [8, -25.5 - c, bottom - 0.15]),
  );
}
function carriage(p: Parameters): Shape {
  const c = Number(p.printClearance),
    [x, y] = [23, -17.5],
    bottom = layout.nutOffset - 7.5;
  const flangePocket = nutFlangePocket(p);
  const nutShell = subtract(
    clip(cylinder(14, 15.5, [x, y, bottom]), box([30, 20, 16.5], [9, -27.5, bottom])),
    cylinder(6 + c, 22, [x, y, bottom - 3.5]),
    flangePocket,
    box([30, 14, 14], [9, -11.6, bottom + 3.7]),
  );
  const shape = union(
    nutShell,
    box([4.2, 10.5, 12.4], [29, -14.8, -6.2]),
    box([2.2, 6, 12.4], [31, -18, -6.2]),
    ...[-7, 7].map((z) => cylinder(3, 4.2, [29, -6, z], 'x')),
    ...nutLidAxes.map(([bx, by]) => cylinder(3, 6.05, [bx, by, bottom - 0.05])),
  );
  const holes: Shape[] = [
    cylinder(6 + c, 22, [x, y, bottom - 3.5]),
    flangePocket,
    box([3.6, 10.7, 7.2], [29, -14.9, -3.6]),
    // Ahead of the flange, the 8.5 mm follower bears on a full 2.6 mm wall.
    // Remove the unused thin lip behind that contact band.
    box([4.4, 8.6 + c, 2.7], [28.9, -18.1, -6.3]),
    // Clear the recessed keeper, but leave hard seats at its two retaining ears.
    box([2.15, 9.2, 13], [26.85, -15, -6.5]),
    ...[-7, 7].map((z) => cylinder(3.15, 2.15, [26.85, -6, z], 'x')),
    // The sleeve neck and pin retainer remain clear of the fork's drive faces.
    box([2.5, 5, 4.4], [26.5, -12.2, -2.2]),
    box([0.75, 7.4, 5.4], [32.55, -13, -2.7]),
    box([6.6, 21, 31], [15.7, -10.5, -14]),
    box([6.1, 21, 31], [33.2, -10.5, -14]),
    // The preceding channel's inner output lug passes the left edge of this shell.
    box([21, 6.6, 31], [-10.5, -22.3, -14]),
    sweptHousing(32.55, 1, 6.4),
  ];
  for (const [bx, by] of nutLidAxes)
    holes.push(cylinder(1.1, 10, [bx, by, bottom - 3.5]), hex(4.3, 1.9, [bx, by, bottom + 3.4]));
  for (const z of [-7, 7])
    holes.push(cylinder(1.1, 5, [28.1, -6, z], 'x'), hex(4.3, 2, [29.9, -6, z], 'x'));
  return clip(subtract(shape, ...holes), tubeTool(p, -12, 25));
}
function nutLid(p: Parameters): Shape {
  const bottom = layout.nutOffset - 7.5,
    lidBottom = bottom - 2.55;
  const shape = union(
    clip(cylinder(14, 2.5, [23, -17.5, lidBottom]), box([30, 20, 3], [9, -27.5, lidBottom])),
    ...nutLidAxes.map(([x, y]) => cylinder(3, 2.5, [x, y, lidBottom])),
  );
  return clip(
    subtract(
      shape,
      cylinder(3.4, 4, [23, -17.5, bottom - 3.5]),
      ...nutLidAxes.map(([x, y]) => cylinder(1.1, 4, [x, y, bottom - 3.5])),
      box([6.6, 21, 8], [15.7, -10.5, bottom - 5.5]),
      box([6.1, 21, 8], [33.2, -10.5, bottom - 5.5]),
      box([21, 6.6, 8], [-10.5, -22.3, bottom - 5.5]),
      // Clear the lower fork/keeper ears and their M2 nut; the flange ends at Y−9.5.
      box([6.9, 6.5, 4], [26.5, -9.3, -10.2]),
    ),
    tubeTool(p, bottom - 4.5, 5),
  );
}
function keeper(p: Parameters): Shape {
  const countersink: Shape = {
    kind: 'revolve',
    profile: [
      [0, 0],
      [2.1, 0],
      [1.05, 1.1],
      [0, 1.1],
    ],
  };
  // This connected T-slot opens at negative Y. Slide it over the sleeve flange,
  // then seat and secure it to the fork. The steel flange constrains nut yaw;
  // the larger roller alone contacts the opposing Z drive walls.
  return subtract(
    union(
      box([2.1, 10.5, 12.4], [26.9, -14.8, -6.2]),
      ...[-7, 7].map((z) => cylinder(3, 2.1, [26.9, -6, z], 'x')),
    ),
    box([4, 9.6, 4.4], [26.5, -14.9, -2.2]),
    box([0.8, 9.6, 5.6], [27.7, -14.9, -2.8]),
    cylinder(6.25, 20, [23, -17.5, -11.6]),
    nutFlangePocket(p),
    ...[-7, 7].flatMap((z) => [
      cylinder(1.1, 3, [26.7, -6, z], 'x'),
      move(countersink, [26.85, -6, z], [0, 90, 0]),
    ]),
  );
}
function rocker(p: Parameters, cap = false): Shape {
  const c = Number(p.printClearance);
  // An open, thick-sided pin saddle avoids a fragile 0.05 mm closed eye.
  const ear = [0, -18, 18].reduce<Shape>(
    (shape, angle) =>
      clip(shape, move(box([6, 40, 20], [22, -11.1, -10]), [0, 0, 0], [angle, 0, 0])),
    cylinder(3.5, 4.6, [22.4, -layout.arm, 0], 'x'),
  );
  const shape = union(
    cylinder(6, 4.6, [22.4, 0, 0], 'x'),
    box([4.6, layout.arm - 2, 3], [22.4, -layout.arm, -1.5]),
    ear,
    box([4.6, 10, 3], [22.4, -5, 4.5]),
    box([4.6, 10, 3], [22.4, -5, -7.5]),
  );
  const dBore = clip(
    cylinder(4 + c, 6, [22, 0, 0], 'x'),
    box([6, 6.5 + 2 * c, 10], [22, -3.25 - c, -5]),
  );
  const holes: Shape[] = [dBore, cylinder(1.45, 6, [22, -layout.arm, 0], 'x')];
  for (const z of [-6, 6])
    holes.push(
      cylinder(1.1, 14, [24.4, -7, z], 'y'),
      move(hex(4.3, 1.8, [0, 0, 0]), [24.4, -5, z], [-90, 0, 0]),
    );
  // Leave closing travel beyond the oversized printed bore; the split faces
  // must not bottom out before the hub grips the two shaft flats.
  const splitRelief = c + 0.1;
  return clip(
    subtract(shape, ...holes),
    box([4.7, cap ? 8 - splitRelief : 20 - splitRelief, 20], [22, cap ? splitRelief : -20, -10]),
  );
}
function shaft(): Shape {
  let shape: Shape = cylinder(4, 34, [14, 0, layout.outputZ], 'x');
  const cuts: Shape[] = [];
  // Two size-6 E-clips locate the outer bearing's inner ring; the other bearing floats on the shaft.
  for (const x of [32.66, 39.5]) cuts.push(xRing(4.1, 3, x, 0.74));
  for (const [x, len] of [
    [22.2, 5],
    [42, 6],
  ])
    for (const sign of [-1, 1])
      cuts.push(box([len, 2, 10], [x, sign === 1 ? 3.25 : -5.25, layout.outputZ - 5]));
  cuts.push(cylinder(1.25, 12, [45.5, -6, layout.outputZ], 'y'));
  return subtract(shape, ...cuts);
}

function channel(p: Parameters, i: number): ConfiguredPiece[] {
  const k = kinematics(p, i),
    z = layout.outputZ,
    result: ConfiguredPiece[] = [];
  const fixedScrew: Parameters = {
    ...screwParameters,
    length: layout.screwLength,
    endMachining: 'custom',
    driveJournalDiameter: 4,
    driveJournalLength: 8,
    fixedJournalDiameter: 4,
    fixedJournalLength: 12,
    supportJournalDiameter: 4,
    supportJournalLength: 6,
    fixedGrooveDiameter: 3.2,
    fixedGrooveWidth: 0.64,
    fixedGrooveOffset: 2.86,
    supportGrooveDiameter: 3.2,
    supportGrooveWidth: 0.64,
    supportGrooveOffset: 4.3,
    rotation: ((((k.screwTurns * 360 + 180) % 360) + 360) % 360) - 180,
  };
  result.push(
    bought(
      motor,
      'motor',
      'NEMA 8 · 8HS12-0506S',
      motorParameters,
      [23, -17.5, 0],
      [0, 0, (Math.atan2(-17.5, 23) * 180) / Math.PI],
    ),
  );
  result.push(
    bought(
      screw,
      'screw',
      'SFK0601 screw · custom Ø4 journals',
      fixedScrew,
      [23, -17.5, layout.screwBottom + layout.screwLength / 2],
      [0, 0, 0],
      'screw',
    ),
  );
  result.push(
    bought(
      nut,
      'nut',
      'SFK0601 purchased nut',
      nutParameters,
      [23, -17.5, k.nutZ],
      [0, 0, 90],
      'assembled',
    ),
  );
  // Adjacent forward bearings have a continuous inner/outer stack; the rear bearing floats 1 mm.
  for (const zz of [24, 28, 58])
    result.push(
      bought(bearing, `screw-bearing-${zz}`, '684ZZ · 4 × 9 × 4', screwBearingParameters, [
        23,
        -17.5,
        zz + 2,
      ]),
    );
  result.push(
    made(
      'coupler',
      'Printed split coupling Ø4 / Ø4',
      move(
        subtract(
          union(
            cylinder(5, 16, [21, -17.5, 4]),
            box([11, 3.2, 4], [15.5, -15.7, 5]),
            box([11, 3.2, 4], [15.5, -15.7, 15]),
          ),
          cylinder(2.1, 18, [21, -17.5, 3]),
          box([0.8, 6, 18], [20.6, -17.5, 3]),
          cylinder(1.1, 14, [15, -14, 7], 'x'),
          cylinder(1.1, 14, [15, -14, 17], 'x'),
          hex(4.3, 1.8, [15.5, -14, 7], 'x'),
          hex(4.3, 1.8, [15.5, -14, 17], 'x'),
        ),
        [2, 0, 0],
      ),
      dark,
    ),
  );
  const m2Nut = { ...hexNut.defaults, bore: 2, acrossFlats: 4, height: 1.6, pitch: 0.4 };
  for (const zz of [7, 17]) {
    result.push(fastener(`coupler-bolt-${zz}`, 2, 12, [28.5, -14, zz], [0, 90, 0]));
    result.push(
      bought(
        hexNut,
        `coupler-nut-${zz}`,
        'Hexagon nut M2',
        m2Nut,
        [17.5, -14, zz],
        [0, 90, 0],
        'default',
      ),
    );
  }
  for (const [id, lower, upper] of [
    ['front', 22.9, 23.5],
    ['rear', 62.3, 62.9],
  ] as const) {
    result.push(
      bought(
        eRing,
        `screw-${id}-e-clip`,
        'DIN 6799 3.2 E-clip for Ø4 journal',
        screwEClipParameters,
        [23, -17.5, (lower + upper) / 2],
        [0, 0, Number(fixedScrew.rotation)],
        'default',
      ),
    );
    result.push(
      made(
        `screw-${id}-washer`,
        `Steel inner-ring washer Ø4.1/5.2 × ${id === 'front' ? 0.5 : 0.2}`,
        ring(2.6, 2.05, id === 'front' ? 0.5 : 0.2, [23, -17.5, id === 'front' ? 23.5 : 62]),
        steel,
        false,
      ),
    );
  }
  result.push(
    made(
      'carriage',
      'Printed nonrotating nut carriage with U groove',
      move(carriage(p), [0, 0, z + k.travel]),
      moving,
    ),
  );
  result.push(
    made(
      'nut-lid',
      'Printed removable nut flange retainer',
      move(nutLid(p), [0, 0, z + k.travel]),
      moving,
    ),
  );
  result.push(
    made(
      'keeper',
      'Printed recessed follower keeper',
      move(keeper(p), [0, 0, z + k.travel]),
      moving,
    ),
  );
  for (const [bx, by] of nutLidAxes) {
    result.push(
      fastener(
        `nut-lid-bolt-${bx}`,
        2,
        8,
        [bx, by, z + k.travel + layout.nutOffset - 10.05],
        [180, 0, 0],
      ),
    );
    result.push(
      bought(
        hexNut,
        `nut-lid-nut-${bx}`,
        'Hexagon nut M2',
        m2Nut,
        [bx, by, z + k.travel + layout.nutOffset - 4.0],
        [0, 0, 0],
        'default',
      ),
    );
  }
  for (const zz of [-7, 7]) {
    result.push(
      flushFastener(`keeper-bolt-${zz}`, 2, 4, [26.9, -6, z + k.travel + zz], [0, -90, 0]),
    );
    result.push(
      bought(
        hexNut,
        `keeper-nut-${zz}`,
        'Hexagon nut M2',
        m2Nut,
        [30, -6, z + k.travel + zz],
        [0, 90, 0],
        'default',
      ),
    );
  }
  for (const xx of layout.bearingStarts)
    result.push(
      bought(
        bearing,
        `output-bearing-${xx}`,
        '688ZZ · 8 × 16 × 5',
        outputBearingParameters,
        [xx + 2.5, 0, z],
        [0, 90, 0],
      ),
    );
  result.push(
    made(
      'shaft',
      'Steel Ø8 double-flat output shaft',
      move(move(shaft(), [0, 0, -z]), [0, 0, z], [k.angle, 0, 0]),
      steel,
      false,
    ),
  );
  const ringRotation = new Euler().setFromQuaternion(
    new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), (k.angle * Math.PI) / 180)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)),
    'ZYX',
  );
  for (const xx of [32.7, 39.5])
    result.push(
      bought(
        eRing,
        `shaft-e-clip-${xx}`,
        'DIN 6799 6 E-clip for Ø8 output shaft',
        outputEClipParameters,
        [xx + 0.35, 0, z],
        [ringRotation.x, ringRotation.y, ringRotation.z].map((v) => (v * 180) / Math.PI) as Vec,
        'default',
      ),
    );
  result.push(
    made(
      'shaft-inner-washer',
      'Steel inner-ring washer Ø8.1/10 × 0.5',
      xRing(5, 4.05, 33.5, 0.5),
      steel,
      false,
    ),
  );
  result.push(
    made(
      'rocker',
      'Printed double-flat rocker · 8.5 mm arm',
      move(rocker(p), [0, 0, z], [k.angle, 0, 0]),
      moving,
    ),
  );
  result.push(
    made(
      'rocker-cap',
      'Printed removable rocker hub half',
      move(rocker(p, true), [0, 0, z], [k.angle, 0, 0]),
      moving,
    ),
  );
  for (const zz of [-6, 6]) {
    const local = [
      fastener(`rocker-bolt-${zz}`, 2, 10, [24.4, 5, zz], [-90, 0, 0]),
      bought(
        hexNut,
        `rocker-nut-${zz}`,
        'Hexagon nut M2',
        m2Nut,
        [24.4, -5, zz],
        [-90, 0, 0],
        'default',
      ),
    ];
    for (const piece of local) {
      const v = new Vector3(...piece.component.placement.translation).applyAxisAngle(
        new Vector3(1, 0, 0),
        (k.angle * Math.PI) / 180,
      );
      v.z += z;
      piece.component.placement.translation = v.toArray() as Vec;
      piece.component.placement.rotation[0] += k.angle;
      result.push(piece);
    }
  }
  result.push(
    bought(
      bearing,
      'follower-bearing',
      '683ZZ follower · 3 × 7 × 3',
      followerBearingParameters,
      [driveInterface.rollerCenterX, k.followerY, k.followerZ],
      [0, 90, 0],
    ),
  );
  const pin = subtract(cylinder(1.5, 10.3, [23, 0, 0], 'x'), xRing(1.6, 1.3, 32.5, 0.5, 0, 0));
  result.push(
    made(
      'follower-pin',
      'Steel Ø3 follower pin with retaining groove',
      move(pin, [0, k.followerY, k.followerZ]),
      steel,
      false,
    ),
  );
  result.push(
    made(
      'pin-clip',
      'Steel follower retaining clip',
      move(subtract(xRing(2.2, 1.3, 32.5, 0.5, 0, 0), box([2, 3, 2], [32, 0, -1])), [
        0,
        k.followerY,
        k.followerZ,
      ]),
      steel,
      false,
    ),
  );
  result.push(
    made(
      'follower-spacer',
      'Steel stepped follower sleeve Ø3.1/4 × 2.6 with Ø5 capture flange',
      union(
        xRing(2, 1.55, 26.7, 2.6, k.followerY, k.followerZ),
        xRing(2.5, 1.55, 27.8, 0.6, k.followerY, k.followerZ),
      ),
      steel,
      false,
    ),
  );
  result.push(
    made(
      'follower-washer',
      'Steel follower retaining washer Ø3/4 × 0.2',
      xRing(2, 1.5, 32.3, 0.2, k.followerY, k.followerZ),
      steel,
      false,
    ),
  );
  result.push(
    made(
      'shaft-washer',
      'Steel shaft inner-ring washer Ø8.1/10 × 0.5',
      xRing(5, 4.05, 39, 0.5),
      steel,
      false,
    ),
  );
  // Motor screws engage 2 mm into the source-drawn M2 mounting holes.
  const clock = Math.atan2(-17.5, 23);
  for (const dx of [-7.7, 7.7])
    for (const dy of [-7.7, 7.7])
      result.push(
        fastener(`motor-bolt-${dx}-${dy}`, 2, 5, [
          23 + dx * Math.cos(clock) - dy * Math.sin(clock),
          -17.5 + dx * Math.sin(clock) + dy * Math.cos(clock),
          3,
        ]),
      );
  for (const piece of result) {
    piece.component.id = `channel-${i + 1}-${piece.component.id}`;
    piece.label = `CH${i + 1} · ${piece.label}`;
    piece.component.name = piece.label;
    const placement = piece.component.placement;
    const v = new Vector3(...placement.translation).applyAxisAngle(
      new Vector3(0, 0, 1),
      (i * Math.PI) / 2,
    );
    placement.translation = v.toArray() as Vec;
    placement.rotation = [
      placement.rotation[0],
      placement.rotation[1],
      placement.rotation[2] + i * 90,
    ];
  }
  return result;
}

export function configured(p: Parameters, state: string): ConfiguredPiece[] {
  const pieces = [motorPlate(p), screwDeck(p), upperDisc(p)];
  for (const { x, y, rotation } of framePosts) {
    pieces.push(
      bought(
        standoff,
        `frame-lower-${x}-${y}`,
        'DREMEC 138x20 · M5 × 20 female/female',
        lowerStandoffParameters,
        [x, y, 3],
        [0, 0, rotation],
        'default',
      ),
    );
    pieces.push(
      bought(
        standoff,
        `frame-upper-${x}-${y}`,
        'DREMEC 138x30 · M5 × 30 female/female',
        upperStandoffParameters,
        [x, y, 26],
        [0, 0, rotation],
        'default',
      ),
    );
    pieces.push(
      bought(
        stud,
        `frame-stud-${x}-${y}`,
        'M5 × 16 connector stud',
        { ...stud.defaults, diameter: 5, pitch: 0.8, length: 16 },
        [x, y, 24.5],
        [0, 0, 0],
        'default',
      ),
    );
    pieces.push(fastener(`frame-bottom-bolt-${x}-${y}`, 5, 8, [x, y, 0], [180, 0, 0]));
    pieces.push(fastener(`frame-top-bolt-${x}-${y}`, 5, 10, [x, y, 60]));
  }
  for (let i = 0; i < 4; i++) pieces.push(...channel(p, i));
  if (state === 'exploded')
    for (const piece of pieces) {
      const m = /^channel-(\d)-/.exec(piece.component.id);
      if (m) {
        const a = ((Number(m[1]) - 1) * Math.PI) / 2;
        piece.position = [25 * Math.cos(a), 25 * Math.sin(a), 0];
      } else if (piece.component.id === 'upper-disc') piece.position = [0, 0, 20];
    }
  return state === 'prints'
    ? pieces.filter((piece) => piece.component.manufacturing?.processes.includes('printing'))
    : pieces;
}

export function composition(p: Parameters): AssemblyDefinition {
  // Pose never changes a local fabrication recipe or the specification identity.
  const neutral = { ...p, angle1: 0, angle2: 0, angle3: 0, angle4: 0 };
  return {
    components: configured(neutral, 'assembled').map((piece) => piece.component),
    issues: [
      'Demonstration stand: verify fit and slow hand-operated travel on the purchased screw/nut and bearings before powered demonstration.',
      'SFK0601 dimensions identify the nut family. The Ø4 shaft-end machining and DIN 6799 grooves are custom operations, not a supplier standard end code.',
      'Qualify the printed fits and fastener retention. The paired radial screw bearings have no assigned preload, thrust rating or service life.',
    ],
  };
}

export function fitSleeve(p: Parameters): Shape {
  const shell = ring(45, 43, 106, [0, 0, -30]);
  // Remove half of the reference tube for an unobstructed inspection view.
  return subtract(
    shell,
    box([100, 50, 109], [-50, -50, -31]),
    ...[0, 1, 2, 3].map((i) =>
      move(
        union(
          cylinder(6, 12, [40, 0, layout.outputZ], 'x'),
          box([12, 12, 32], [40, -6, layout.outputZ]),
        ),
        [0, 0, 0],
        [0, 0, i * 90],
      ),
    ),
  );
}
