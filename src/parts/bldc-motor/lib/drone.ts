import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { cylinder, prism, subtract, union, type Shape } from './shapes';

interface Hole {
  x: number;
  y: number;
  diameter: number;
}
interface DroneMotor {
  diameter: number;
  length: number;
  shaft: number;
  extension: number;
  holeDepth: number;
  statorDiameter: number;
  statorLength: number;
  slots: number;
  poles: number;
  drone: {
    family: string;
    baseHeight: number;
    topHeight: number;
    wall: number;
    internalShaft: number;
    rearExtension: number;
    bossDiameter: number;
    bossHeight: number;
    mountHoles: Hole[];
    frontHoles: Hole[];
    frontDepth: number;
    bearingDiameter: number;
    color: number;
  };
}
function sector(r0: number, r1: number, a0: number, a1: number, z: number, h: number): Shape {
  const points: [number, number][] = [];
  for (const [radius, reverse] of [
    [r1, false],
    [r0, true],
  ] as const)
    for (let j = 0; j <= 8; j++) {
      const a = ((a0 + ((a1 - a0) * (reverse ? 8 - j : j)) / 8) * Math.PI) / 180;
      points.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }
  return prism(points, h, z);
}
const ring = (r: number, inner: number, z: number, h: number) =>
  subtract(cylinder(r, h, [0, 0, z]), cylinder(inner, h + 2, [0, 0, z - 1]));

