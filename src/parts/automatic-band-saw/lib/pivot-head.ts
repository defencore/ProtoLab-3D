import { box, cylinder, subtract, union, type Shape, type Vec } from './shapes';
import { bearingPieces, socketScrew } from './hardware';
import { HEAD_PIVOT, WHEEL_CENTRE, headPoint, liftLink } from './layout';
import type { MachinePiece } from './model';
const tr = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const rotateHead = (shape: Shape, angle: number) =>
  tr(tr(shape, HEAD_PIVOT.map((v) => -v) as Vec), HEAD_PIVOT, [angle, 0, 0]);
export function pivotPieces(angle: number): MachinePiece[] {
  const out: MachinePiece[] = [],
    y = HEAD_PIVOT[1],
    z = HEAD_PIVOT[2];
  const add = (
    label: string,
    shape: Shape,
    group = 'Pivot support',
    color = 0x536675,
    procurement: MachinePiece['procurement'] = 'MAKE',
  ) => out.push({ label, shape, group, color, procurement });
  const ring = (r: number, bore: number, x: number, length: number) =>
    subtract(cylinder(r, length, [x, y, z], 'x'), cylinder(bore, length + 2, [x - 1, y, z], 'x'));
  const screw = (
    name: string,
    at: Vec,
    diameter: number,
    length: number,
    labels: string[],
    group = 'Pivot support',
    reverse = false,
  ) => {
    for (const label of labels) {
      const p = out.find((v) => v.label === label)!;
      p.shape = subtract(
        p.shape,
        cylinder(
          diameter / 2 + 0.15,
          length + 0.2,
          [at[0] - (reverse ? 0.1 : length + 0.1), at[1], at[2]],
          'x',
        ),
      );
    }
    const q = socketScrew(name, [0, 0, 0], 'z', diameter, length);
    add(name, tr(q.shape, at, [0, reverse ? -90 : 90, 0]), group, q.color, 'BUY');
  };
  add(
    'Pivot welded pedestal and motor outrigger',
    union(
      box([80, 296, 60], [-235, -610, 800]),
      box([56, 80, 125], [-230, y - 40, 860]),
      subtract(
        box([20, 100, 100], [-220, y - 50, z - 50]),
        cylinder(27.2, 22, [-221, y, z], 'x'),
        box([2.1, 80, 80], [-202, y - 40, z - 40]),
      ),
      box([60, 300, 60], [-650, -610, 800]),
      box([60, 60, 73], [-650, y - 30, 860]),
    ),
  );
  add(
    'Fixed hollow pivot trunnion D50',
    subtract(
      union(box([15, 100, 100], [-200, y - 50, z - 50]), cylinder(25, 130, [-185, y, z], 'x')),
      cylinder(15.2, 147, [-201, y, z], 'x'),
      cylinder(21.05, 25, [-201, y, z], 'x'),
      cylinder(21.05, 10, [-64, y, z], 'x'),
    ),
  );
  add(
    'Independent driven wheel shaft D30',
    cylinder(15, 217, [-217, y, z], 'x'),
    'Pivot support',
    0xabb6bf,
    'BUY',
  );
  for (const x of [-185, -63])
    for (const p of bearingPieces(`6806 drive shaft ${x}`, [x, y, z], 'x', 30, 42, 7))
      add(p.label, p.shape, 'Pivot support', p.color, 'BUY');
  add('Drive rear outer race spacer', ring(21, 19, -200, 15));
  add('Drive front outer race spacer', ring(21, 19, -56, 1));
  add(
    'Drive rear bearing cover',
    subtract(box([2, 80, 80], [-202, y - 40, z - 40]), cylinder(15.2, 4, [-203, y, z], 'x')),
  );
  for (const dy of [-30, 30])
    for (const dz of [-30, 30]) {
      const pedestal = out[0];
      pedestal.shape = subtract(pedestal.shape, cylinder(3.4, 19, [-221, y + dy, z + dz], 'x'));
      screw(
        `Rear drive cover M4 ${dy} ${dz}`,
        [-202, y + dy, z + dz],
        4,
        12,
        ['Drive rear bearing cover', 'Fixed hollow pivot trunnion D50'],
        'Pivot support',
        true,
      );
    }
  for (const dy of [-38, 38])
    for (const dz of [-38, 38])
      screw(`Trunnion flange M8 ${dy} ${dz}`, [-185, y + dy, z + dz], 8, 35, [
        'Fixed hollow pivot trunnion D50',
        'Pivot welded pedestal and motor outrigger',
        'Drive rear bearing cover',
      ]);
  add('Pivot inner race rear spacer', ring(28, 25.05, -177, 22));
  add(
    'Pivot inner race front locknut',
    subtract(
      cylinder(28, 8, [-81, y, z], 'x'),
      cylinder(25.05, 10, [-82, y, z], 'x', { pitch: 1.5, internal: true }),
    ),
  );
  for (const x of [-155, -97])
    for (const p of bearingPieces(`6010 bow pivot ${x}`, [x, y, z], 'x', 50, 80, 16))
      add(p.label, p.shape, 'Head carriage', p.color, 'BUY');
  add(
    'Pivot moving bearing housing',
    subtract(
      union(
        box([95, 105, 105], [-165, y - 52.5, z - 52.5]),
        box([12, 125, 125], [-100, y - 62.5, z - 62.5]),
      ),
      cylinder(30, 99, [-167, y, z], 'x'),
      cylinder(40.05, 27, [-166, y, z], 'x'),
      cylinder(40.05, 28, [-97, y, z], 'x'),
    ),
    'Head carriage',
    0x167c83,
  );
  add('Pivot rear outer race spacer', ring(40, 33, -165, 10), 'Head carriage');
  add('Pivot front outer race spacer', ring(40, 33, -81, 11), 'Head carriage');
  add(
    'Pivot rear cap',
    subtract(box([2, 105, 105], [-167, y - 52.5, z - 52.5]), cylinder(28.1, 4, [-168, y, z], 'x')),
    'Head carriage',
  );
  add(
    'Pivot front cap and rotary limit cam',
    subtract(
      union(box([4, 105, 105], [-70, y - 52.5, z - 52.5]), box([13, 50, 10], [-70, y + 45, z - 5])),
      cylinder(28.1, 6, [-71, y, z], 'x'),
    ),
    'Head carriage',
  );
  for (const [x, reverse, label] of [
    [-167, true, 'Pivot rear cap'],
    [-66, false, 'Pivot front cap and rotary limit cam'],
  ] as const)
    for (const dy of [-44, 44])
      for (const dz of [-44, 44])
        screw(
          `Pivot cap M4 ${x} ${dy} ${dz}`,
          [x, y + dy, z + dz],
          4,
          12,
          [label, 'Pivot moving bearing housing'],
          'Head carriage',
          reverse,
        );
  const sensorSpokes = [0, 35].map((a) => rotateHead(box([4, 55, 16], [-55, y + 45, z - 8]), a));
  add(
    'Fixed front retainer and sensor tabs',
    subtract(
      union(box([4, 100, 100], [-55, y - 50, z - 50]), ...sensorSpokes),
      cylinder(15.2, 6, [-56, y, z], 'x'),
      ...[0, 35].map((a) => {
        const p = headPoint([-56, y + 90, z], a);
        return cylinder(6.1, 6, p, 'x');
      }),
    ),
  );
  for (const a of [0, 90, 180, 270]) {
    const t = (a * Math.PI) / 180;
    screw(`Front drive cover M3 ${a}`, [-51, y + 25 * Math.cos(t), z + 25 * Math.sin(t)], 3, 12, [
      'Fixed front retainer and sensor tabs',
      'Fixed hollow pivot trunnion D50',
    ]);
  }
  for (const a of [0, 35]) {
    const p = headPoint([-55, y + 90, z], a);
    add(
      a === 0 ? 'Lower NC cut-off sensor M12' : 'Upper feed-permit sensor M12',
      cylinder(6, 30, p, 'x', { pitch: 1 }),
      'Sensors',
      0x3179bc,
      'BUY',
    );
  }
  // The cylinder lifts the free end, outside the wheel guard. Its base is tied to the frame.
  const fy = WHEEL_CENTRE;
  add(
    'Free-end lift welded clevis and bridge',
    subtract(
      union(
        box([300, 40, 20], [-150, fy - 20, 1210]),
        box([20, 40, 215], [130, fy - 20, 995]),
        box([72, 30, 20], [78, fy - 15, 1055]),
        box([8, 30, 40], [78, fy - 15, 1015]),
        box([8, 30, 40], [114, fy - 15, 1015]),
      ),
      cylinder(6.1, 46, [77, fy, 1035], 'x'),
    ),
    'Head carriage',
    0x167c83,
  );
  add(
    'Free-end cylinder fixed base and frame tie',
    subtract(
      union(
        box([212, 40, 40], [78, fy - 20, 220]),
        box([60, 590 - fy - 20, 40], [230, fy + 20, 220]),
        box([44, 30, 20], [78, fy - 15, 260]),
        box([8, 30, 40], [78, fy - 15, 280]),
        box([8, 30, 40], [114, fy - 15, 280]),
      ),
      cylinder(6.1, 46, [77, fy, 300], 'x'),
    ),
  );
  const link = liftLink(angle),
    d = link.tip.map((v, i) => v - link.base[i]),
    rot: Vec = [(Math.atan2(-d[1], d[2]) * 180) / Math.PI, 0, 0];
  const local = (name: string, shape: Shape, color = 0xb4bec8) =>
    add(name, tr(shape, link.base, rot), 'Head lift', color, 'BUY');
  const holes = [-27, 27].flatMap((x) => [-27, 27].map((y) => cylinder(4.2, 620, [x, y, 29])));
  local(
    'DSBC63x500 pivot lift barrel',
    subtract(box([75, 75, 578], [-37.5, -37.5, 50]), cylinder(31.5, 580, [0, 0, 49]), ...holes),
  );
  for (const zz of [30, 628]) {
    local(
      `Lift end cap ${zz}`,
      subtract(
        box([75, 75, 20], [-37.5, -37.5, zz]),
        cylinder(zz === 30 ? 0.1 : 10.2, 22, [0, 0, zz - 1]),
        ...holes,
        cylinder(7.55, 14, [24, 0, zz + 10], 'x', { pitch: 1.337, internal: true }),
      ),
      0x536675,
    );
    local(
      `Lift G3/8 fitting ${zz}`,
      subtract(
        cylinder(7.5, 10, [32, 0, zz + 10], 'x', { pitch: 1.337 }),
        cylinder(2.5, 12, [31, 0, zz + 10], 'x'),
      ),
      0x3179bc,
    );
  }
  for (const x of [-27, 27])
    for (const y of [-27, 27]) {
      local(`Lift tie rod M8 ${x} ${y}`, cylinder(4, 622, [x, y, 30], 'z', { pitch: 1.25 }));
      local(
        `Lift tie rod retaining nut ${x} ${y}`,
        subtract(
          cylinder(7, 6, [x, y, 648]),
          cylinder(4.1, 8, [x, y, 647], 'z', { pitch: 1.25, internal: true }),
        ),
        0x303c46,
      );
    }
  local(
    'Lift polished D20 rod',
    cylinder(10, link.length - 25 - (link.length - 632), [0, 0, link.length - 632]),
  );
  local('Lift M16x1.5 rod end', cylinder(8, 15, [0, 0, link.length - 25], 'z', { pitch: 1.5 }));
  local(
    'Lift D63 piston',
    subtract(
      cylinder(31.4, 16, [0, 0, link.length - 640]),
      cylinder(10.05, 18, [0, 0, link.length - 641]),
    ),
    0x303c46,
  );
  // A rod-lock envelope occupies the remaining neck space, independently of control pressure.
  local(
    'Monitored normally locked D20 rod lock envelope',
    subtract(
      box([60, 60, 26], [-30, -30, 648]),
      cylinder(10.2, 28, [0, 0, 647]),
      ...holes,
      ...[-27, 27].flatMap((x) => [-27, 27].map((y) => cylinder(7.2, 8, [x, y, 647]))),
    ),
    0x303c46,
  );
  for (const [zz, front] of [
    [0, false],
    [link.length, true],
  ] as const)
    local(
      front ? 'Lift rod eye M16x1.5 adapter' : 'Lift rear clevis eye',
      subtract(
        union(
          cylinder(14, 20, [-10, 0, zz], 'x'),
          cylinder(14, front ? 32 : 22, [0, 0, front ? zz - 40 : 8]),
        ),
        cylinder(6.1, 22, [-11, 0, zz], 'x'),
        box([10, 40, 90], [-20, -20, zz - 45]),
        box([10, 40, 90], [10, -20, zz - 45]),
        ...(front
          ? [
              cylinder(10.1, 16, [0, 0, zz - 41]),
              cylinder(8.1, 18, [0, 0, zz - 25], 'z', { pitch: 1.5, internal: true }),
            ]
          : []),
      ),
      0x536675,
    );
  for (const [name, p, moving] of [
    ['upper', link.base, false],
    ['lower', [100, WHEEL_CENTRE, 1035], true],
  ] as const) {
    const at = [...p] as Vec,
      group = moving ? 'Head carriage' : 'Pivot support';
    add(
      `Lift ${name} clevis pin D12`,
      union(
        cylinder(6, 52, [at[0] - 26, at[1], at[2]], 'x'),
        cylinder(9, 3, [at[0] - 29, at[1], at[2]], 'x'),
      ),
      group,
      0xa6b0b8,
      'BUY',
    );
    for (const dx of [-14, 10])
      add(
        `Lift ${name} eye thrust washer ${dx}`,
        subtract(
          cylinder(10, 4, [at[0] + dx, at[1], at[2]], 'x'),
          cylinder(6.1, 6, [at[0] + dx - 1, at[1], at[2]], 'x'),
        ),
        group,
        0xa6b0b8,
        'BUY',
      );
    add(
      `Lift ${name} pin retaining ring`,
      subtract(
        cylinder(8, 1.2, [at[0] + 24, at[1], at[2]], 'x'),
        cylinder(6.05, 3, [at[0] + 23, at[1], at[2]], 'x'),
      ),
      group,
      0x303c46,
      'BUY',
    );
  }
  return out;
}
