import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  circle,
  plate,
  ring,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
} from '../../rocket-release/lib/shapes';
import { screw } from '../../rocket-release/lib/hardware';
import type { Piece } from './model';
import {
  polar,
  ties,
  dispenserMounts,
  layout,
  electronicsMount,
  parachuteExitRadius,
} from './layout';
export const metal = 0xb9c5ce,
  polymer = 0xe6dfcb,
  dark = 0x333c46;
// A global helix phase lets mating holes keep the same flank clocking after placement.
export const thread = (
  d: number,
  pitch: number,
  length: number,
  z: number,
  internal = false,
  clearance = 0,
  process?: 'printed',
  designation?: string,
): Shape =>
  transform(
    { kind: 'thread', diameter: d, pitch, length, internal, clearance, process, designation },
    (360 * z) / pitch,
    [0, 0, z],
  );
export const bore = (r: number, z: number, h: number, x = 0, y = 0) => cylinder(r, h, [x, y, z]);
export const at = (s: Shape, x: number, y: number, z = 0) => transform(s, 0, [x, y, z]);
export function tapped(d: number, pitch: number, z: number, h: number, x = 0, y = 0) {
  return at(thread(d, pitch, h, z, true, 0.04), x, y);
}
/** Shop allowances, not a universal tap/die standard. All depths start at the mouth. */
export function blindTapDimensions(d: 3 | 4, penetration: number) {
  const pitch = d === 4 ? 0.7 : 0.5;
  const drillDiameter = d === 4 ? 3.3 : 2.5;
  const fullDepth = penetration + pitch;
  const tapLead = 3 * pitch;
  const chipSpace = 2 * pitch;
  const drillDepth = fullDepth + tapLead + chipSpace;
  const pointDepth = drillDiameter / 2 / Math.tan((59 * Math.PI) / 180);
  return {
    diameter: d,
    pitch,
    penetration,
    drillDiameter,
    fullDepth,
    tapLead,
    chipSpace,
    drillDepth,
    pointDepth,
    totalDepth: drillDepth + pointDepth,
    entryDepth: (d + 0.2 - drillDiameter) / 2,
  };
}
/** Cutter directed into local +Z. The tapered lead has only incomplete threads. */
export function blindTap(s: ReturnType<typeof blindTapDimensions>, phase: number): Shape {
  const r = s.drillDiameter / 2;
  const runoutMask = subtract(bore(s.diameter / 2 + 0.3, s.fullDepth, s.tapLead + 0.1), {
    kind: 'cone',
    bottom: s.diameter / 2 + 0.04,
    top: r,
    height: s.tapLead,
    z: s.fullDepth,
  });
  return union(
    subtract(
      transform(thread(s.diameter, s.pitch, s.fullDepth + s.tapLead, 0, true, 0.04), phase),
      runoutMask,
    ),
    bore(r, -0.1, s.drillDepth + 0.1),
    { kind: 'cone', bottom: r, top: 0, height: s.pointDepth, z: s.drillDepth },
    { kind: 'cone', bottom: s.diameter / 2 + 0.1, top: r, height: s.entryDepth, z: 0 },
  );
}
export function blindTapNote(s: ReturnType<typeof blindTapDimensions>): string {
  const f = (n: number) => n.toFixed(2);
  return `M${s.diameter}x${s.pitch}: screw penetration ${f(s.penetration)}; full-profile depth ${f(s.fullDepth)} from mouth (entry chamfer ${f(s.entryDepth)} excluded from engagement); incomplete tap lead ${f(s.tapLead)}; chip reserve ${f(s.chipSpace)}; drill D${s.drillDiameter} to cylindrical depth ${f(s.drillDepth)}, total tip depth ${f(s.totalDepth)} with 118-degree drill. All lengths mm. Finish with a cutting tap of at most 3P lead; verify the actual tool. Runout and drill cone carry no credited engagement.`;
}
/** Integral turned stud with a 2P die-exit neck and half-pitch tip chamfer. */
export function turnedStud(d: number, pitch: number, shoulder: number, tip: number): Shape {
  const relief = 2 * pitch;
  const neck = d / 2 - (pitch * Math.sqrt(3) * 17) / 48 - 0.02;
  const chamfer = pitch / 2;
  if (tip - shoulder <= relief + chamfer) throw new Error('Stud is too short for its tool relief.');
  return subtract(
    union(
      bore(neck, shoulder - 0.05, relief + 0.1),
      thread(d, pitch, tip - shoulder - relief, shoulder + relief),
    ),
    subtract(bore(d / 2 + 0.1, tip - chamfer, chamfer + 0.1), {
      kind: 'cone',
      bottom: d / 2,
      top: d / 2 - chamfer,
      height: chamfer,
      z: tip - chamfer,
    }),
  );
}
/** 90-degree deburr at both faces of a through-tapped metal plate. */
export function threadEntries(d: number, pitch: number, z: number, h: number, x = 0, y = 0): Shape {
  const major = d / 2 + 0.12;
  const minor = d / 2 - (pitch * Math.sqrt(3) * 5) / 16 + 0.04;
  const depth = major - minor;
  // Extend both ends past the face and thread root. A cone ending exactly on
  // a helical root can leave coincident sliver edges in an OCC cut.
  return at(
    union(
      { kind: 'cone', bottom: major + 0.1, top: minor - 0.05, height: depth + 0.15, z: z - 0.1 },
      {
        kind: 'cone',
        bottom: minor - 0.05,
        top: major + 0.1,
        height: depth + 0.15,
        z: z + h - depth - 0.05,
      },
    ),
    x,
    y,
  );
}
export const torus = (r: number, w: number): Shape => ({
  kind: 'torus',
  radius: r,
  wireRadius: w,
  arc: 360,
});
/** Round the parachute exit at local Z5; the stationary pressure tube opens toward -Z.
 * The retained quarter-torus joins ID86 tangentially and leaves a 1 mm end land.
 * Boolean primitives preserve the same circular profile in preview and native CAD.
 */