/** Supplier mounting interfaces with reconstructed ventilated shells and electromagnetic interiors. */
export function dronePieces(m: DroneMotor, p: Parameters, state: string): Piece[] {
  const d = m.drone,
    R = m.diameter / 2,
    L = m.length;
  const rearR = d.internalShaft / 2,
    shaftR = m.shaft / 2;
  const gap = state === 'exploded' ? R * 0.8 : 0;
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color: number, z = 0, rotates = false) =>
    out.push({ label, shape, color, z, angle: rotates ? Number(p.outputAngle) : 0 });
  const b = d.baseHeight,
    top = d.topHeight;
  const bearingR = d.bearingDiameter / 2;
  let base: Shape;
  if (d.family === 'multirotor') {
    base = cylinder(R - d.wall - 0.3, b, [0, 0, -L]);
  } else {
    const count = d.mountHoles.length;
    const first = d.mountHoles[0],
      phase = Math.atan2(first.y, first.x);
    const reach = Math.hypot(first.x, first.y) + first.diameter / 2 + (count === 3 ? 0.35 : 0.7);
    const center = Math.max(bearingR + 0.4, reach * 0.62);
    const points: [number, number][] = Array.from({ length: 144 }, (_, i) => {
      const a = (i * Math.PI * 2) / 144;
      const r = center + (reach - center) * Math.pow((1 + Math.cos(count * (a - phase))) / 2, 2);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    base = prism(points, b, -L);
  }
  add(
    'Stationary mounting base',
    subtract(
      base,
      cylinder(bearingR + 0.05, b + 2, [0, 0, -L - 1]),
      ...d.mountHoles.map((h) =>
        cylinder(h.diameter / 2, m.holeDepth >= b ? b + 2 : m.holeDepth + 0.1, [
          h.x,
          h.y,
          -L - (m.holeDepth >= b ? 1 : 0.1),
        ]),
      ),
    ),
    0x747c83,
    -gap,
  );
  add(
    d.family === 'whoop' ? 'Brass shaft bushing' : 'Rear bearing outer race',
    ring(bearingR, rearR + 0.08, -L + 0.08, b - 0.16),
    d.family === 'whoop' ? 0xb99b57 : 0xaab3bc,
    -gap,
  );

  const bellBottom = -L + b + 0.25;
  let bell: Shape = cylinder(R, -bellBottom, [0, 0, bellBottom]);
  if (d.bossHeight) bell = union(bell, cylinder(d.bossDiameter / 2, d.bossHeight, [0, 0, 0]));
  const holeOuter = Math.max(0, ...d.frontHoles.map((h) => Math.hypot(h.x, h.y) + h.diameter / 2));
  const ventInner = Math.max(R * 0.5, holeOuter + 0.8, bearingR + 0.5);
  const ventOuter = R - d.wall - Math.max(0.35, R * 0.045);
  const vents = d.family === 'whoop' ? 3 : 6;
  add(
    'Ventilated rotor bell',
    subtract(
      bell,
      cylinder(R - d.wall, -top - bellBottom + 0.1, [0, 0, bellBottom - 0.1]),
      cylinder(Math.max(shaftR, rearR) + 0.05, L + d.bossHeight + 2, [0, 0, -L - 1]),
      ...Array.from({ length: vents }, (_, i) =>
        sector(
          ventInner,
          ventOuter,
          (i * 360) / vents + 8,
          ((i + 1) * 360) / vents - 8,
          -top - 0.1,
          top + 0.2,
        ),
      ),
      ...d.frontHoles.map((h) =>
        cylinder(h.diameter / 2, d.frontDepth + 0.1, [h.x, h.y, d.bossHeight - d.frontDepth]),
      ),
    ),
    d.color,
    gap * 1.7,
    true,
  );

  // Published stator sizes where available; axial placement and winding geometry are illustrative.
  const available = L - b - top - 1;
  const h = Math.min(m.statorLength, available);
  const z = -L + b + 0.5 + (available - h) / 2;
  const statorR = m.statorDiameter / 2,
    pitch = 360 / m.slots;
  const hubR = Math.max(statorR * 0.58, rearR + 0.6);
  add(
    'Stator core and teeth',
    union(
      ring(hubR, rearR + 0.2, z, h),
      ...Array.from({ length: m.slots }, (_, i) =>
        sector(hubR - 0.1, statorR * 0.96, i * pitch - pitch * 0.1, i * pitch + pitch * 0.1, z, h),
      ),
    ),
    0x69757d,
  );
  for (let i = 0; i < m.slots; i++)
    for (const side of [-1, 1])
      add(
        `Copper winding envelope ${i + 1}${side < 0 ? 'A' : 'B'}`,
        sector(
          Math.max(statorR * 0.62, hubR + 0.08),
          statorR * 0.92,
          i * pitch + side * pitch * 0.27 - pitch * 0.115,
          i * pitch + side * pitch * 0.27 + pitch * 0.115,
          z + 0.08,
          h - 0.16,
        ),
        i % 2 ? 0xbf7839 : 0x9c5b29,
      );
  const magnetOuter = R - d.wall - 0.06;
  const magnetInner = Math.max(statorR + 0.15, magnetOuter - Math.min(0.8, R * 0.07));
  for (let i = 0; i < m.poles; i++)
    add(
      `Rotor magnet ${i + 1}`,
      sector(
        magnetInner,
        magnetOuter,
        (i * 360) / m.poles + 0.8,
        ((i + 1) * 360) / m.poles - 0.8,
        z,
        h,
      ),
      i % 2 ? 0x83868a : 0xb0b2b5,
      gap * 1.7,
      true,
    );

  const shaftBottom = -L - d.rearExtension;
  const shaftEnd = m.extension || d.bossHeight;
  const shoulder = -top * 0.5;
  add(
    'Rotor and output shaft',
    union(
      cylinder(rearR, shoulder - shaftBottom, [0, 0, shaftBottom]),
      cylinder(shaftR, shaftEnd - shoulder, [0, 0, shoulder]),
    ),
    0xc1c7cd,
    gap * 1.7,
    true,
  );
  if (p.showLeads) {
    const cableR = Math.min(1.2, R * 0.055);
    for (let i = 0; i < 3; i++)
      add(
        `Phase lead ${i + 1}`,
        cylinder(cableR, R * 0.85, [(i - 1) * cableR * 2.7, R + 0.15, -L + b / 2], 'y'),
        [0x484b50, 0x33363b, 0x656971][i],
        -gap,
      );
  }
  return out;
}
