import { hingedJaynes } from './jaynes';
import { jaynesHinged } from './kinematics';
import { motion, phases as mechanismPhases, layer, paired, linked, camLift } from './kinematics';
import { alternativeDrive, sculptedCam, gearedPetals, rackDrive, tray } from './variants';
import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  box,
  cylinder,
  circle,
  plate,
  ring,
  subtract,
  union,
  transform,
  rotate,
  type Shape,
  type Point,
} from './shapes';
const rad = Math.PI / 180;
export const servoSizes = { standard: [40.7, 19.7, 42.9], micro: [22.8, 12.2, 28.5] } as const;
export function layout(p: Parameters) {
  const [servoLength, servoWidth, servoHeight] = servoSizes[p.servo as keyof typeof servoSizes];
  const radius = +p.tubeID / 2 - +p.fitClearance;
  return {
    radius,
    postRadius: radius - 3,
    camRadius: radius - 6,
    railStart: 9,
    railEnd: radius - 3,
    followerStart: +p.tubeID * 0.23,
    deck: servoHeight + 9,
    servoLength,
    servoWidth,
    servoHeight,
    ...motion(p),
  };
}
/** Archimedean spiral in the cam frame. Positive cam rotation brings -theta onto a fixed radial guide. */
export function slotPoint(p: Parameters, fraction: number, phase = 0): Point {
  const radius = +p.tubeID * 0.23 + +p.stroke * camLift(p, fraction);
  const a = (phase - +p.sweep * fraction) * rad;
  return [radius * Math.cos(a), radius * Math.sin(a)];
}
/** Offset a sampled spiral with round end caps, including 1° of overtravel at both ends. */
export function slotOutline(p: Parameters, phase: number): Point[] {
  const halfWidth = 3.65,
    extension = 1 / +p.sweep;
  const centers = Array.from({ length: 97 }, (_, i) =>
    slotPoint(p, -extension + ((1 + extension * 2) * i) / 96, phase),
  );
  const normals = centers.map((point, i) => {
    const a = centers[Math.max(0, i - 1)],
      b = centers[Math.min(96, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy);
    return [-dy / len, dx / len] as Point;
  });
  const left = centers.map(
    (c, i) => [c[0] + normals[i][0] * halfWidth, c[1] + normals[i][1] * halfWidth] as Point,
  );
  const right = centers.map(
    (c, i) => [c[0] - normals[i][0] * halfWidth, c[1] - normals[i][1] * halfWidth] as Point,
  );
  const cap = (index: number, start: number): Point[] =>
    Array.from({ length: 13 }, (_, i) => {
      const a = start - (Math.PI * i) / 12;
      return [
        centers[index][0] + halfWidth * Math.cos(a),
        centers[index][1] + halfWidth * Math.sin(a),
      ];
    });
  return [
    ...left,
    ...cap(96, Math.atan2(normals[96][1], normals[96][0])).slice(1),
    ...right.reverse().slice(1),
    ...cap(0, Math.atan2(-normals[0][1], -normals[0][0])).slice(1),
  ];
}
export function pieces(p: Parameters, state: string): Piece[] {
  if (jaynesHinged(p)) return hingedJaynes(p, state);
  if (p.mechanism === 'jaynes-v3' || p.mechanism === 'jaynes-v4') {
    const v3 = p.mechanism === 'jaynes-v3';
    return pieces({ ...p, mechanism: v3 ? 'spiral' : 'geared-petal' }, state).map((piece) => ({
      ...piece,
      label: `Jaynes ${v3 ? 'V3' : 'V4'} · ${piece.label}`,
      shape: transform(rotate(piece.shape, 180, 'x'), 0, [0, 0, +p.height]),
    }));
  }
  const m = layout(p),
    d = m.deck,
    h = +p.height;
  const steel = 0xa6afb9,
    alloy = 0xc9d0d7,
    dark = 0x303640,
    brass = 0xc69445,
    blue = 0x386eb0;
  const result: Piece[] = [];
  const guideFeet: Shape[] = [];
  const bodyX = -m.servoLength + m.servoWidth / 2;
  const mountX = [bodyX - 3, bodyX + m.servoLength + 3];
  const add = (label: string, shape: Shape, color = alloy) => result.push({ label, shape, color });
  const phases = mechanismPhases(p);
  const posts = phases.map(
    (a) =>
      [
        m.postRadius * Math.cos((a + 180 / phases.length) * rad),
        m.postRadius * Math.sin((a + 180 / phases.length) * rad),
      ] as Point,
  );
  const postHoles = posts.map(([x, y]) => circle(1.6, x, y, 32));
  const shellCuts = phases.map((a, i) =>
    transform(
      p.mechanism === 'geared-petal'
        ? plate(
            [
              [0, 0],
              ...Array.from({ length: 31 }, (_, j) => {
                const t = (-25 + (85 * j) / 30) * rad;
                return [+p.tubeOD * Math.cos(t), +p.tubeOD * Math.sin(t)] as Point;
              }),
            ],
            [],
            d + 12.7,
            3.8,
          )
        : box(
            [+p.tubeOD, +p.bladeWidth + 0.8, 2.8],
            [0, -(+p.bladeWidth + 0.8) / 2, d + 10.4 + layer(p, i)],
          ),
      a,
    ),
  );
  if (state === 'assembled' || state === 'cutaway') {
    let tube = subtract(ring(+p.tubeOD / 2, +p.tubeID / 2, 0, h), ...shellCuts);
    if (state === 'cutaway')
      tube = subtract(tube, box([+p.tubeOD, +p.tubeOD, h + 2], [0, -+p.tubeOD, -1]));
    add('Slotted body tube', tube, 0x737e8b);
  }
  if (state !== 'mechanism') {
    add('Lower bulkhead', plate(circle(m.radius), postHoles, 0, 3));
    if (state !== 'cutaway') add('Upper bulkhead', plate(circle(m.radius), postHoles, h - 3, 3));
    for (const [i, [x, y]] of posts.entries()) {
      add(`Frame standoff ${i + 1}`, ring(2.5, 1.5, 3, h - 6, x, y), steel);
      for (const [j, z] of [0, h - 3].entries())
        add(`Bulkhead fastener ${i + 1}.${j + 1}`, cylinder(1.5, 3, [x, y, z]), dark);
    }
  }
  add(
    'Guide support plate',
    plate(
      circle(m.radius),
      [
        circle(5.05),
        ...posts.map(([x, y]) => circle(2.6, x, y, 32)),
        ...mountX.map((x) => circle(1.6, x, 0, 32)),
      ],
      d,
      3,
    ),
  );
  if (state !== 'mechanism')
    for (const [i, [x, y]] of posts.entries()) {
      add(`Deck lower collar ${i + 1}`, ring(3.5, 2.55, d - 1, 1, x, y), dark);
      add(`Deck upper collar ${i + 1}`, ring(3.5, 2.55, d + 3, 1, x, y), dark);
    }
  add(
    'Servo body (installation reference)',
    box([m.servoLength, m.servoWidth, m.servoHeight], [bodyX, -m.servoWidth / 2, 6]),
    dark,
  );
  for (const [i, x] of mountX.entries()) {
    add(
      `Servo mounting ear ${i + 1}`,
      subtract(
        box([6, m.servoWidth, 2], [x - 3, -m.servoWidth / 2, d - 5]),
        cylinder(1.6, 4, [x, 0, d - 6]),
      ),
      dark,
    );
    add(
      `Servo bracket ${i + 1}`,
      subtract(
        box([6, m.servoWidth, 3], [x - 3, -m.servoWidth / 2, d - 3]),
        cylinder(1.6, 5, [x, 0, d - 4]),
        ...posts.map(([px, py]) => cylinder(3.6, 5, [px, py, d - 4])),
      ),
      alloy,
    );
    add(
      `Servo mount screw ${i + 1}`,
      union(cylinder(1.5, 8, [x, 0, d - 5]), cylinder(2.6, 1.5, [x, 0, d - 6.5])),
      steel,
    );
  }
  add('Servo output boss', cylinder(4, 3, [0, 0, d - 3]), dark);
  add('8 mm drive shaft', cylinder(4, 12.8, [0, 0, d]), steel);
  add('8 × 10 × 5 bronze support sleeve', ring(5, 4.05, d, 5), brass);
  const hex = circle(4 / Math.cos(Math.PI / 6), 0, 0, 6);
  const cam = plate(
    circle(m.camRadius),
    [circle(4.08 / Math.cos(Math.PI / 6), 0, 0, 6), ...phases.map((a) => slotOutline(p, a))],
    d + 13.1,
    3,
  );
  if (p.mechanism === 'spiral') add('Three-slot spiral cam', transform(cam, m.angle), blue);
  if (p.mechanism === 'sculpted-cam')
    add(
      'Sculpted cam with tangential endpoints',
      transform(sculptedCam(p, d, slotOutline), m.angle),
      blue,
    );
  add(
    'Hex drive adaptor',
    transform(union(cylinder(5.5, 0.3, [0, 0, d + 12.8]), plate(hex, [], d + 13.1, 3)), m.angle),
    steel,
  );
  add('Cam retaining cap', cylinder(5, 1, [0, 0, d + 16.1]), dark);
  for (const [i, a] of phases.entries()) {
    if (p.mechanism === 'geared-petal') continue;
    const radial = (label: string, shape: Shape, color = alloy) =>
      add(`${label} ${i + 1}`, transform(shape, a, [0, 0, layer(p, i)]), color);
    const moving = (label: string, shape: Shape, color = alloy) =>
      radial(label, transform(shape, 0, [m.travel, 0, 0]), color);
    if (!paired(p))
      for (const [j, y] of [-5, 5].entries()) {
        radial(
          `Ø3 guide rod ${j + 1}`,
          cylinder(1.5, m.railEnd - m.railStart, [m.railStart, y, d + 7], 'x'),
          steel,
        );
        for (const x of [m.railStart, m.railEnd - 3])
          guideFeet.push(
            transform(
              subtract(
                box([3, 5, 7], [x, y - 2.5, d + 3]),
                cylinder(1.5, 5, [x - 1, y, d + 7], 'x'),
              ),
              a,
            ),
          );
      }
    if (paired(p)) radial('Resin guide tray', tray(m, d), 0x505c66);
    const carriage = subtract(
      box([10, 14, 6.8], [m.followerStart - 5, -7, d + 4]),
      ...(!paired(p)
        ? [-5, 5].map((y) => cylinder(1.6, 12, [m.followerStart - 6, y, d + 7], 'x'))
        : []),
      cylinder(1.5, 9, [m.followerStart, 0, d + 3]),
      ...[-3.5, 3.5].map((x) => cylinder(1, 9, [m.followerStart + x, 0, d + 3])),
    );
    moving('Radial carriage', carriage, 0x527d57);
    const tipRadius = +p.tubeOD / 2 - 0.2,
      halfWidth = +p.bladeWidth / 2,
      angle = Math.asin(halfWidth / tipRadius);
    const outline: Point[] = [
      [m.followerStart - 6, -halfWidth],
      ...Array.from({ length: 33 }, (_, j) => {
        const t = -angle + (2 * angle * j) / 32;
        return [tipRadius * Math.cos(t), tipRadius * Math.sin(t)] as Point;
      }),
      [m.followerStart - 6, halfWidth],
    ];
    let blade = plate(
      outline,
      [
        circle(1.55, m.followerStart, 0, 32),
        ...[-3.5, 3.5].map((x) => circle(1.05, m.followerStart + x, 0, 24)),
      ],
      d + 10.8,
      2,
    );
    blade = subtract(
      blade,
      ...[-3.5, 3.5].map((x) => cylinder(1.8, 1.2, [m.followerStart + x, 0, d + 11.6])),
    );
    moving('Curved airbrake blade', blade, 0xe4e8ed);
    for (const [j, x] of [-3.5, 3.5].entries())
      moving(
        `Blade screw M2 ${j + 1}`,
        union(
          cylinder(1, 7.6, [m.followerStart + x, 0, d + 4]),
          cylinder(1.75, 1.1, [m.followerStart + x, 0, d + 11.6]),
        ),
        steel,
      );
    if (p.mechanism === 'rack-pinion') continue;
    moving('Follower shoulder pin M3', cylinder(1.5, 10, [m.followerStart, 0, d + 9]), steel);
    moving('Follower spacer', ring(2.2, 1.55, d + 12.8, 0.3, m.followerStart), brass);
    moving(
      linked(p) ? 'Link pivot bushing · 3 × 5' : '683ZZ follower bearing · 3 × 7 × 3',
      ring(linked(p) ? 2.5 : 3.5, 1.55, d + 13.1, linked(p) ? 2.2 : 3, m.followerStart),
      steel,
    );
    moving('Follower washer', ring(2.5, 1.55, d + 16.2, 0.8, m.followerStart), steel);
    moving(
      'Follower hex nut M3',
      plate(
        circle(2.75 / Math.cos(Math.PI / 6), m.followerStart, 0, 6),
        [circle(1.55, m.followerStart, 0, 32)],
        d + 17,
        2,
      ),
      dark,
    );
  }
  if (linked(p)) alternativeDrive(p, m, result);
  if (p.mechanism === 'rack-pinion') rackDrive(p, m, result);
  if (p.mechanism === 'geared-petal') gearedPetals(p, m, result);
  // Rod seats are integral bosses of the fixed deck, not unfastened floating blocks.
  const deck = result.find((piece) => piece.label === 'Guide support plate')!;
  deck.shape = union(deck.shape, ...guideFeet);
  return result;
}
