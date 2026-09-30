import { pivotPieces, rotateHead } from './pivot-head';
import { clampPieces } from './clamps';
import { feedAxis } from './feed-axis';
import { motorPieces } from '../../machine-drive-motor/lib/model';
import { tubeSection } from './profiles';
import { bearingPieces, maCylinderPieces, socketScrew } from './hardware';
import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';
import { BOTTOM, TABLE, SENSOR_OFFSET, WHEEL_CENTRE, pose, section, trayLink } from './layout';

export interface MachinePiece extends Piece {
  group: string;
  procurement: 'MAKE' | 'BUY' | 'REFERENCE';
}
const C = {
  frame: 0x536675,
  head: 0x167c83,
  steel: 0xa6b0b8,
  dark: 0x303c46,
  air: 0xb4bec8,
  blue: 0x3179bc,
  stock: 0xcbd0d4,
  part: 0xecac39,
  guard: 0x7897a5,
};
const transform = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => {
  if (child.kind === 'transform' && rotation.every((v) => v === 0))
    return { ...child, translation: child.translation.map((v, i) => v + translation[i]) as Vec };
  return { kind: 'transform', child, translation, rotation };
};
const tubeBeam = (size: Vec, at: Vec, axis: 0 | 1 | 2): Shape => {
  const inner = size.map((v, i) => (i === axis ? v + 2 : v - 6)) as Vec;
  return subtract(box(size, at), box(inner, at.map((v, i) => v + (i === axis ? -1 : 3)) as Vec));
};
function between(radius: number, a: Vec, b: Vec): Shape {
  const d = b.map((v, i) => v - a[i]),
    length = Math.hypot(...d);
  const pitch = (Math.acos(d[2] / length) * 180) / Math.PI;
  const yaw = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
  return transform(cylinder(radius, length, [0, 0, 0]), a, [0, pitch, yaw]);
}
export function stockShape(p: Parameters, length: number, start: number, bottom = TABLE): Shape {
  const { w, h, wall } = section(p);
  return tubeSection(String(p.profile), w, h, wall, length, start, bottom);
}
/** One pivoting bow with stationary drive, one indexing shuttle and one dropping shelf. */
export function machinePieces(p: Parameters, state: string): MachinePiece[] {
  const out: MachinePiece[] = [],
    { w, h } = section(p),
    q = pose(p, state);
  const add = (
    label: string,
    shape: Shape,
    group: string,
    color = C.steel,
    procurement: MachinePiece['procurement'] = 'MAKE',
  ) => out.push({ label, shape, group, color, procurement });
  const b = (label: string, size: Vec, at: Vec, group: string, color = C.steel) =>
    add(label, box(size, at), group, color);
  const c = (
    label: string,
    r: number,
    length: number,
    at: Vec,
    axis: 'x' | 'y' | 'z',
    group: string,
    color = C.steel,
  ) => add(label, cylinder(r, length, at, axis), group, color, 'BUY');
  const purchased = (
    items: { label: string; shape: Shape; color: number }[],
    at: Vec,
    rotation: Vec,
    group: string,
    prefix: string,
  ) => {
    for (const item of items)
      add(
        `${prefix} / ${item.label}`,
        transform(item.shape, at, rotation),
        group,
        item.color,
        'BUY',
      );
  };
  const guards = Boolean(p.showGuards) && state !== 'mechanism';

  // The roller bed is stationary. Moving jaws bridge above its side members.
  for (const y of [-170, 130]) {
    add(
      `Infeed RHS side rail ${y}`,
      tubeBeam([2100, 40, 60], [-2100, y, 750], 0),
      'Roller bed',
      C.frame,
    );
    for (const x of [-2050]) {
      add(
        `Roller bed leg ${x} ${y}`,
        tubeBeam([40, 40, 675], [x, y, 75], 2),
        'Roller bed',
        C.frame,
      );
      c(`Adjustable foot ${x} ${y}`, 35, 20, [x + 20, y + 20, 20], 'z', 'Roller bed', C.dark);
      add(
        `Foot stem M20x2.5 ${x} ${y}`,
        cylinder(10, 40, [x + 20, y + 20, 40], 'z', { pitch: 2.5 }),
        'Roller bed',
      );
    }
  }
  for (let x = -2020; x <= -580; x += 160) {
    add(
      `Passive roller D50 ${x}`,
      subtract(
        cylinder(25, 230, [x, -115, 875], 'y'),
        cylinder(14.05, 232, [x, -116, 875], 'y'),
        cylinder(22, 214, [x, -107, 875], 'y'),
      ),
      'Roller bed',
    );
    c(`Roller axle ${x}`, 6, 304, [x, -152, 875], 'y', 'Roller bed', C.dark);
    for (const y of [-115, 107])
      for (const item of bearingPieces(`6001 roller ${x} ${y}`, [x, y, 875], 'y', 12, 28, 8))
        add(item.label, item.shape, 'Roller bed', item.color, 'BUY');
    for (const y of [-145, 125])
      add(
        `Roller pedestal ${x} ${y}`,
        subtract(box([25, 20, 80], [x - 12.5, y, 810]), cylinder(6.1, 22, [x, y - 1, 875], 'y')),
        'Roller bed',
        C.frame,
      );
    for (const y of [-152, 145])
      add(
        `Roller M12 retaining collar ${x} ${y}`,
        subtract(
          cylinder(10, 7, [x, y, 875], 'y'),
          cylinder(6.05, 9, [x, y - 1, 875], 'y', { pitch: 1.75, internal: true }),
        ),
        'Roller bed',
        C.dark,
        'BUY',
      );
  }
  for (const x of [-2050])
    add(`Infeed cross tie ${x}`, tubeBeam([40, 260, 40], [x, -130, 710], 1), 'Roller bed', C.frame);
  for (const x of [-780, 230])
    for (const y of [-630, 590]) {
      add(`Saw leg ${x} ${y}`, tubeBeam([60, 60, 680], [x, y, 40], 2), 'Fixed frame', C.frame);
      b(`Saw foot ${x} ${y}`, [110, 100, 12], [x - 25, y - 20, 28], 'Fixed frame', C.dark);
    }
  for (const y of [-630, 590])
    add(`Saw base side ${y}`, tubeBeam([1070, 60, 80], [-780, y, 720], 0), 'Fixed frame', C.frame);
  // No transverse member beneath the drop path (X4..115, Y-100..100).
  for (const x of [-780, 230])
    add(
      `Saw frame tie ${x}`,
      tubeBeam([60, 1160, 80], [x, -570, x < 0 ? 640 : 720], 1),
      'Fixed frame',
      C.frame,
    );
  add(
    'Moving head rear crossbeam',
    tubeBeam([60, 1060, 60], [-150, -530, q.edge + 320], 1),
    'Head carriage',
    C.head,
  );
  out.push(...pivotPieces(q.headAngle));

  // Blade loop: flat around wheel rims, twisted 90 degrees only outside the cutting guides.
  for (const side of [-1, 1]) {
    const y = side * WHEEL_CENTRE,
      z = q.edge + 160;
    add(
      `Band wheel ${side}`,
      subtract(cylinder(149.7, 24, [-12, y, z], 'x'), cylinder(15, 26, [-13, y, z], 'x')),
      'Band head',
      C.steel,
      'BUY',
    );
    if (side > 0) {
      c(`Wheel shaft ${side}`, 15, 100, [-100, y, z], 'x', 'Band head', C.dark);
      add(
        `Wheel bearing and tension slide ${side}`,
        subtract(
          box([50, 95, 90], [-100, y - 47.5, z - 45]),
          cylinder(31.05, 52, [-101, y, z], 'x'),
          ...(side > 0 ? [cylinder(7.1, 100, [-70, y + 30, q.edge + 198], 'y')] : []),
        ),
        'Band head',
        C.blue,
      );
      for (const bx of [-99, -67])
        for (const item of bearingPieces(
          `6206 wheel ${side} bearing ${bx}`,
          [bx, y, z],
          'x',
          30,
          62,
          16,
        ))
          add(item.label, item.shape, 'Band head', item.color, 'BUY');
    }
    add(
      `Wheel back plate ${side}`,
      subtract(
        box([10, 325, 325], [-110, y - 162.5, q.edge - 2.5]),
        side < 0
          ? box([12, 105.2, 105.2], [-111, y - 52.6, z - 52.6])
          : cylinder(27.1, 12, [-111, y, z], 'x'),
        ...[-150, 80].flatMap((dy) =>
          [-150, 80].map((dz) => box([12, 70, 70], [-111, y + dy, z + dz])),
        ),
      ),
      'Head carriage',
      C.head,
    );
    b(
      `Wheel plate top attachment ${side}`,
      [50, 95, 45],
      [-150, y - 47.5, q.edge + 290],
      'Head carriage',
      C.head,
    );
    // Outer half-wrap, constructed as a thin annular prism in Y/Z and extruded along X.
    const rings: Vec[][] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = -Math.PI / 2 + (side * Math.PI * i) / 32;
      rings.push([
        [-10, y + 150 * Math.cos(angle), z + 150 * Math.sin(angle)],
        [10, y + 150 * Math.cos(angle), z + 150 * Math.sin(angle)],
        [10, y + 150.9 * Math.cos(angle), z + 150.9 * Math.sin(angle)],
        [-10, y + 150.9 * Math.cos(angle), z + 150.9 * Math.sin(angle)],
      ]);
    }
    add(`Band wheel wrap ${side}`, { kind: 'loft', rings }, 'Blade', C.dark, 'BUY');
    const guideY = side < 0 ? -150 : Math.max(140, w + 30);
    const twist: Vec[][] = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10,
        a = ((1 - f) * Math.PI) / 2;
      const yy = guideY + (y - side * 65 - guideY) * f;
      const cz = q.edge + 10 + -0.45 * f;
      twist.push(
        [
          [-10, -0.45],
          [10, -0.45],
          [10, 0.45],
          [-10, 0.45],
        ].map(
          ([u, v]) =>
            [u * Math.cos(a) - v * Math.sin(a), yy, cz + u * Math.sin(a) + v * Math.cos(a)] as Vec,
        ),
      );
    }
    add(
      `Blade twist outside stock ${side}`,
      { kind: 'loft', rings: twist },
      'Blade',
      C.dark,
      'BUY',
    );
    b(
      `Flat band approach to wheel ${side}`,
      [20, 65, 0.9],
      [-10, side < 0 ? y : y - 65, q.edge + 9.1],
      'Blade',
      C.dark,
    );
    for (const x of [-1.55, 0.55])
      b(
        `Carbide side guide ${side} ${x}`,
        [1, 16, 16],
        [x, guideY - side * 10 - 8, q.edge + 3],
        'Blade guides',
        C.steel,
      );
    b(
      `Guide arm ${side}`,
      [113, 22, 15],
      [-125, guideY - 11, q.edge + 130],
      'Blade guides',
      C.head,
    );
    b(
      `Guide arm hanger ${side}`,
      [24, 22, 210],
      [-149, guideY - 11, q.edge + 135],
      'Head carriage',
      C.head,
    );
    b(
      `Guide upper bridge ${side}`,
      [49, 22, 15],
      [-149, guideY - 11, q.edge + 330],
      'Head carriage',
      C.head,
    );
    add(
      `Guide carrier ${side}`,
      subtract(
        box([28, 16, 145], [-12, guideY - side * 10 - 8, q.edge]),
        box([1.1, 18, 21], [-0.55, guideY - side * 10 - 9, q.edge - 0.5]),
        ...[-1.55, 0.55].map((x) => box([1, 16, 16], [x, guideY - side * 10 - 8, q.edge + 3])),
      ),
      'Blade guides',
      C.steel,
    );
    if (guards) {
      b(
        `Wheel enclosure front ${side}`,
        [4, 330, 330],
        [32, y - 165, q.edge - 5],
        'Guards',
        C.head,
      );
      add(
        `Wheel enclosure outer ${side}`,
        subtract(
          box([132, 4, 330], [-100, y + side * 167 - 2, q.edge - 5]),
          box([30, 6, 6], [-100, y + side * 167 - 3, q.edge + 320]),
        ),
        'Guards',
        C.head,
      );
    }
  }
  b(
    'Straight cutting band 20x0.9',
    [0.9, Math.max(140, w + 30) + 150, 20],
    [-0.45, -150, q.edge],
    'Blade',
    C.dark,
  );
  b(
    'Band upper return',
    [20, WHEEL_CENTRE * 2, 0.9],
    [-10, -WHEEL_CENTRE, q.edge + 310],
    'Blade',
    C.dark,
  );
  add(
    'Band tension screw M14x2',
    cylinder(7, 65, [-70, WHEEL_CENTRE + 30, q.edge + 198], 'y', { pitch: 2 }),
    'Band head',
    C.dark,
  );
  purchased(
    motorPieces({ model: 'bevi90l2' }),
    [-260, -WHEEL_CENTRE, q.edge + 160],
    [90, 0, 90],
    'Band drive',
    'Band BEVI 90L-2',
  );
  add(
    'Band reducer housing with input and output seats',
    subtract(
      box([130, 115, 115], [-260, -WHEEL_CENTRE - 57.5, q.edge + 102.5]),
      cylinder(27, 132, [-261, -WHEEL_CENTRE, q.edge + 160], 'x'),
    ),
    'Band drive',
    C.blue,
    'BUY',
  );
  add(
    'Motor gearbox output hub',
    subtract(
      cylinder(27, 27, [-130, -WHEEL_CENTRE, q.edge + 160], 'x'),
      cylinder(15.05, 32, [-131, -WHEEL_CENTRE, q.edge + 160], 'x'),
    ),
    'Band drive',
    C.steel,
    'BUY',
  );
  b(
    'Band motor mounting shelf',
    [470, 195, 12],
    [-600, -WHEEL_CENTRE - 102, q.edge + 58],
    'Band drive',
    C.head,
  );
  out.push(...feedAxis(q.carriage));
  for (const x of [-327, -202])
    b(`Feed proximity switch ${x}`, [25, 12, 15], [x, 300, 815], 'Sensors', C.blue);
  for (const x of [-327, -202]) {
    add(
      `Feed limit switch bracket ${x}`,
      union(box([25, 32, 12], [x, 280, 740]), box([25, 12, 63], [x, 300, 752])),
      'Shuttle',
      C.frame,
    );
  }
  b('Feed limit target', [30, 12, 15], [q.carriage - 15, 290, 830], 'Feed carriage');

  out.push(...clampPieces(p, q));
  add(
    'Station support plate ends before kerf',
    subtract(box([134, 240, 12], [-148, -110, 888]), box([38, 117, 4.1], [-74, 14, 896])),
    'Fixed vise',
  );
  b('Station underside support', [80, 28, 41], [-130, 100, 847], 'Fixed frame', C.frame);
  b('Station vise base plate', [134, 510, 12], [-148, -220, 835], 'Fixed frame', C.frame);
  for (const y of [-170, 130])
    b(`Station mounting riser ${y}`, [134, 40, 25], [-148, y, 810], 'Fixed frame', C.frame);

  // One BGS side sensor scans the clamped bar while the shuttle is open.
  // Its cantilever passes above the L wall and stays inside the wheel-plate gap.
  const beamX = q.carriage + SENSOR_OFFSET;
  add(
    'Carriage optical mounting mast',
    union(
      box([20, 36, 8], [q.carriage - 10, -113, 855]),
      box([20, 12, 177], [q.carriage - 10, -110, 863]),
    ),
    'Feed carriage',
    C.frame,
  );
  b(
    'Carriage optical arm',
    [SENSOR_OFFSET + 18, 12, 12],
    [q.carriage - 10, -107, 1040],
    'Feed carriage',
    C.frame,
  );
  add(
    'Carriage optical height slot',
    subtract(
      box([16, 4, 140], [beamX - 8, -107, 900]),
      box([4.4, 6, 75], [beamX - 2.2, -108, 905]),
    ),
    'Feed carriage',
    C.frame,
  );
  b(
    'Carriage E3Z-LL81 BGS sensor',
    [10.8, 20, 31],
    [beamX - 5.4, -103, TABLE + Math.max(16, h / 2) - 15.5],
    'Feed carriage',
    C.blue,
  );
  b('Loading nose mark X-30 to X-15', [15, 10, 0.1], [-30, -80, TABLE], 'Sensors', C.part);

  // Shelf rotates around X, so it never sweeps into the X=0 cutting plane.
  const flap = (shape: Shape) => transform(shape, [0, -100, 895], [q.trayAngle, 0, 0]);
  add(
    'Offcut support shelf 30-100 mm',
    flap(subtract(box([111, 200, 6], [4, 0, -1]), cylinder(5.1, 113, [3, 0, 0], 'x'))),
    'Drop support',
    C.part,
  );
  add(
    'Shelf hinge barrel',
    flap(subtract(cylinder(8, 93, [22, 0, 0], 'x'), cylinder(5.1, 95, [21, 0, 0], 'x'))),
    'Drop support',
    C.part,
  );
  add('Shelf folded stiffener', flap(box([93, 6, 24], [22, 185, -25])), 'Drop support', C.part);
  c('Shelf hinge pin', 5, 180, [4, -100, 895], 'x', 'Drop support', C.dark);
  for (const x of [116, 165])
    add(
      `Shelf hinge bearing ${x}`,
      subtract(box([13, 32, 24], [x, -116, 883]), cylinder(9.05, 17, [x - 1, -100, 895], 'x')),
      'Drop support',
      C.steel,
    );
  for (const x of [116, 165])
    add(
      `Shelf bronze journal bush ${x}`,
      subtract(cylinder(9, 13, [x, -100, 895], 'x'), cylinder(5.1, 17, [x - 1, -100, 895], 'x')),
      'Drop support',
      0xb29a58,
      'BUY',
    );
  b('Shelf hinge fixed bearer', [125, 50, 23], [115, -135, 860], 'Fixed frame', C.frame);
  b('Shelf hinge bearer post', [20, 23, 60], [230, -135, 800], 'Fixed frame', C.frame);
  add(
    'Shelf external crank',
    flap(
      subtract(
        union(
          box([6, 80, 12], [130, -75, -6]),
          box([6, 80, 12], [154, -75, -6]),
          box([18, 14, 12], [136, -10, -6]),
          box([22, 10, 12], [160, -55, -6]),
        ),
        cylinder(5.1, 32, [129, 0, 0], 'x'),
        cylinder(5.1, 32, [129, -70, 0], 'x'),
      ),
    ),
    'Drop support',
    C.part,
  );
  const link = trayLink(q.trayAngle),
    vec = link.tip.map((v, i) => v - link.base[i]) as Vec;
  const bodyEnd = link.base.map((v, i) => v + (vec[i] * 205) / link.length) as Vec;
  for (const item of maCylinderPieces('Shelf MA32x100', [0, 0, 0], 'z', 187))
    add(
      item.label,
      transform(transform(item.shape, [0, 0, 205], [180, 0, 0]), link.base, [
        (Math.atan2(-vec[1], vec[2]) * 180) / Math.PI,
        0,
        0,
      ]),
      'Drop actuator',
      item.color,
      'BUY',
    );
  const rodEnd = link.tip.map((v, i) => v - (vec[i] * 12) / link.length) as Vec;
  const linkRotation: Vec = [(Math.atan2(-vec[1], vec[2]) * 180) / Math.PI, 0, 0];
  add(
    'Shelf rear mounting eye and neck',
    union(
      subtract(
        cylinder(10, 12, [link.base[0] - 6, link.base[1], link.base[2]], 'x'),
        cylinder(5.1, 14, [link.base[0] - 7, link.base[1], link.base[2]], 'x'),
      ),
      transform(cylinder(5, 18, [0, 0, 6]), link.base, linkRotation),
    ),
    'Drop actuator',
  );
  add(
    'Shelf front threaded rod eye',
    subtract(
      union(
        cylinder(10, 12, [link.tip[0] - 6, link.tip[1], link.tip[2]], 'x'),
        transform(cylinder(8, 8, [0, 0, -14]), link.tip, linkRotation),
      ),
      cylinder(5.1, 14, [link.tip[0] - 7, link.tip[1], link.tip[2]], 'x'),
      transform(cylinder(5.1, 8, [0, 0, -15]), link.tip, linkRotation),
    ),
    'Drop actuator',
  );
  add(
    'Shelf MA32x100 rod and adapters',
    between(5, bodyEnd, rodEnd),
    'Drop actuator',
    C.steel,
    'BUY',
  );
  for (const [name, at] of [
    ['base', link.base],
    ['rod', link.tip],
  ] as const)
    c(`Shelf ${name} pivot pin`, 5, 35, [at[0] - 17.5, at[1], at[2]], 'x', 'Drop actuator', C.dark);
  for (const x of [125, 157])
    add(
      `Shelf actuator clevis cheek ${x}`,
      subtract(box([8, 40, 70], [x, -240, 560]), cylinder(5.1, 10, [x - 1, -220, 620], 'x')),
      'Fixed frame',
      C.frame,
    );
  b('Shelf pedestal support', [230, 35, 40], [20, -235, 520], 'Fixed frame', C.frame);
  b('Shelf pedestal hanger', [20, 35, 160], [230, -235, 560], 'Fixed frame', C.frame);
  b('Shelf level mechanical stop', [20, 10, 15], [170, -155, 874], 'Drop support', C.dark);
  b(
    'Shelf stop post outside falling part',
    [20, 10, 124],
    [170, -155, 750],
    'Fixed frame',
    C.frame,
  );
  b('Shelf stop mounting cantilever', [60, 10, 15], [170, -155, 735], 'Fixed frame', C.frame);
  // Open-top removable collection box. The chute is clear of the complete shelf sweep.
  add(
    'Collection box',
    subtract(box([252, 360, 330], [-12, -140, 90]), box([246, 354, 331], [-9, -137, 93])),
    'Collection',
    C.blue,
  );
  for (const x of [-3, 185])
    b(`Drop chute side ${x}`, [3, 300, x < 0 ? 300 : 420], [x, -120, 420], 'Collection', C.frame);
  b('Drop chute rear wall', [191, 3, 300], [-3, -123, 420], 'Collection', C.frame);
  b('Drop chute front wall', [191, 3, 420], [-3, 180, 420], 'Collection', C.frame);
  for (const y of [-143, 183])
    b(`Part passage sensor ${y}`, [24, 20, 30], [45, y, 550], 'Sensors', C.blue);
  b('Box presence switch', [25, 15, 30], [205, 180, 110], 'Sensors', C.blue);

  b('Chute rear hanger', [3, 25, 20], [185, -120, 840], 'Fixed frame', C.frame);
  add(
    'Chute front hanger',
    union(box([20, 20, 40], [230, 170, 800]), box([42, 20, 20], [188, 170, 820])),
    'Fixed frame',
    C.frame,
  );
  b('Control cabinet', [310, 150, 390], [-490, 405, 850], 'Controls', C.dark);
  b('Operator length display', [180, 10, 90], [-425, 555, 1100], 'Controls', C.blue);
  c('Emergency stop', 20, 20, [-220, 555, 1050], 'y', 'Controls', 0xd74035);
  b('24 V valve manifold mounting rail', [310, 90, 12], [-490, 415, 698], 'Pneumatics', C.air);
  for (let i = 0; i < 5; i++) {
    const x = -480 + i * 31;
    add(
      `4V210 valve spool body ${i + 1}`,
      subtract(
        box([22, 85, 32], [x, 410, 710]),
        ...[426, 450, 474].map((y) =>
          cylinder(6.4, 10, [x + 11, y, 733], 'z', { pitch: 1.337, internal: true }),
        ),
      ),
      'Pneumatics',
      C.air,
      'BUY',
    );
    b(`4V210 DC24V coil ${i + 1}`, [22, 35, 36], [x, 375, 710], 'Pneumatics', C.dark);
    b(`4V210 connector ${i + 1}`, [20, 25, 22], [x + 1, 380, 746], 'Pneumatics', C.blue);
    c(`4V210 manual override ${i + 1}`, 3, 3, [x + 22, 420, 724], 'x', 'Pneumatics', 0xdc7a42);
  }
  c('AFR2000 filter bowl', 22, 100, [-450, 520, 575], 'z', 'Pneumatics', C.air);
  b('Air filter regulator body', [60, 50, 50], [-480, 505, 675], 'Pneumatics', C.blue);
  b('AR2000 clamp pressure regulator', [45, 45, 55], [-390, 500, 635], 'Pneumatics', C.blue);
  b('AR2000 descent pressure regulator', [45, 45, 55], [-315, 500, 635], 'Pneumatics', C.blue);
  for (const x of [-450, -367, -292])
    c(`Regulator gauge ${x}`, 20, 14, [x, x === -450 ? 555 : 545, 690], 'y', 'Pneumatics', C.dark);
  if (guards) {
    add(
      'Upper band return channel',
      union(
        box([40, 2 * WHEEL_CENTRE, 4], [-20, -WHEEL_CENTRE, q.edge + 315]),
        box([2, 2 * WHEEL_CENTRE, 20], [-20, -WHEEL_CENTRE, q.edge + 295]),
        box([2, 2 * WHEEL_CENTRE, 20], [18, -WHEEL_CENTRE, q.edge + 295]),
      ),
      'Guards',
      C.head,
    );
    for (const side of [-1, 1])
      b(
        `Return guard spacer ${side}`,
        [70, 22, 11],
        [-90, (side < 0 ? -150 : Math.max(140, w + 30)) - 11, q.edge + 319],
        'Guards',
        C.head,
      );
    b('Cut zone front screen', [4, 310, 400], [300, -130, 850], 'Guards', C.guard);
    b('Infeed pinch-zone cover', [570, 4, 380], [-610, 610, 845], 'Guards', C.guard);
    b('Rear pinch-zone cover', [570, 4, 380], [-610, -650, 845], 'Guards', C.guard);
  }
  const cutEnd = Number(p.cutLength) + Number(p.kerf) / 2;
  const end = ['loading', 'scanning'].includes(state)
    ? -25
    : state === 'feeding'
      ? -Number(p.kerf) / 2
      : cutEnd;
  if (['bottom', 'dropping', 'raising', 'returning'].includes(state)) {
    add(
      'Held remaining stock',
      stockShape(
        p,
        Number(p.stockLength) - Number(p.cutLength) - Number(p.kerf),
        -Number(p.stockLength) + cutEnd,
      ),
      'Workpiece',
      C.stock,
      'REFERENCE',
    );
    if (state !== 'returning')
      add(
        'Cut part',
        stockShape(p, Number(p.cutLength), Number(p.kerf) / 2, state === 'dropping' ? 470 : TABLE),
        'Workpiece',
        C.part,
        'REFERENCE',
      );
  } else
    add(
      'Operator loaded bar',
      stockShape(p, Number(p.stockLength), end - Number(p.stockLength)),
      'Workpiece',
      C.stock,
      'REFERENCE',
    );
  // One cabinet post cantilevers from the common frame, with no extra floor feet.
  b('Control pedestal top', [380, 270, 10], [-1190, 285, 840], 'Control stand', C.frame);
  add(
    'Single control profile',
    tubeBeam([40, 40, 160], [-1190, 505, 680], 2),
    'Control stand',
    C.frame,
  );
  add(
    'Control frame cantilever',
    tubeBeam([410, 40, 40], [-1190, 505, 640], 0),
    'Control stand',
    C.frame,
  );
  b('Valve bank bearer', [360, 20, 20], [-1190, 305, 678], 'Control stand', C.frame);
  b('Valve bearer return bracket', [40, 180, 20], [-1190, 325, 678], 'Control stand', C.frame);
  for (const y of [-630, 590])
    add(
      `Lower frame side tie ${y}`,
      tubeBeam([950, 60, 40], [-720, y, 220], 0),
      'Fixed frame',
      C.frame,
    );
  for (const y of [-170, 130])
    b(`Infeed frame saddle ${y}`, [100, 60, 30], [-800, y - 10, 720], 'Fixed frame', C.frame);
  for (const x of [-390, -315])
    b(`Pressure regulator hanger ${x}`, [45, 5, 8], [x, 500, 690], 'Pneumatics', C.frame);

  for (const item of out)
    if (item.group === 'Workpiece') item.shape = transform(item.shape, [0, w / 2 - 60, 0]);

  // Machined holes in welded members are cut before the purchased fasteners are fitted.
  const fasten = (
    name: string,
    labels: string[],
    at: Vec,
    axis: 'x' | 'y' | 'z',
    diameter: number,
    length: number,
    group: string,
    reverse = false,
  ) => {
    const start = [...at] as Vec;
    start[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] -= reverse ? 0.1 : length + 0.1;
    for (const label of labels) {
      const part = out.find((v) => v.label === label);
      if (!part) throw new Error(`Missing mounting part: ${label}`);
      part.shape = subtract(part.shape, cylinder(diameter / 2 + 0.15, length + 0.2, start, axis));
    }
    const item = socketScrew(name, [0, 0, 0], 'z', diameter, length);
    const rotation: Vec =
      axis === 'x'
        ? [0, reverse ? -90 : 90, 0]
        : axis === 'y'
          ? [reverse ? 90 : -90, 0, 0]
          : [reverse ? 180 : 0, 0, 0];
    add(name, transform(item.shape, at, rotation), group, item.color, 'BUY');
  };
  // End plates transfer transverse-beam loads through the same bolted corner straps.
  for (const x of [-780, 230]) {
    const tie = out.find((v) => v.label === `Saw frame tie ${x}`)!;
    const z = x < 0 ? 640 : 720;
    tie.shape = union(tie.shape, box([60, 10, 80], [x, -570, z]), box([60, 10, 80], [x, 580, z]));
  }
  for (const x of [-780, 230])
    for (const y of [-630, 590]) {
      const front = y > 0,
        outer = front ? 650 : -638;
      const label = `Frame bolted corner strap ${x} ${y}`;
      b(label, [100, 8, 150], [x - 20, outer, 660], 'Fixed frame', C.steel);
      for (const z of [680, 760])
        for (const dx of [15, 45]) {
          const throughTie = z === (x < 0 ? 680 : 760);
          const length = throughTie ? 90 : 80;
          const headY = front ? 658 : -638;
          const nutY = front ? (throughTie ? 570 : 580) : throughTie ? -558 : -568;
          const washerY = front ? (throughTie ? 578 : 588) : throughTie ? -560 : -570;
          fasten(
            `Frame M8x${length} ${x} ${y} ${z} ${dx}`,
            [label, `Saw leg ${x} ${y}`, `Saw base side ${y}`, `Saw frame tie ${x}`],
            [x + dx, headY, z],
            'y',
            8,
            length,
            'Fixed frame',
            !front,
          );
          add(
            `Frame crush sleeve ${x} ${y} ${z} ${dx}`,
            subtract(
              cylinder(6, 54, [x + dx, y + 3, z], 'y'),
              cylinder(4.15, 56, [x + dx, y + 2, z], 'y'),
            ),
            'Fixed frame',
            C.steel,
          );
          add(
            `Frame M8 nut ${x} ${y} ${z} ${dx}`,
            subtract(
              cylinder(7.5, 8, [x + dx, nutY, z], 'y'),
              cylinder(4.15, 10, [x + dx, nutY - 1, z], 'y', { pitch: 1.25, internal: true }),
            ),
            'Fixed frame',
            C.dark,
            'BUY',
          );
          add(
            `Frame M8 washer ${x} ${y} ${z} ${dx}`,
            subtract(
              cylinder(9, 2, [x + dx, washerY, z], 'y'),
              cylinder(4.2, 4, [x + dx, washerY - 1, z], 'y'),
            ),
            'Fixed frame',
            C.steel,
            'BUY',
          );
        }
    }
  for (const y of [-170, 130])
    for (const x of [-770, -735])
      fasten(
        `Infeed saddle M8x50 ${x} ${y}`,
        [`Infeed frame saddle ${y}`, 'Saw frame tie -780', `Infeed RHS side rail ${y}`],
        [x, y + 20, 753],
        'z',
        8,
        50,
        'Roller bed',
      );
  fasten(
    'Optical mast base M5x25',
    [
      'Carriage optical mounting mast',
      'Shuttle top upright mounting foot',
      'Feed bridge plate below rollers',
    ],
    [q.carriage, -82, 863],
    'z',
    5,
    25,
    'Feed carriage',
  );
  for (const dx of [-5, 5])
    fasten(
      `Optical arm M4x25 ${dx}`,
      ['Carriage optical arm', 'Carriage optical mounting mast'],
      [q.carriage + dx, -101, 1052],
      'z',
      4,
      25,
      'Feed carriage',
    );
  for (const dz of [-10, 10])
    fasten(
      `Optical sensor M3x30 ${dz}`,
      ['Carriage E3Z-LL81 BGS sensor', 'Carriage optical height slot'],
      [beamX, -83, TABLE + Math.max(16, h / 2) + dz],
      'y',
      3,
      30,
      'Feed carriage',
    );
  // The lift base transfers load to the existing main leg through a removable flange.
  const liftBase = out.find((v) => v.label === 'Free-end cylinder fixed base and frame tie')!;
  liftBase.shape = union(liftBase.shape, box([100, 8, 80], [210, 582, 200]));
  for (const x of [245, 275])
    for (const z of [210, 270]) {
      const insert = `Lift base backing block ${x} ${z}`;
      b(insert, [14, 10, 14], [x - 7, 593, z - 7], 'Fixed frame', C.steel);
      fasten(
        `Lift frame M8x25 ${x} ${z}`,
        ['Free-end cylinder fixed base and frame tie', 'Saw leg 230 590', insert],
        [x, 582, z],
        'y',
        8,
        25,
        'Fixed frame',
        true,
      );
    }
  // Cabinet post and frame cantilever use bolted flanges, not separate floor feet.
  const controlArm = out.find((v) => v.label === 'Control frame cantilever')!;
  controlArm.shape = union(controlArm.shape, box([10, 70, 70], [-790, 490, 625]));
  b('Control post top threaded insert', [34, 34, 10], [-1187, 508, 827], 'Control stand', C.steel);
  for (const x of [-1180, -1160])
    for (const y of [515, 535])
      fasten(
        `Cabinet top M6x25 ${x} ${y}`,
        ['Control pedestal top', 'Single control profile', 'Control post top threaded insert'],
        [x, y, 850],
        'z',
        6,
        25,
        'Control stand',
      );
  for (const y of [498, 552])
    for (const z of [650, 680]) {
      const insert = `Control arm backing block ${y} ${z}`;
      b(insert, [10, 16, 14], [-777, y - 8, z - 7], 'Control stand', C.steel);
      fasten(
        `Control frame M8x25 ${y} ${z}`,
        ['Control frame cantilever', 'Saw frame tie -780', insert],
        [-790, y, z],
        'x',
        8,
        25,
        'Control stand',
        true,
      );
    }
  const controlPost = out.find((v) => v.label === 'Single control profile')!;
  controlPost.shape = union(controlPost.shape, box([40, 40, 8], [-1190, 505, 680]));
  for (const x of [-1180, -1160])
    for (const y of [515, 535]) {
      fasten(
        `Control post underside M6x60 ${x} ${y}`,
        ['Single control profile', 'Control frame cantilever'],
        [x, y, 640],
        'z',
        6,
        60,
        'Control stand',
        true,
      );
      add(
        `Control post M6 nut ${x} ${y}`,
        subtract(
          cylinder(5, 6, [x, y, 690]),
          cylinder(3.2, 8, [x, y, 689], 'z', { pitch: 1, internal: true }),
        ),
        'Control stand',
        C.dark,
        'BUY',
      );
      add(
        `Control post M6 washer ${x} ${y}`,
        subtract(cylinder(6, 2, [x, y, 688]), cylinder(3.2, 4, [x, y, 687])),
        'Control stand',
        C.steel,
        'BUY',
      );
    }
  // Sensor slots are retained by real washers/nuts on the back face.
  for (const dz of [-10, 10]) {
    const z = TABLE + Math.max(16, h / 2) + dz;
    add(
      `Optical M3 nut ${dz}`,
      subtract(
        cylinder(3.2, 3, [beamX, -112, z], 'y'),
        cylinder(1.6, 5, [beamX, -113, z], 'y', { pitch: 0.5, internal: true }),
      ),
      'Feed carriage',
      C.dark,
      'BUY',
    );
    add(
      `Optical M3 washer ${dz}`,
      subtract(cylinder(4, 2, [beamX, -109, z], 'y'), cylinder(1.65, 4, [beamX, -110, z], 'y')),
      'Feed carriage',
      C.steel,
      'BUY',
    );
  }
  for (const x of [-316, -441])
    for (const y of [-70, 70])
      fasten(
        `Band motor foot M8x20 ${x} ${y}`,
        ['Band motor mounting shelf'],
        [x, -WHEEL_CENTRE + y, q.edge + 82],
        'z',
        8,
        20,
        'Band drive',
      );
  for (const side of [1])
    for (const [dy, dz] of [
      [-36, 0],
      [36, 0],
      [0, -36],
      [0, 36],
    ])
      fasten(
        `Wheel pedestal M6x60 ${side} ${dy} ${dz}`,
        [`Wheel bearing and tension slide ${side}`, `Wheel back plate ${side}`],
        [-50, side * WHEEL_CENTRE + dy, q.edge + 160 + dz],
        'x',
        6,
        60,
        'Band head',
      );
  for (const dy of [-57.5, 57.5])
    for (const dz of [-57.5, 57.5])
      fasten(
        `Pivot bow flange M6x20 ${dy} ${dz}`,
        ['Pivot moving bearing housing', 'Wheel back plate -1'],
        [-88, -WHEEL_CENTRE + dy, BOTTOM + 160 + dz],
        'x',
        6,
        20,
        'Head carriage',
      );
  for (const x of [116, 165])
    for (const y of [-112, -88])
      fasten(
        `Shelf bearing M4x35 ${x} ${y}`,
        [`Shelf hinge bearing ${x}`, 'Shelf hinge fixed bearer'],
        [x + 6.5, y, 907],
        'z',
        4,
        35,
        'Drop support',
      );
  for (const x of [-327, -202])
    for (const dx of [6, 19])
      fasten(
        `Feed limit bracket M3x20 ${x} ${dx}`,
        [`Feed limit switch bracket ${x}`, 'Removable feed axis base plate'],
        [x + dx, 285, 752],
        'z',
        3,
        20,
        'Shuttle',
      );
  for (const [name, x, width, base] of [
    ['Station', -55, 40, 'Station vise base plate'],
    ['Shuttle', q.carriage, 70, 'Feed bridge plate below rollers'],
  ] as const) {
    const plate = out.find((v) => v.label === base)!;
    const ys = [w + 129, -93];
    for (const [dy, dxs] of [
      [ys[0], [-width / 2 + 12, width / 2 - 12]],
      [ys[1], [-width / 4, width / 4]],
    ] as const)
      for (const dx of dxs)
        plate.shape = subtract(
          plate.shape,
          cylinder(3.15, 14, [x + dx, dy, 834], 'z', { pitch: 1, internal: true }),
        );
  }
  const weld = (label: string, select: (v: MachinePiece) => boolean, group: string) => {
    const members = out.filter(select);
    if (!members.length) return;
    for (const member of members) out.splice(out.indexOf(member), 1);
    add(label, union(...members.map((v) => v.shape)), group, C.head);
  };
  weld(
    'Station welded L datum',
    (v) => ['Station L datum wall', 'Station support plate ends before kerf'].includes(v.label),
    'Fixed vise',
  );
  weld(
    'Shuttle welded L datum',
    (v) => /^(Shuttle L datum|Shuttle L shoe)/.test(v.label),
    'Feed carriage',
  );
  for (const name of ['Station', 'Shuttle'])
    weld(
      `${name} welded top clamp post`,
      (v) =>
        [`${name} top clamp slotted upright`, `${name} top upright mounting foot`].includes(
          v.label,
        ),
      name === 'Station' ? 'Fixed vise' : 'Feed carriage',
    );
  weld(
    'Welded offcut shelf',
    (v) =>
      ['Offcut support shelf 30-100 mm', 'Shelf folded stiffener', 'Shelf hinge barrel'].includes(
        v.label,
      ),
    'Drop support',
  );
  weld(
    'Welded moving head frame',
    (v) =>
      /^(Free-end lift welded clevis and bridge|Moving head rear crossbeam|Wheel back plate|Wheel plate top attachment|Guide arm hanger|Guide upper bridge)/.test(
        v.label,
      ),
    'Head carriage',
  );
  for (const dx of [-24, 24])
    fasten(
      `Shuttle L datum underside M6x60 ${dx}`,
      ['Shuttle welded L datum', 'Feed bridge plate below rollers'],
      [q.carriage + dx, -65, 835],
      'z',
      6,
      60,
      'Feed carriage',
      true,
    );
  for (const x of [-110, -80])
    for (const y of [108, 122]) {
      const datum = out.find((v) => v.label === 'Station welded L datum')!;
      datum.shape = subtract(datum.shape, cylinder(5, 6.1, [x, y, 894]));
      fasten(
        `Station L datum M6x20 ${x} ${y}`,
        ['Station welded L datum', 'Station underside support'],
        [x, y, 894],
        'z',
        6,
        20,
        'Fixed vise',
      );
    }
  weld(
    'Carriage bent optical arm',
    (v) => ['Carriage optical arm', 'Carriage optical height slot'].includes(v.label),
    'Feed carriage',
  );
  for (const piece of out) {
    if (piece.group === 'Band drive') piece.shape = transform(piece.shape, [-100, 0, 0]);
    if (
      ['Head carriage', 'Band head', 'Blade', 'Blade guides', 'Head retention'].includes(
        piece.group,
      ) ||
      /^(Wheel enclosure|Upper band return|Return guard spacer)/.test(piece.label)
    )
      piece.shape = rotateHead(piece.shape, q.headAngle);
  }
  for (const piece of out)
    if (['Controls', 'Pneumatics'].includes(piece.group))
      piece.shape = transform(piece.shape, [-650, -100, 0]);
  if (state === 'feed-detail')
    return out.filter((q) => ['Shuttle', 'Feed carriage'].includes(q.group));
  if (state === 'head-detail')
    return out.filter((q) =>
      [
        'Head lift',
        'Pivot support',
        'Blade',
        'Head retention',
        'Band head',
        'Band drive',
        'Blade guides',
        'Head carriage',
      ].includes(q.group),
    );
  return out;
}