export function parachuteChamberTube(length: number): Shape {
  const z = 5,
    inner = 43,
    r = parachuteExitRadius;
  const corner = subtract(bore(inner + r, z - 0.1, r + 0.1), at(torus(inner + r, r), 0, 0, z + r));
  return subtract(ring(45, inner, z, length), corner);
}
export function hex(af: number, z: number, h: number) {
  return plate(
    Array.from({ length: 6 }, (_, i) => polar(af / Math.sqrt(3), i * 60)),
    [],
    z,
    h,
  );
}
export function axialScrew(
  d: number,
  length: number,
  tip: number,
  x: number,
  y: number,
  down = false,
): Shape {
  const s = screw(d, length, d === 4 ? { headDiameter: 7, headHeight: 4 } : {});
  if (d === 4 && s.kind === 'fastener')
    Object.assign(s.parameters, { driveWidth: 3, driveDepth: 2 });
  if (d === 6 && s.kind === 'fastener')
    Object.assign(s.parameters, {
      pitch: 1,
      headSize: 10,
      headHeight: 6,
      driveWidth: 5,
      driveDepth: 3,
    });
  if (d === 8 && s.kind === 'fastener')
    Object.assign(s.parameters, {
      pitch: 1.25,
      headSize: 13,
      headHeight: 8,
      driveWidth: 6,
      driveDepth: 4,
      tipLength: 0.625,
      tipDiameter: 7.375,
    });
  return at(rotate(s, down ? 180 : 0, 'x'), x, y, tip);
}
export function tubeFastener(angle: number, z: number, nylon = false): Shape {
  const d = nylon ? 2.5 : 3;
  const s = screw(d, nylon ? 8 : 6, {
    head: 'countersunk',
    headDiameter: nylon ? 4.7 : 6,
    headHeight: nylon ? 1.5 : 1.7,
  });
  if (s.kind === 'fastener')
    Object.assign(
      s.parameters,
      nylon
        ? { drive: 'cross', driveWidth: 2.5, driveThickness: 0.6, driveDepth: 0.8 }
        : { driveWidth: 2, driveDepth: 1.2 },
    );
  // Both flat heads end at R45. The M2.5x8 shear screw starts at R37.
  return transform(rotate(s, 90, 'y'), angle, [...polar(nylon ? 37 : 39, angle), z]);
}
export function radialHole(angle: number, z: number, d: number): Shape {
  const pitch = d === 2.5 ? 0.45 : d === 4 ? 0.7 : 0.5;
  return transform(
    rotate(
      {
        kind: 'thread',
        diameter: d,
        pitch,
        length: d === 3 ? 7 : 9,
        internal: true,
        clearance: 0.04,
      },
      90,
      'y',
    ),
    angle,
    [...polar(d === 3 ? 39 : 37, angle), z],
  );
}
export function tubeSeat(angle: number, z: number, nylon = false): Shape {
  return transform(
    rotate(
      union(bore(nylon ? 1.4 : 1.65, 0, 9), {
        kind: 'cone',
        bottom: nylon ? 1.4 : 1.65,
        top: nylon ? 2.9 : 3.35,
        height: nylon ? 1.5 : 1.7,
        z: nylon ? 6.5 : 4.3,
      } as Shape),
      90,
      'y',
    ),
    angle,
    [...polar(nylon ? 37 : 39, angle), z],
  );
}
export function bulkhead(p: Parameters): Shape {
  const v = layout(p);
  const body = union(
    bore(45, 0, 5),
    ring(v.fixedSpigot, v.fixedInner, -20, 20),
    ring(v.releaseSpigot, v.releaseInner, 5, 20),
  );
  const seals = ring(44, v.releaseSpigot - 1.4, 20.5, 2.6);
  return subtract(
    body,
    seals,
    bore(12.7, -1, 7),
    bore(3.2, -1, 7, 0, 29),
    ...(v.fourS ? [] : [-v.cellX, v.cellX]).map((x) =>
      bore(v.insertHoleRadius, -0.05, v.bulkheadSocketDepth + 0.05, x, 0),
    ),
    ...ties.map(([x, y]) => bore(electronicsMount.clearanceDiameter / 2, -0.5, 6, x, y)),
    ...dispenserMounts.map(([x, y]) => tapped(3, 0.5, -0.5, 6, x, y)),
    ...dispenserMounts.map(([x, y]) => threadEntries(3, 0.5, 0, 5, x, y)),
    ...[45, 135, 225, 315].map((a) => radialHole(a, -10, 3)),
    ...Array.from({ length: +p.pinCount }, (_, i) =>
      radialHole(60 + (360 * i) / +p.pinCount, 14, 2.5),
    ),
  );
}
export function dispenser(p: Parameters): Piece[] {
  const female = +p.printFemaleAllowance,
    male = -+p.printMaleRelief;
  const mounts = dispenserMounts.map(([x, y]) =>
    union(
      bore(1.7, 4.9, 5.2, x, y),
      at({ kind: 'cone', bottom: 1.7, top: 3.2, height: 1.5, z: 8.5 }, x, y),
    ),
  );
  const shell = subtract(
    union(thread(24, 2, 16, -23, false, male, 'printed'), bore(12.5, -7, 32), bore(21, 5, 5)),
    bore(8.75, -24, 31),
    bore(5.05, 6.9, 10.2),
    thread(18, 1, 8.2, 16.9, true, female, 'printed'),
    ...[0, 60, 120].map((a) => transform(cylinder(3, 50, [-25, 0, 12], 'x'), a)),
    ...mounts,
  );
  const nut = subtract(
    transform(hex(38.4, -27.5, 20), 30),
    thread(24, 2, 16.2, -23.5, true, female, 'printed'),
    bore(6.5, -28, 5),
    ...Array.from({ length: 6 }, (_, i) => {
      const [x, y] = polar(16.5, 60 * i);
      return at(thread(3, 0.5, 20.2, -27.6, true, female, 'printed'), x, y);
    }),
  );
  const adapter = subtract(
    thread(18, 1, 8, 17, false, male, 'printed'),
    thread(9.525, 25.4 / 24, 8.2, 16.9, true, female, 'printed', '3/8-24 UNF RH'),
    bore(4.7625 + female, 24.2, 1),
    { kind: 'cone', bottom: 4.7625 + female, top: 5.2 + female, height: 0.5, z: 24.5 },
  );
  return [
    {
      label:
        'Printed dispenser PEM.P3 · D42 flange / D25 body · M24x2 / M18x1 · metal gas-unit seat D17.5',
      shape: at(shell, 0, 0, 0.5),
      color: polymer,
      material: 'PA12',
      process: '3D PRINT',
      metadata: {
        GasUnitSeat:
          'Gas-unit mounting cavity: D17.5 x30; D10.1 throat; six D6 radial outlets; no modeled valve or actuator',
        ThreadFit: `Female +${female} mm radial; male ${male} mm radial. Print vertical; calibrate before use.`,
      },
    },
    {
      label: 'Printed dispenser nut PEM.P6 · hex AF38.4 h20 · M24x2 · D13 access',
      shape: at(nut, 0, 0, 0.5),
      color: polymer,
      material: 'PA12',
      process: '3D PRINT',
    },
    {
      label: 'Printed protective adapter · M18x1 outside / 3-8 UNF24 inside · h8',
      shape: at(adapter, 0, 0, 0.5),
      color: 0xd4c19b,
      material: 'PA12',
      process: '3D PRINT',
      metadata: {
        ThreadFit: `Nominal 3/8-24 UNF pitch 1.058333 mm retained; radial female allowance ${female} mm. Cartridge connection is not a printed pressure seal.`,
      },
    },
  ];
}
export function anchor(z: number, x: number, down = false, y = 0): Piece[] {
  // Rounded forged eye envelope, through-bolted with a broad washer and nut.
  // A separate eye keeps the bulkhead itself entirely lathe + drill/tap work.
  const eye = union(
    bore(8, 0, 3),
    bore(3, 2, 5),
    at(rotate(torus(7, 2.5), 90, 'x'), 0, 0, 12),
    thread(6, 1, 14, -14),
  );
  const place = (s: Shape) => at(rotate(s, down ? 180 : 0, 'x'), x, y, z);
  return [
    {
      label: `BUY rounded shoulder eye ${down ? 'body floor' : 'separating bulkhead'} · M6x1 · eye ID9 / bar5 · supplier load rating required`,
      shape: place(eye),
      color: metal,
      material: 'stainless steel',
      process: 'BUY',
      metadata: {
        Harness:
          'Soft eye with abrasion sleeve on smooth bar; never tie cord directly through a drilled sheet edge. Dimensions are procurement envelope, not certified hardware.',
      },
    },
    {
      label: `Anchor backing washer ${down ? 'body' : 'bulkhead'} · steel D18 / 6.4 x2`,
      shape: place(ring(9, 3.2, -7.5, 2)),
      color: metal,
      material: 'steel',
      process: 'MAKE / TURN',
    },
    {
      label: `BUY anchor nut ${down ? 'body' : 'bulkhead'} · ISO 4032 M6x1 AF10 h5`,
      shape: place(subtract(hex(10, -12.5, 5), thread(6, 1, 5.2, -12.6, true, 0.05))),
      color: metal,
      material: 'steel',
      process: 'BUY',
    },
    {
      label: `Anchor sealing washer ${down ? 'body' : 'bulkhead'} · EPDM D16 / 6.2 x0.5`,
      shape: place(ring(8, 3.1, -0.5, 0.5)),
      color: dark,
      material: 'EPDM',
      process: 'BUY / CUT',
    },
  ];
}
