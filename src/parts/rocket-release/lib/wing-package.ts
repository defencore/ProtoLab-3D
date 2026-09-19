import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  box,
  cylinder,
  circle,
  plate,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
  type Point,
} from './shapes';
import { screw, outputScrew, flatSeat, matingHole } from './hardware';
import { layout } from './motion';
import { profile } from './gears';
import {
  controllerPieces,
  controllerMounts,
  controllerPlacement,
  controllerBottomScrew,
} from './wing-controller';
import { wingLayout, wingTies, cellLocations } from './wing-layout';
import { cylindricalPack, cellDeckBosses, cellBridgeSupport } from './wing-cells';
import {
  controllerFrame,
  controllerHeelPockets,
  controllerWirePorts,
  controllerHeelWireLiners,
} from './wing-frame';
import { springAssessment } from './spring-assessment';

export const wingSources = [
  {
    label: 'TowerPro MG996R · metal gears, PWM, dimensions and ratings',
    url: 'https://towerpro.com.tw/product/mg996R/',
  },
  {
    label: 'Tattu 650 mAh 3S1P 75C · XT30',
    url: 'https://genstattu.com/tattu-3s1p-75c-11-1v-650mah-lipo-battery-pack-with-xt30-plug.html',
  },
  {
    label: 'Tattu 650 mAh 2S1P 75C · XT30',
    url: 'https://genstattu.com/tattu-650mah-2s1p-75c-7-4v-lipo-battery-pack-with-xt30-plug.html',
  },
  {
    label: 'SpeedyBee F405 WING MINI · manufacturer manual',
    url: 'https://support.speedybee.cn/?a=p&d=SBFWC2&l=en&s=1000',
  },
];
export const wingPreset = (cells: number) => ({
  lipoCells: String(cells),
  lipoLength: cells === 2 ? 57 : 58,
  lipoWidth: 31,
  lipoThickness: cells === 2 ? 12 : 16,
  lipoMass: cells === 2 ? 43 : 59,
});
// Drawing-dependent interfaces remain editable: the manufacturer's two dimension
// tables differ and no verified spline flank drawing is available.
export function pwmMounts(p: Parameters): Point[] {
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => [10.35 + (x * +p.pwmMountPitch) / 2, (y * +p.pwmRowPitch) / 2] as Point),
  );
}
export const wingTopBolt = (x: number, y: number) => transform(screw(2, 6), 0, [x, y, 40]);
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  planes: [],
  solid,
});
/** Additional integral servo supports and mounting bores, in the common nose-disk frame. */
export function wingDeck(p: Parameters) {
  const mounts = pwmMounts(p);
  const bolts = mounts.map(([x, y]) => transform(rotate(screw(3, 12), 180, 'x'), 0, [x, y, 44]));
  const bosses = mounts.map(([x, y], i) =>
    subtract(cylinder(3, 4, [x, y, 40]), matingHole(bolts[i])),
  );
  return {
    holes: wingTies.map(([x, y]) => circle(1.1, x, y)),
    bosses: [
      ...bosses,
      plate(rect(-10, -9.85, 40.7, 19.7), [circle(4.1)], 42.6, 1.4),
      ...cellDeckBosses(p),
      ...cellBridgeSupport(p),
    ],
    bolts,
  };
}
export function wingPieces(p: Parameters): Piece[] {
  const m = layout(p),
    w = wingLayout(p),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xc6cdd5) => out.push({ label, shape, color });
  const steel = 0x929eac,
    plastic = 0xdddcd2,
    rubber = 0x363e47;
  const mounts = pwmMounts(p),
    deck = wingDeck(p);
  // Nominal MG996R installation envelope: case, mounting ears and rotating output.
  // Details not dimensioned by TowerPro are explicitly fit references, not supplier CAD.
  const body = box([40.7, 19.7, 37], [-10, -9.85, 5.1]);
  const ears = plate(
    rect(-16.65, -9.85, 54, 19.7),
    mounts.map(([x, y]) => circle(1.7, x, y)),
    32,
    2.5,
  );
  add(
    'BUY TowerPro MG996R · metal gears · PWM · 4.8–6.6 V · 55 g · nominal case and ears; fit reference',
    welded(subtract(union(body, ears), cylinder(1.6, 2, [0, 0, 41]))),
    0x292e35,
  );
  add(
    'MG996R front case cushion · silicone t0.5 · direct case-to-disk support',
    plate(rect(-10, -9.85, 40.7, 19.7), [circle(4.1)], 42.1, 0.5),
    rubber,
  );
  mounts.forEach(([x, y], i) => {
    add(
      `MG996R ear spacer ${i + 1} · Al6061 Ø6/3.3×5.5`,
      plate(circle(3, x, y), [circle(1.65, x, y)], 34.5, 5.5),
    );
    add(`MG996R mounting screw ${i + 1} · M3×0.5×12 · full thread`, deck.bolts[i], steel);
  });
  const spline: Point[] = Array.from({ length: 100 }, (_, i) => {
    const r = (i % 4 === 0 || i % 4 === 3 ? +p.pwmSplineRoot : +p.pwmSplineDiameter) / 2;
    const a = (i * Math.PI) / 50;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const output = plate(spline, [], 42.1, 5.9);
  const retaining = transform(outputScrew(), 0, [0, 0, 42]);
  add(
    'BUY MG996R output · nominal 25T fit reference · measure tooth form before manufacture',
    transform(subtract(output, matingHole(retaining)), m.servoAngle),
    steel,
  );
  const splineClear = spline.map(([x, y]) => [x * 1.015, y * 1.015] as Point);
  const gear = subtract(
    union(transform(plate(profile(m.module, 20), [], 48, 3), 9), cylinder(4, 5, [0, 0, 43])),
    plate(splineClear, [], 42.9, 5.2),
    cylinder(1.65, 3.2, [0, 0, 48]),
    cylinder(3.05, 2.1, [0, 0, 50]),
  );
  add(
    `MG996R input pinion · Al7075 · 20 teeth m${m.module.toFixed(4)} · t3 · integral 25T prototype spline; verify fit`,
    transform(gear, m.servoAngle),
    0xc36d4c,
  );
  add(
    'MG996R output retaining screw · M3×0.5×8 · verify OEM thread',
    transform(retaining, m.servoAngle),
    steel,
  );

  const bx = w.batteryX,
    upperZ = 2.1,
    floorZ = w.base;
  const mountingHoles = wingTies.map(([x, y]) => circle(1.6, x, y));
  // The heel plate captures the bottom of the case. Four equal-length metal
  // columns connect it directly to the servo disk, bypassing the plastic ears.
  const outline: Point[] = w.cylindrical
    ? rect(-35, -21, 70, 42)
    : [
        [-35, -21],
        [-22, -21],
        [-22, -34],
        [22, -34],
        [22, -21],
        [35, -21],
        [35, 21],
        [22, 21],
        [16, 38],
        [-16, 38],
        [-22, 21],
        [-35, 21],
      ];
  const leadPort = rect(bx - 7, w.leadY - 3, 14, 6);
  const fcBolts = w.cylindrical
    ? controllerMounts(p).map(([x, y]) => controllerPlacement(p, controllerBottomScrew(p, x, y)))
    : [];
  const heel = plate(
    outline,
    [...mountingHoles, ...(w.cylindrical ? [] : [leadPort, rect(-8, -29, 16, 12)])],
    upperZ,
    2,
  );
  add(
    'Servo body capture and battery mounting plate · Al6061 web t2 · locating rim t2 h4 · four symmetric metal columns · dedicated harness ports',
    heel,
  );
  add(
    'MG996R heel cushion · silicone t1 · body load path bypasses mounting ears',
    w.cylindrical
      ? welded(subtract(box([40.7, 19.7, 1], [-10, -9.85, 4.1]), ...controllerHeelPockets()))
      : box([40.7, 19.7, 1], [-10, -9.85, 4.1]),
    rubber,
  );
  // Close-fitting lateral cheeks restrain the case, while the heel carries axial load.
  for (const y of [-12.85, 10.85]) {
    add(`MG996R case cheek ${y < 0 ? 1 : 2} · Al6061 t2 · h4`, box([40.7, 2, 4], [-10, y, 4.1]));
    add(
      `MG996R case side pad ${y < 0 ? 1 : 2} · silicone t1`,
      box([40.7, 1, 3], [-10, y < 0 ? -10.85 : 9.85, 5.1]),
      rubber,
    );
  }
  for (const [i, x] of [-13, 31.7].entries()) {
    add(`MG996R case cheek end ${i + 1} · Al6061 t2 · h4`, box([2, 25.7, 4], [x, -12.85, 4.1]));
    add(
      `MG996R case end pad ${i + 1} · silicone t1`,
      box([1, 19.7, 3], [i === 0 ? -11 : 30.7, -9.85, 5.1]),
      rubber,
    );
  }
  // Integral cheeks in the milled heel block, not loose floating strips.
  const heelPiece = out.find((x) => x.label.startsWith('Servo body capture'))!;
  const cheeks = out.filter((x) => x.label.startsWith('MG996R case cheek'));
  const capture = union(heel, ...cheeks.map((x) => x.shape));
  heelPiece.shape = welded(
    w.cylindrical
      ? subtract(
          capture,
          // Identical open reliefs: the heel does not restrain either cell.
          ...cellLocations(p).map(([x, y]) =>
            cylinder(+p.wingCellDiameter / 2 + 0.8, 7, [x, y, 2]),
          ),
          ...fcBolts.map(flatSeat),
          ...controllerHeelPockets(),
          ...controllerWirePorts.map(([x, y]) => cylinder(3, 3, [x, y, 1.6])),
          // The low rim is interrupted around the four recessed FC screws.
          ...controllerMounts(p).map(([x, y]) => cylinder(2.5, 4.1, [x + w.controllerX, -y, 4.1])),
        )
      : capture,
  );
  if (w.cylindrical) {
    heelPiece.label +=
      ' · centered FC · 2×Ø16 + Ø10 circular lightening bores · 2×Ø6 lined wire ports';
    out.push(...controllerHeelWireLiners());
  }
  for (const c of cheeks) out.splice(out.indexOf(c), 1);
  wingTies.forEach(([x, y], i) => {
    const top = wingTopBolt(x, y);
    // Male lower stud passes through the heel; the long upper column receives it.
    const stud: Shape = transform(
      { kind: 'thread', diameter: 3, pitch: 0.5, length: 6, clearance: 0, internal: false },
      0,
      [x, y, upperZ],
    );
    const receiving: Shape = transform(
      { kind: 'thread', diameter: 3, pitch: 0.5, length: 6, clearance: 0.04, internal: true },
      0,
      [x, y, upperZ],
    );
    add(
      `Servo cage upper column ${i + 1} · Al6061 Ø6 · M3 bottom M2 top · L39.9`,
      subtract(cylinder(3, 39.9, [x, y, 4.1]), receiving, matingHole(top)),
    );
    const bottom = transform(rotate(screw(2, w.cylindrical ? 8 : 14), 180, 'x'), 0, [
      x,
      y,
      floorZ + (w.cylindrical ? 8 : 6),
    ]);
    add(
      `Battery cage lower column ${i + 1} · Al6061 Ø6 · integral M3×0.5×6 stud · L${(upperZ - floorZ - w.retentionThickness).toFixed(1)}`,
      welded(
        subtract(
          union(
            cylinder(3, upperZ - floorZ - w.retentionThickness, [
              x,
              y,
              floorZ + w.retentionThickness,
            ]),
            stud,
          ),
          matingHole(bottom),
        ),
      ),
    );
    add(`Servo cage disk screw ${i + 1} · socket cap head`, top, steel);
    add(`Battery cage floor screw ${i + 1}`, bottom, steel);
  });
  if (w.cylindrical) {
    out.push(...cylindricalPack(p));
  } else {
    const floorOutline = circle(42.4);
    add(
      'LiPo lower retention plate · Al6061 t2 · four metal columns · full support',
      plate(
        floorOutline,
        wingTies.map(([x, y]) => circle(1.1, x, y)),
        floorZ,
        2,
      ),
    );
    const cornerStops: Shape[] = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const x = bx + sx * (w.width / 2 + 2),
          y = sy * (w.length / 2 + 2);
        cornerStops.push(
          box([2, 7, 4], [sx < 0 ? x - 2 : x, sy < 0 ? y - 2 : y - 5, floorZ + 2]),
          box([5, 2, 4], [sx < 0 ? x : x - 5, sy < 0 ? y - 2 : y, floorZ + 2]),
        );
      }
    const floorPart = out[out.length - 1];
    floorPart.shape = welded(union(floorPart.shape, ...cornerStops));
    floorPart.label =
      'LiPo lower retention plate · Al6061 web t2 · integral corner stops h4 · four metal columns';
    // Wide PA12 insulating seats and positive side/end walls. A metal floor carries
    // the inertia; the printable liners provide insulation, not thread retention.
    const cavity = rect(bx - w.width / 2 - 0.5, -w.length / 2 - 0.5, w.width + 1, w.length + 1);
    const outer = rect(bx - w.width / 2 - 2, -w.length / 2 - 2, w.width + 4, w.length + 4);
    add(
      'LiPo lower insulating seat · PRINT PA12 t1 · continuous side and end stops h4',
      welded(union(plate(outer, [], floorZ + 2, 1), plate(outer, [cavity], floorZ + 3, 4))),
      plastic,
    );
    // Cable notch in the end wall is aligned with the actual lead-side corridor.
    const seat = out[out.length - 1];
    seat.shape = welded(subtract(seat.shape, box([14, 4, 4], [bx - 7, w.length / 2, floorZ + 3])));
    add(
      'LiPo lower load pad · silicone t1 · broad face',
      box([w.width, w.length, 1], [bx - w.width / 2, -w.length / 2, -w.thickness - 1]),
      rubber,
    );
    add(
      `BUY Tattu TA-75C-650-${w.cells}S1P-XT30 · 650 mAh · ${w.cells === 2 ? '7.4' : '11.1'} V · ${p.lipoMass} g · wrapper envelope ${w.length}×${w.width}×${w.thickness}`,
      box([w.width, w.length, w.thickness], [bx - w.width / 2, -w.length / 2, -w.thickness]),
      0x242831,
    );
    add(
      'LiPo upper load pad · silicone t1 · broad face',
      box([w.width, w.length, 1], [bx - w.width / 2, -w.length / 2, 0]),
      rubber,
    );
    add(
      'LiPo upper insulating seat · PRINT PA12 t1.1 · continuous side stops',
      welded(union(plate(outer, [], 1, 1.1), plate(outer, [cavity], -3, 4))),
      plastic,
    );
    out[out.length - 1].shape = welded(
      subtract(out[out.length - 1].shape, box([14, 4, 5], [bx - 7, w.length / 2, -3])),
    );
    const grommet = union(
      plate(rect(bx - 7, w.leadY - 3, 14, 6), [rect(bx - 6, w.leadY - 2, 12, 4)], upperZ, 2),
      plate(
        rect(bx - 8, w.leadY - 4, 16, 8),
        [rect(bx - 6, w.leadY - 2, 12, 4)],
        upperZ - 0.5,
        0.5,
      ),
      plate(rect(bx - 8, w.leadY - 4, 16, 8), [rect(bx - 6, w.leadY - 2, 12, 4)], upperZ + 2, 0.5),
    );
    const upperSeat = out.find((x) => x.label.startsWith('LiPo upper insulating'))!;
    upperSeat.shape = welded(subtract(upperSeat.shape, grommet));
    add(
      'LiPo harness port grommet · silicone · 12×4 clear · power and balance leads',
      welded(grommet),
      rubber,
    );
    // Lead routing envelopes use 45 mm supplier leads. Exit the pack end, turn into
    // the lined plate opening, then terminate in the unobstructed side corridor.
    for (const [i, x] of [bx - 3, bx].entries()) {
      add(
        `BUY Tattu AWG16 ${i ? 'negative' : 'positive'} lead · routed clearance envelope`,
        welded(
          union(
            transform(
              rotate(cylinder(1.25, w.leadY - w.length / 2 + 0.5, [0, 0, 0]), -90, 'x'),
              0,
              [x, w.length / 2, -w.thickness / 2],
            ),
            cylinder(1.25, w.thickness / 2 + 10, [x, w.leadY, -w.thickness / 2]),
          ),
        ),
        i ? 0x292c32 : 0xc84b42,
      );
    }
    add(
      'BUY Tattu XT30 plug · 10×5×12 installation reference · lead-side access',
      box([10, 5, 12], [bx - 6.5, w.leadY - 2.5, 10]),
      0xe5b941,
    );
    // Separate balance bundle and plug; their clearance stays within the same port.
    add(
      'BUY Tattu balance harness · routed bundle Ø2 · 45 mm lead reference',
      welded(
        union(
          transform(rotate(cylinder(1, w.leadY - w.length / 2 + 0.5, [0, 0, 0]), -90, 'x'), 0, [
            bx + 5,
            w.length / 2,
            -w.thickness / 2,
          ]),
          cylinder(1, w.thickness / 2 + 9, [bx + 5, w.leadY, -w.thickness / 2]),
        ),
      ),
      0x777a7d,
    );
    add(
      `BUY JST-XHR-${w.cells + 1}P balance plug · connector clearance reference`,
      box([w.cells * 2.5 + 3, 5, 5], [bx + 4, w.leadY - 2.5, 9]),
      0xece8d9,
    );
  }
  // The cylindrical pack mounts its FC directly to the servo heel. LiPo packs
  // occupy that face, so their controller retains the separate shelf.
  out.push(...controllerFrame(p));
  out.push(...controllerPieces(p));
  return out;
}
export function wingReport(p: Parameters): string[] {
  if (p.drive !== 'wing-mini-nose') return [];
  const w = wingLayout(p),
    spring = springAssessment(p),
    m = layout(p);
  const torque =
    (+p.lockFriction * spring.startForce * m.lockRadius) / 1000 / (5 * +p.gearEfficiency);
  const available = 9.4 * 0.0980665 * 0.5;
  const cg = w.payloadCgX;
  return [
    `${w.cylindrical ? '2 × 18650 series pack · 2S1P' : `Tattu 650 mAh ${w.cells}S1P`} → WING MINI BAT/GND. MG996R → S3 / Vx / GND with servo BEC at its default 5 V (4 A continuous, 5 A peak). No Waveshare HAT required.`,
    `${w.cells === 2 ? '2S: 8.4 V full; the controller specifies 7 V minimum. Keep loaded voltage above 7 V; usable capacity is consequently reduced.' : '3S: 12.6 V full, 11.1 V nominal; within the 7–26 V controller input range.'} Do not connect the servo to VBAT or Vv.`,
    `MG996R published stall current 1.4 A (test voltage not stated). Verify startup current and BEC sag with your actual servo. Unlock travel ${(+p.unlockAngle * 5).toFixed(0)}°; calibrate endpoints before loading.`,
    `Preliminary unlock estimate ${torque.toFixed(3)} N·m at the servo, μ=${p.lockFriction}, efficiency=${p.gearEfficiency}. Comparison limit ${available.toFixed(3)} N·m = 50% of published 4.8 V stall torque; ${torque < available ? 'within assumed torque budget' : 'EXCEEDS assumed torque budget'}. This is not a continuous-duty rating; measure loaded release torque.`,
    `Electronic payload CG X≈${cg.toFixed(2)} mm; battery X=${w.batteryX.toFixed(2)} mm balances ${p.wingServoMass} g servo and ${w.boardMass} g installed FC stack. Frame, nose and harness are excluded; use battery trim after assembly weighing. At ${p.designG} g the battery retention demand is ${(w.packMass * 0.001 * 9.80665 * Number(p.designG)).toFixed(1)} N before safety factors. This is a load demand, not a verified impact rating.`,
    'MG996R ear pitch, shaft spline and screw thread are fit-reference geometry. Measure the actual servo before machining. WING MINI has separate FC, PDB and standard shield boards; 6.5 mm and 3 mm spacers follow the manual. Individual PCB outlines, t1, hole pitch and connectors are fit references. Verify measured board and plug geometry before manufacture. FC is horizontal, components toward the nose tip. Keep the 12 mm axial PLS/wire zone, 10 mm side-plug corridor and exposed power-pad zone clear; these are fit allowances, not measured connector CAD. Configure and verify its actual sensor orientation.',
    ...(w.cylindrical
      ? [
          '18650 dimensions and mass are editable fit assumptions. Two opposite cells form 2S1P. An angled nickel bridge behind the servo joins cell 1 positive to cell 2 negative (B1), on top of a 1 mm PA12 backing captured by the disk seats. Fixed MINUS B- and PLUS B+ pads are recessed in the opposite end cups. The bridge backing bears on an integral nose-disk rail along its entire floor. The FC is centered on four bonded elastomer dampers with separate metal ends; stiffness and bond strength remain to select. Its milled servo heel has 2×Ø16 + Ø10 circular lightening bores and two lined Ø4.8 wire passages. The 3 mm metal retention plate has closed cell rings, twin 6 mm rails and four 8 mm arms. Leads lie in open plastic slots on its outside face; no battery connector or long cable models are fitted. The three accessible nodes support service, not an onboard charger. Disconnect the load for charging and select cell-specific settings; separate-cell charging requires an isolated compatible charger, one cell at a time. Actual clips, conductor current rating, joints, strain relief and fuse remain to specify.',
        ]
      : []),
    'All power hardware leaves with the nose. CAD and a connection schedule are included; deployment detection, firmware configuration, arming, harness and flight-load qualification are not implemented.',
  ];
}
