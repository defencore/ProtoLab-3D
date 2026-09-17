import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import type { layout } from './model';
import {
  box,
  cylinder,
  circle,
  plate,
  ring,
  subtract,
  union,
  transform,
  type Point,
  type Shape,
} from './shapes';
import { phases, layer, paired, linkage, ribbon, camLift } from './kinematics';
import { profile } from './gears';
type Layout = ReturnType<typeof layout>;
const rad = Math.PI / 180,
  steel = 0xa6afb9,
  blue = 0x386eb0,
  dark = 0x303640;
const hex = (z: number, height: number) =>
  plate(circle(4 / Math.cos(Math.PI / 6), 0, 0, 6), [], z, height);
const hexHole = () => circle(4.08 / Math.cos(Math.PI / 6), 0, 0, 6);
function replace(items: Piece[], label: string, shape: Shape) {
  items.find((p) => p.label === label)!.shape = shape;
}
export function sculptedCam(
  p: Parameters,
  d: number,
  slot: (p: Parameters, phase: number) => Point[],
): Shape {
  const sections: Shape[] = [cylinder(11, 3, [0, 0, d + 13.1])];
  for (const a of phases(p)) {
    const points: Point[] = Array.from({ length: 97 }, (_, i) => {
      const f = -1 / +p.sweep + ((1 + 2 / +p.sweep) * i) / 96,
        r = +p.tubeID * 0.23 + +p.stroke * camLift(p, f),
        t = (a - +p.sweep * f) * rad;
      return [r * Math.cos(t), r * Math.sin(t)];
    });
    sections.push(plate(ribbon(points, 11.5), [], d + 13.1, 3));
    const t = (a + 12) * rad,
      r = +p.tubeID * 0.23;
    sections.push(
      plate(
        ribbon(
          [
            [7 * Math.cos(t), 7 * Math.sin(t)],
            [r * Math.cos(t), r * Math.sin(t)],
          ],
          5,
        ),
        [],
        d + 13.1,
        3,
      ),
    );
  }
  return subtract(
    union(...sections),
    plate(hexHole(), [], d + 12.1, 5),
    ...phases(p).map((a) => plate(slot(p, a), [], d + 12.1, 5)),
  );
}
export function tray(m: Layout, d: number): Shape {
  const length = m.railEnd - m.railStart;
  return union(
    box([length, 18, 1], [m.railStart, -9, d + 3]),
    box([length, 1.8, 6.6], [m.railStart, -9, d + 4]),
    box([length, 1.8, 6.6], [m.railStart, 7.2, d + 4]),
  );
}
function supportUpperTrays(p: Parameters, m: Layout, items: Piece[]) {
  if (!paired(p)) return;
  for (const i of [1, 3])
    for (const [j, x] of [m.railEnd - 2].entries()) {
      // Legs lie under the upper tray and outside the other pair's sliding corridor.
      items.push({
        label: `Upper tray support ${i}.${j}`,
        shape: transform(box([3, 16, 20], [x - 1.5, -8, m.deck + 3]), phases(p)[i]),
        color: steel,
      });
    }
}
export function alternativeDrive(p: Parameters, m: Layout, items: Piece[]) {
  const k = linkage(p),
    d = m.deck;
  const top = paired(p) ? 38 : 18;
  replace(
    items,
    'Hex drive adaptor',
    transform(
      union(cylinder(5.5, 0.3, [0, 0, d + 12.8]), hex(d + 13.1, top - 13.1)),
      k.theta / rad,
    ),
  );
  replace(items, 'Cam retaining cap', cylinder(4.8, 1, [0, 0, d + top]));
  const groupPhases = paired(p)
    ? [
        [0, 180],
        [90, 270],
      ]
    : [[0, 120, 240]];
  for (const [level, angles] of groupPhases.entries()) {
    const z = d + 16 + level * 20;
    const holes = angles.map((a) =>
      circle(1.6, k.crank * Math.cos(a * rad), k.crank * Math.sin(a * rad), 32),
    );
    const outline = paired(p)
      ? ribbon(
          angles.map((a) => [k.crank * Math.cos(a * rad), k.crank * Math.sin(a * rad)]),
          6,
        )
      : circle(k.crank + 3);
    items.push({
      label: `Crank ${level + 1}`,
      shape: transform(
        subtract(
          union(plate(outline, [], z, 2), cylinder(6, 2, [0, 0, z])),
          plate(hexHole(), [], z - 1, 4),
          ...holes.map((h) => plate(h, [], z - 1, 4)),
        ),
        k.theta / rad,
      ),
      color: blue,
    });
  }
  for (const [i, a] of phases(p).entries()) {
    const z = d + layer(p, i),
      A = k.joint,
      B: [number, number] = [k.q, 0],
      dx = B[0] - A[0],
      dy = B[1] - A[1],
      length = Math.hypot(dx, dy);
    const bend = paired(p) ? 0 : 0.34 * length;
    const C: Point = [
      (A[0] + B[0]) / 2 - (dy / length) * bend,
      (A[1] + B[1]) / 2 + (dx / length) * bend,
    ];
    const path: Point[] = Array.from({ length: 33 }, (_, j) => {
      const t = j / 32;
      return [
        (1 - t) ** 2 * A[0] + 2 * t * (1 - t) * C[0] + t * t * B[0],
        (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * C[1] + t * t * B[1],
      ];
    });
    items.push({
      label: `${paired(p) ? 'Straight' : 'Curved'} connecting link ${i + 1}`,
      shape: transform(
        subtract(
          union(
            plate(ribbon(path, paired(p) ? 4 : 6), [], z + 13.1, 2.2),
            cylinder(2.5, 2.2, [...A, z + 13.1]),
            cylinder(3.2, 2.2, [...B, z + 13.1]),
          ),
          cylinder(1.6, 4.2, [...A, z + 12.1]),
          cylinder(2.6, 4.2, [...B, z + 12.1]),
        ),
        a,
      ),
      color: steel,
    });
    items.push({
      label: `Crank pivot pin ${i + 1}`,
      shape: transform(cylinder(1.5, 7.4, [...A, z + 13.1]), a),
      color: steel,
    });
    items.push({
      label: `Crank thrust washer ${i + 1}`,
      shape: transform(ring(2.5, 1.55, z + 15.4, 0.6, ...A), a),
      color: dark,
    });
    items.push({
      label: `Crank lock nut ${i + 1}`,
      shape: transform(
        plate(circle(2.75 / Math.cos(Math.PI / 6), ...A, 6), [circle(1.55, ...A, 32)], z + 18.5, 2),
        a,
      ),
      color: dark,
    });
  }
  supportUpperTrays(p, m, items);
}
export function rackProfile(p: Parameters, m: Layout): Point[] {
  const pitchRadius = +p.stroke / (+p.sweep * rad),
    mod = pitchRadius / 10,
    pitch = Math.PI * mod;
  const start = -+p.stroke - 5,
    end = m.followerStart + 4,
    root = -pitchRadius - 1.25 * mod,
    tip = -pitchRadius + mod;
  const halfRoot = pitch / 4 + 1.25 * mod * Math.tan(20 * rad) - 0.06 * mod,
    halfTip = pitch / 4 - mod * Math.tan(20 * rad) - 0.06 * mod;
  const upper: Point[] = [[start, root]];
  for (let i = Math.ceil(start / pitch); (i + 0.5) * pitch + halfRoot < end; i++) {
    const x = (i + 0.5) * pitch;
    if (x - halfRoot <= start) continue;
    upper.push([x - halfRoot, root], [x - halfTip, tip], [x + halfTip, tip], [x + halfRoot, root]);
  }
  return [[start, -pitchRadius - 4], [end, -pitchRadius - 4], [end, root], ...upper.reverse()];
}
export function rackDrive(p: Parameters, m: Layout, items: Piece[]) {
  const d = m.deck,
    r = +p.stroke / (+p.sweep * rad),
    mod = r / 10;
  replace(
    items,
    'Hex drive adaptor',
    transform(union(cylinder(5.5, 0.3, [0, 0, d + 12.8]), hex(d + 13.1, 23)), m.angle),
  );
  replace(items, 'Cam retaining cap', cylinder(5, 1, [0, 0, d + 36.1]));
  for (let i = 0; i < 2; i++)
    items.push({
      label: `Drive pinion ${i + 1} · 20 teeth`,
      shape: transform(plate(profile(mod, 20), [hexHole()], d + 13.1 + 20 * i, 3), m.angle),
      color: blue,
    });
  for (const [i, a] of phases(p).entries()) {
    const z = d + layer(p, i),
      rshape = plate(rackProfile(p, m), [], z + 13.1, 3);
    const bracket = box([2, r + 4, 3.3], [m.followerStart + 2, -r - 4, z + 12.8]);
    items.push({
      label: `Radial rack and blade bracket ${i + 1}`,
      shape: transform(transform(union(rshape, bracket), 0, [m.travel, 0, 0]), a),
      color: steel,
    });
  }
  supportUpperTrays(p, m, items);
}
export function petalOutline(p: Parameters, m: Layout): Point[] {
  const P = m.radius * 0.57,
    R = +p.tubeOD / 2 - 0.2;
  return [
    ...Array.from({ length: 45 }, (_, j) => {
      const a = (55 * rad * j) / 44;
      return [R * Math.cos(a) - P, R * Math.sin(a)] as Point;
    }),
    ...Array.from({ length: 45 }, (_, j) => {
      const a = 55 * rad * (1 - j / 44);
      return [P * Math.cos(a) - P, P * Math.sin(a)] as Point;
    }),
  ];
}
export function gearedPetals(p: Parameters, m: Layout, items: Piece[]) {
  const d = m.deck,
    P = m.radius * 0.57,
    mod = (2 * P) / 60;
  items.push({
    label: 'Central petal pinion · 18 teeth',
    shape: transform(plate(profile(mod, 18), [hexHole()], d + 13.1, 3), m.angle),
    color: blue,
  });
  for (const [i, a] of phases(p).entries()) {
    const rotation = (-18 / 42) * m.angle;
    const leaf = subtract(
      union(
        transform(plate(profile(mod, 42), [], d + 13.1, 3), 180 + 180 / 42),
        plate(petalOutline(p, m), [], d + 13.1, 3),
      ),
      cylinder(1.6, 5, [0, 0, d + 12.1]),
    );
    items.push({
      label: `Geared pivoting petal ${i + 1} · 42 teeth`,
      shape: transform(transform(leaf, rotation, [P, 0, 0]), a),
      color: steel,
    });
    items.push({
      label: `Petal pivot pedestal ${i + 1}`,
      shape: transform(ring(4, 1.55, d + 3, 10, P), a),
      color: dark,
    });
    items.push({
      label: `Petal pivot pin ${i + 1}`,
      shape: transform(cylinder(1.5, 16, [P, 0, d + 3]), a),
      color: steel,
    });
    items.push({
      label: `Petal pivot washer ${i + 1}`,
      shape: transform(ring(2.5, 1.55, d + 16.2, 0.8, P), a),
      color: steel,
    });
    items.push({
      label: `Petal pivot nut ${i + 1}`,
      shape: transform(
        plate(circle(2.75 / Math.cos(Math.PI / 6), P, 0, 6), [circle(1.55, P, 0, 32)], d + 17, 2),
        a,
      ),
      color: dark,
    });
  }
}
