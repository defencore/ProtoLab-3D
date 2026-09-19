import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { hatData } from './hat';
import { box, union, ring, cylinder, subtract, transform, rotate, type Shape } from './shapes';
import { screw } from './hardware';
import { batteryPosts } from './balance';
import { layout } from './motion';
export const hatMounts = hatData.mountingHoles as [number, number][];
// Underside keepouts checked against the official STEP; positions are installed XY.
export const hatSupports: [number, number][] = [
  [-18, 27],
  [16, 0],
];
/** PCB top faces the nose; backside components remain 5.2 mm clear of the frame. */
export const hatBolt = (x: number, y: number) =>
  transform(rotate(screw(2.5, 14, { headDiameter: 4.5, headHeight: 1.5 }), 180, 'x'), 0, [
    x,
    y,
    6.5,
  ]);
export function electronicsPieces(p: Parameters): Piece[] {
  const result: Piece[] = [
    {
      label: 'BUY Waveshare Bus Servo Driver HAT (A) · SKU 27577 · ESP32 · 9–25 V · 3S supply',
      shape: transform(rotate({ kind: 'hat' }, 180, 'x'), 0, [0, 0, -7]),
      color: 0x176f99,
    },
  ];
  hatMounts.forEach(([x, y], i) => {
    result.push(
      {
        label: `HAT compression limiter ${i + 1} · steel · Ø3.5/2.8×9.9`,
        shape: ring(1.75, 1.4, -4.9, 9.9, x, y),
        color: 0xc6cdd5,
      },
      ...[-7.5, -5.4].map((z, j) => ({
        label: `HAT insulating washer ${i + 1}.${j + 1} · POM · Ø5.5/2.8×0.5`,
        shape: ring(2.75, 1.4, z, 0.5, x, y),
        color: 0xede9db,
      })),
      {
        label: `HAT mounting screw ${i + 1} · M2.5×0.45×14`,
        shape: hatBolt(x, y),
        color: 0x929eac,
      },
    );
  });
  // One printed cradle and a cut silicone gasket share the four PCB fasteners.
  // Metal sleeves set the stack height; the PCB cannot crush the printed/rubber stack.
  const beam = (a: [number, number], b: [number, number], z: number, t: number): Shape => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    return union(
      cylinder(3, t, [...a, z]),
      cylinder(3, t, [...b, z]),
      transform(box([Math.hypot(dx, dy), 6, t], [0, -3, z]), (Math.atan2(dy, dx) * 180) / Math.PI, [
        ...a,
        0,
      ]),
    );
  };
  const paths: [[number, number], [number, number]][] = [
    [
      [-24.5, -29],
      [-24.5, 29],
    ],
    [
      [24.5, -29],
      [24.5, 29],
    ],
    [
      [-24.5, -29],
      [24.5, -29],
    ],
    [
      [-24.5, 27],
      [-18, 27],
    ],
    [
      [24.5, 0],
      [16, 0],
    ],
  ];
  const cut = (s: Shape) =>
    subtract(
      s,
      ...hatMounts.map(([x, y]) => cylinder(1.8, 12, [x, y, -5])),
      // 0.5 mm radial clearance around the battery-frame screw heads.
      ...batteryPosts(layout(p).radius).map(([x, y]) => cylinder(2.4, 12, [x, y, -5])),
      cylinder(5.1, 12, [-13, 24, -5]),
      cylinder(5.1, 12, [-13, -24, -5]),
    );
  const cradle = cut(
    union(
      ...paths.map(([a, b]) => beam(a, b, 2, 2)),
      ...hatMounts.map(([x, y]) => cylinder(3.2, 8.9, [x, y, -4.9])),
      ...hatSupports.map(([x, y]) => cylinder(2.5, 6.4, [x, y, -4.4])),
    ),
  );
  const gasket = cut(
    union(
      ...paths.map(([a, b]) => beam(a, b, 4, 1)),
      ...hatMounts.map(([x, y]) => cylinder(3.2, 1, [x, y, 4])),
    ),
  );
  result.push(
    {
      label: 'HAT common anti-flex carrier · PRINT PA12 · U-frame web t2 · 4 shared M2.5 mounts',
      // Weld micron-scale CSG slivers at coplanar rounded beam junctions.
      // Native CAD continues to use the unmodified exact solid.
      shape: { kind: 'fusedLayers', children: [cradle], planes: [], solid: cradle },
      color: 0xede9db,
    },
    {
      label: 'HAT clamped frame gasket · silicone rubber sheet t1 · 4 compression-limited mounts',
      shape: { kind: 'fusedLayers', children: [gasket], planes: [], solid: gasket },
      color: 0x526e8b,
    },
  );
  hatSupports.forEach(([x, y], i) =>
    result.push({
      label: `HAT anti-flex contact pad ${i + 1} · silicone rubber · Ø5×1 · clear PCB underside`,
      shape: cylinder(2.5, 1, [x, y, -5.4]),
      color: 0x526e8b,
    }),
  );
  return result;
}
export function electronicsReport(p: Parameters): string[] {
  if (p.drive !== 'st3215-nose' || p.batteryPack !== '3x18650') return [];
  const g = +p.designG,
    cell = +p.cellMass / 1000,
    pcb = +p.driverMass / 1000;
  return [
    '3S1P 18650: 11.1 V nominal / 12.6 V full. HAT input operating range with this pack: 9–12.6 V. Standard ST3215 12 V only; do not substitute the 7.4 V variant.',
    `At the assumed ${g} g acceleration: ${(cell * g * 9.80665).toFixed(1)} N per cell; ${(pcb * g * 9.80665).toFixed(1)} N on the PCB. These are inertial load demands, not strength ratings. PCB bending, joint pull-out and shock response require verification.`,
    `Mass balance uses editable cell/servo/HAT mass and centre-of-mass assumptions only. HAT mass ${p.driverMass} g and CG (${p.driverCgX}, ${p.driverCgY}) mm are assumptions; hardware, wiring and nose shell need final measured balance.`,
    'Cells and HAT have separate retention paths through the Al6061 frame and four metal ties to the servo mounting disk. A printed PA12 U-frame cradle, silicone gasket and two silicone contact pads, all retained by the four PCB screws with metal compression limiters, reduces unsupported PCB span beneath connector/component areas. Common POM plates (or the selectable printed PA12 prototype) with 6 mm deep lateral seats retain the cells; four stepped metal ties clamp both plates to the servo disk. No battery force is carried by the PCB. Printed material, creep, pad stiffness and impact performance are unvalidated; this is not a rated shock damper. Include the entire pack, frame and driver in departing nose mass.',
    'Series tabs show B− → cell 1 → B1 → reversed cell 2 → B2 → cell 3 → B+. Add a suitable 3S protection/balance circuit and fuse, then connect its protected output to HAT power; these unselected items and flexible leads are not modeled. Two Ø6 clear lined harness passages run through both pack plates and the metal frame. Allow service loops and frame-mounted cable strain relief; liners protect edges but are not strain relief. Wireless range inside a metal nose is not assumed.',
  ];
}
