/** Reference-inspired topology studies; dimensions and transmission details are reconstructed. */
import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  sphere,
  box,
  cylinder,
  ring,
  plate,
  circle,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
  type Vec,
} from './shapes';
import { profile } from './gears';
const rad = Math.PI / 180;
const metal = 0xaab5c0,
  polymer = 0xe4e8ed,
  blue = 0x386eb0,
  dark = 0x303640;
export function jaynesLayout(p: Parameters) {
  const radius = +p.tubeID / 2 - +p.fitClearance;
  const v2 = p.mechanism === 'jaynes-v2',
    v1 = p.mechanism === 'jaynes-v1';
  return {
    radius,
    hinge: v1
      ? Math.min(
          radius * 0.4,
          Math.sqrt(Math.max(1, (radius - 1) ** 2 - (+p.bladeWidth + 8) ** 2)) / (2 + 2 / 24),
        )
      : radius * (v2 ? 0.72 : 0.4),
    z: +p.height * 0.68,
    length: +p.flapLength,
    width: +p.bladeWidth,
    servo: (p.servo === 'standard' ? [40.7, 19.7, 42.9] : [22.8, 12.2, 28.5]) as Vec,
    v2,
    v1,
  };
}
/** Two opposed spatial crank/rocker links. Solve the actual rigid-link closure. */
export function jaynesLinkage(p: Parameters) {
  const m = jaynesLayout(p),
    crank = m.radius * 0.3,
    arm = 14;
  const start = (+p.sweep + 15) * rad;
  const theta = start - (+p.sweep * rad * +p.deployment) / 100;
  const A: Vec = [crank * Math.cos(theta), crank * Math.sin(theta), m.z - 8];
  const point = (angle: number): Vec => [
    m.hinge + arm * Math.sin(angle),
    0,
    m.z - arm * Math.cos(angle),
  ];
  const rod = Math.hypot(m.hinge - crank * Math.cos(start), crank * Math.sin(start), 8 - arm);
  const distance = (angle: number) => Math.hypot(...point(angle).map((v, i) => v - A[i]));
  let low = 0,
    high = 80 * rad;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (distance(mid) < rod) low = mid;
    else high = mid;
  }
  const angle = (low + high) / 2,
    B = point(angle);
  return { A, B, rod, angle: angle / rad, error: Math.abs(distance(angle) - rod) };
}
const alongY = (s: Shape) => rotate(s, 90, 'x');
const at = (s: Shape, offset: Vec) => transform(s, 0, offset);
function rodBetween(a: Vec, b: Vec): Shape {
  const delta = b.map((v, i) => v - a[i]),
    length = Math.hypot(...delta);
  return transform(
    rotate(
      union(cylinder(0.9, length, [0, 0, 0]), sphere(2.5, [0, 0, 0]), sphere(2.5, [0, 0, length])),
      Math.atan2(Math.hypot(delta[0], delta[1]), delta[2]) / rad,
      'y',
    ),
    Math.atan2(delta[1], delta[0]) / rad,
    a,
  );
}
export function hingedJaynes(p: Parameters, state: string): Piece[] {
  const m = jaynesLayout(p),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = metal) => out.push({ label, shape, color });
  const d = +p.tubeOD / 2,
    h = +p.height,
    a = m.hinge,
    z = m.z,
    w = m.width,
    L = m.length;
  const angle = m.v2 ? jaynesLinkage(p).angle : (+p.sweep * +p.deployment) / 100;
  const offsetY = m.v1 ? w / 2 + 4 : 0;
  const gearY = offsetY + w / 2 + (m.v1 ? 4 : 9);
  const baseZ = z - Math.max(L + 5, m.servo[0] * 0.72 + 6);
  const flapPose = (s: Shape, side: number) =>
    at(rotate(s, -side * angle, 'y'), [side * a, offsetY, z]);
  const flapShape = (side: number): Shape => {
    const alpha0 = Math.asin((offsetY - w / 2) / (d - 0.2));
    const alpha1 = Math.asin((offsetY + w / 2) / (d - 0.2));
    const arc = (r: number, reverse = false) =>
      Array.from({ length: 25 }, (_, i) => {
        const t = alpha0 + ((alpha1 - alpha0) * (reverse ? 24 - i : i)) / 24;
        return [side * (r * Math.cos(t) - a), r * Math.sin(t) - offsetY] as [number, number];
      });
    let shape = union(
      plate([...arc(d - 0.2), ...arc(d - 2.2, true)], [], -L, L),
      plate([[0, -w / 2], ...arc(d - 0.2), [0, w / 2]], [], -2, 2),
      alongY(ring(3.5, 1.6, -w / 2, w)),
      ...(m.v2 ? [box([3, 5, 14], [-1.5, -2.5, -14])] : []),
    );
    shape = subtract(shape, alongY(cylinder(1.6, w + 2, [0, 0, -w / 2 - 1])));
    if (m.v2)
      shape = subtract(
        shape,
        sphere(3.3, [0, 0, -14]),
        box([3, 6, 8], [side === 1 ? -3 : 0, -3, -16]),
      );
    return shape;
  };
  const windows = [1, -1].map((side) =>
    box([d + 2, w + 3, L + d - a + 5], [side === 1 ? 0 : -d - 2, offsetY - w / 2 - 1.5, z - L - 1]),
  );
  if (state === 'assembled' || state === 'cutaway') {
    let shell = subtract(ring(d, +p.tubeID / 2, 0, h), ...windows);
    if (state === 'cutaway') shell = subtract(shell, box([d * 2, d * 2, h + 2], [0, -d * 2, -1]));
    add('Slotted body tube', shell, 0x737e8b);
  }
  const postXY = [
    [-m.radius * 0.4, -m.radius * 0.8],
    [m.radius * 0.4, -m.radius * 0.8],
    [-m.radius * 0.12, m.radius * 0.9],
    [m.radius * 0.12, m.radius * 0.9],
  ];
  const holes = postXY.map(([x, y]) => circle(2.6, x, y, 48));
  if (state !== 'mechanism') {
    add('Lower bulkhead', plate(circle(m.radius), holes, 0, 3));
    if (state !== 'cutaway') add('Upper bulkhead', plate(circle(m.radius), holes, h - 3, 3));
    postXY.forEach(([x, y], i) => add(`Frame standoff ${i + 1}`, ring(2.5, 1.55, 0, h, x, y)));
  }
  let bridge: Shape = plate(circle(m.radius), holes, baseZ, 3);
  for (const side of [1, -1]) {
    add(`Jaynes hinged flap ${side === 1 ? 1 : 2}`, flapPose(flapShape(side), side), polymer);
    const backY = offsetY - w / 2 - 3.5,
      frontY = gearY + 2;
    for (const yy of [backY, frontY])
      bridge = union(
        bridge,
        subtract(
          box([7, 3, z + 4 - baseZ], [side * a - 3.5, yy, baseZ]),
          at(alongY(cylinder(1.6, 5, [0, 0, 0])), [side * a, yy + 4, z]),
        ),
      );
    add(
      `Flap hinge shaft ${side}`,
      at(alongY(cylinder(1.5, frontY + 3 - backY, [0, 0, 0])), [side * a, frontY + 3, z]),
    );
  }
  const [sl, sw, sh] = m.servo;
  if (m.v2) {
    const deck = z - 23;
    add(
      'Vertical servo body · installation envelope',
      box([sl, sw, sh], [-sl + sw / 2, -sw / 2, deck - sh - 3]),
      blue,
    );
    bridge = subtract(
      bridge,
      box([sl + 1, sw + 1, sh + 2], [-sl + sw / 2 - 0.5, -sw / 2 - 0.5, deck - sh - 4]),
    );
    bridge = union(bridge, plate(circle(m.radius), [circle(3.2), ...holes], deck, 3));
    add('Vertical output shaft', cylinder(3, z - 4 - (deck - 3), [0, 0, deck - 3]), metal);
    const q = jaynesLinkage(p),
      crank = m.radius * 0.3;
    add(
      'Two-arm rotary crank',
      transform(
        subtract(
          plate(
            [
              [-crank - 5, -5],
              [crank + 5, -5],
              [crank + 5, 5],
              [-crank - 5, 5],
            ],
            [circle(3.1)],
            z - 6,
            2,
          ),
          sphere(3.5, [crank, 0, z - 8]),
          sphere(3.5, [-crank, 0, z - 8]),
        ),
        +p.sweep + 15 - (+p.sweep * +p.deployment) / 100,
      ),
      blue,
    );
    for (const side of [1, -1]) {
      const phase = side === 1 ? 0 : 180;
      add(
        `Articulated constant-length link ${side} · spherical ends`,
        transform(rodBetween(q.A, q.B), phase),
      );
    }
  } else {
    const mod = (2 * a) / 24;
    for (const side of [1, -1]) {
      // Side gears mesh 1:1; mirrored flap poses turn in opposite directions.
      const gear = plate(profile(mod, 24), [circle(1.55)], 0, 3);
      add(
        `Opposed flap gear ${side} · 24 teeth · m${mod.toFixed(3)}`,
        at(alongY(transform(gear, side === 1 ? angle : -angle + 180 / 24)), [side * a, gearY, z]),
        polymer,
      );
    }
    const sx = m.v1 ? -a : 0,
      sy = m.v1 ? 0 : 8;
    add(
      m.v1
        ? 'Transverse micro servo · installation envelope'
        : 'Centered transverse servo · installation envelope',
      box([sw, sh, sl], [sx - sw / 2, sy - sh, z - sl * 0.72]),
      blue,
    );
    // Cradle ribs join the carrier base and support the installation envelope.
    bridge = union(
      bridge,
      box([sw + 4, sh + 2, z - sl * 0.72 - baseZ], [sx - sw / 2 - 2, sy - sh - 1, baseZ]),
    );
    bridge = subtract(
      bridge,
      box([sw + 0.4, sh + 0.4, sl + 1], [sx - sw / 2 - 0.2, sy - sh - 0.2, z - sl * 0.72]),
    );
    if (!m.v1) {
      const smallMod = a / 20;
      for (const [i, x] of [0, -a].entries())
        add(
          `Offset input transfer gear ${i + 1} · 20 teeth`,
          at(
            alongY(
              transform(
                plate(profile(smallMod, 20), [circle(1.55)], 0, 3),
                i === 0 ? angle : -angle + 180 / 20,
              ),
            ),
            [x, w / 2 + 4, z],
          ),
          polymer,
        );
      add(
        'Central servo output extension',
        at(alongY(cylinder(1.5, w / 2 + 4 - sy, [0, 0, 0])), [0, w / 2 + 4, z]),
      );
    }
  }
  add('Integral hinge carrier and servo cradle', bridge, metal);
  return out;
}
