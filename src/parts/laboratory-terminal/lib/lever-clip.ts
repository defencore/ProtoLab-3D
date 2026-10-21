import type { Piece } from '../../../core/assembly/mechanical/assembly';
import type { Shape, Vec } from '../../../core/assembly/mechanical/shapes';
import { cylinder, prism, roundedRect } from '../../../core/assembly/mechanical/shapes';
import { B, C, cut, move, rotate, union } from '../../../core/assembly/mechanical/helpers';

interface LeverClipModel {
  poles: number;
  clipSize?: 'compact' | 'large';
  clipBase?: boolean;
  clipTermination?: 'rear-tab' | 'bottom-tab' | 'bottom-m4';
  color: number;
  designation: string;
}

type Point = [number, number];
const brass = 0xc6a249;
const steel = 0xb6bdc1;
const bankColors = [0xc6332e, 0x292c31, 0xedece0, 0xe8c32d, 0x385da0, 0x80534a];

/** A small molded edge radius, reconstructed from the supplied product photographs. */
function softened(points: Point[], radius: number, cornerRadii: number[] = []): Point[] {
  return points.flatMap((point, i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const edgeRadius = cornerRadii[i] ?? radius;
    const a = Math.min(edgeRadius, Math.hypot(previous[0] - point[0], previous[1] - point[1]) / 3);
    const b = Math.min(edgeRadius, Math.hypot(next[0] - point[0], next[1] - point[1]) / 3);
    const previousLength = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
    const nextLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const entry = point.map((v, axis) => v + ((previous[axis] - v) * a) / previousLength);
    const exit = point.map((v, axis) => v + ((next[axis] - v) * b) / nextLength);
    return Array.from({ length: 5 }, (_, j) => {
      const t = j / 4;
      return [0, 1].map(
        (axis) => (1 - t) ** 2 * entry[axis] + 2 * (1 - t) * t * point[axis] + t ** 2 * exit[axis],
      ) as Point;
    });
  });
}

/** Extrude a Y/Z side profile across X. */
function side(profile: Point[], width: number, x = 0): Shape {
  return move(rotate(prism(profile, width, -width / 2, 'y'), 0, 0, 90), x);
}

function crossPin(diameter: number, width: number, y: number, z: number): Shape {
  return cylinder(diameter / 2, width, [-width / 2, y, z], 'x');
}

function slot(width: number, length: number, y: number, height: number, z = -1): Shape {
  return union(
    B(width, length - width, height, 0, y, z),
    C(width, height, z, 0, y - (length - width) / 2),
    C(width, height, z, 0, y + (length - width) / 2),
  );
}

/** One connected molding with a wide finger paddle tapering into the narrow pivot neck. */
function leverMolding(
  profile: Point[],
  neckWidth: number,
  paddleWidth: number,
  transition: number,
): Shape {
  const rounded = softened(profile, 0.6);
  const start = Math.min(...rounded.map(([y]) => y));
  const stations = [
    ...new Set([...rounded.map(([y]) => y), transition, transition + 4, start + 1.2]),
  ].sort((a, b) => a - b);
  const rings: Vec[][] = stations.map((y) => {
    const intersections = rounded.flatMap(([a, az], i) => {
      const [b, bz] = rounded[(i + 1) % rounded.length];
      if (y < Math.min(a, b) - 1e-8 || y > Math.max(a, b) + 1e-8) return [];
      if (Math.abs(a - b) < 1e-8) return [az, bz];
      const t = (y - a) / (b - a);
      return [az + t * (bz - az)];
    });
    const lower = Math.min(...intersections);
    const upper = Math.max(...intersections);
    const wide = paddleWidth;
    const blend = Math.max(0, Math.min(1, (y - transition) / 4));
    const half = (wide * (1 - blend) + neckWidth * blend) / 2;
    return [
      [-half, y, lower],
      [half, y, lower],
      [half, y, upper],
      [-half, y, upper],
    ];
  });
  return { kind: 'loft', rings };
}

/** A single closed tube following a helix; the spring is not a stack of separate rings. */
function spring(y: number, bottom: number, top: number, radius: number, wire: number): Shape {
  const turns = 7;
  const segments = turns * 20;
  const pitchPerRadian = (top - bottom) / (turns * Math.PI * 2);
  const tangentLength = Math.hypot(radius, pitchPerRadian);
  const rings: Vec[][] = Array.from({ length: segments + 1 }, (_, index) => {
    const t = (index / segments) * turns * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const center: Vec = [radius * cos, y + radius * sin, bottom + pitchPerRadian * t];
    const radial: Vec = [cos, sin, 0];
    const second: Vec = [
      (-pitchPerRadian * sin) / tangentLength,
      (pitchPerRadian * cos) / tangentLength,
      -radius / tangentLength,
    ];
    return Array.from({ length: 8 }, (_, j) => {
      const angle = (j * Math.PI * 2) / 8;
      return center.map(
        (value, axis) =>
          value + wire * (Math.cos(angle) * radial[axis] + Math.sin(angle) * second[axis]),
      ) as Vec;
    });
  });
  return { kind: 'loft', rings };
}

/** Purchased lever clips; only the dimensions called out by the supplier are constrained. */
export function leverClipPieces(m: LeverClipModel): Piece[] {
  const out: Piece[] = [];
  const large = m.clipSize === 'large';
  const bottomTab = !large && m.clipTermination === 'bottom-tab';
  const paddleRise = bottomTab ? 1.8 : 0;
  const width = large ? 21.6 : 18;
  const length = large ? 101.3 : 55;
  const height = large ? 52.7 : bottomTab ? 35 : 34.8;
  const baseThickness = large ? 5.5 : 10;
  const cheekThickness = large ? 2.6 : 2;
  const rear = large ? 36.8 : 27.5;
  const pivotY = large ? 8 : 7;
  const pivotZ = large ? 31.5 : 21.7;
  const pinDiameter = large ? 3.8 : 3;
  const jawY = large ? 27.5 : 19.5;
  const jawDiameter = large ? 4.2 : 3.4;
  const jawWidth = large ? 12 : 11.8;
  const fixedJawZ = large ? 45.5 : 29;
  const movingJawZ = fixedJawZ + jawDiameter + 0.2;
  const springY = large ? -27 : -15;
  const offsetZ = m.clipBase ? 3 : 0;
  const centers = Array.from({ length: m.poles }, (_, i) => (i - (m.poles - 1) / 2) * 18);
  const add = (label: string, shape: Shape, color: number, x = 0) =>
    out.push({ label, shape: move(shape, x, 0, offsetZ), color });

  if (m.clipBase) {
    // This insulating bank plate is a photo reconstruction, not a supplier mounting drawing.
    const mountHoles = [-59, 59].flatMap((x) => [-25, 25].map((y) => C(4.5, 5, -1, x, y)));
    const clipHoles = centers.flatMap((x) =>
      bottomTab
        ? [move(slot(3.2, 4.8, -21, 5), x), ...[-4.8, 4.8].map((dx) => C(3.2, 5, -1, x + dx, 3))]
        : [-21, -7.5].map((y) => move(slot(3.2, 4.8, y, 5), x)),
    );
    const contactSlots = bottomTab ? centers.map((x) => B(8, 3, 5, x, 20.8, -1)) : [];
    out.push({
      label: `${m.designation} · common insulating mounting base`,
      shape: cut(roundedRect(132, 65, 3, 0, 3), ...mountHoles, ...clipHoles, ...contactSlots),
      color: 0xd9d8ca,
    });
  }

  centers.forEach((x, index) => {
    const label = `Clip ${index + 1}`;
    const color = m.poles > 1 ? bankColors[index % bankColors.length] : m.color;
    const cheekProfile = softened(
      large
        ? [
            [-41, baseThickness],
            [11, height],
            [rear, height],
            [rear, 0],
            [-length / 2, 0],
            [-length / 2, baseThickness],
          ]
        : [
            [-length / 2, 0],
            [rear, 0],
            [rear, height],
            [0, height],
            [0, baseThickness],
            [-length / 2, baseThickness],
          ],
      large ? 2 : 1.5,
      large ? [] : [1.5, 1.5, 1.5, 2.5, 1.5, 1.5],
    );
    const cheekX = (width - cheekThickness) / 2;
    let housing = union(
      roundedRect(width, length, large ? 2.4 : 1.5, 0, baseThickness),
      side(cheekProfile, cheekThickness, -cheekX),
      side(cheekProfile, cheekThickness, cheekX),
      B(width - 0.2, large ? 2.6 : 2.0, height - 1.1, 0, rear - (large ? 1.3 : 1), 0),
      C(large ? 6.2 : 5.0, 2.0, baseThickness - 0.1, 0, springY),
      C(large ? 11.6 : 9.0, 1.1, baseThickness - 0.1, 0, springY),
    );
    housing = cut(housing, crossPin(pinDiameter + 0.3, width + 2, pivotY, pivotZ));

    if (large) {
      housing = cut(
        housing,
        B(17.6, 23, 4.5, 0, -25.5, -1),
        B(17.6, 28, 4.5, 0, 2, -1),
        ...[-43, 43].map((y) => C(4.8, baseThickness + 2, -1, 0, y)),
        B(12.4, 8.4, 6.2, 0, 27.5, -0.5),
        B(8.4, 2.4, fixedJawZ - 1.4, 0, 29, 2),
      );
    } else {
      const undersideCells: Shape[] = [
        B(14.4, 15.5, 8.5, 0, -17.75, -1),
        B(6.2, 14.5, 8.5, -4.1, -0.75, -1),
        B(6.2, 14.5, 8.5, 4.1, -0.75, -1),
        B(14.4, 17, 8.5, 0, 17, -1),
      ];
      const mountingBosses = bottomTab
        ? [slot(7.2, 9.6, -21, 12, -1), ...[-4.8, 4.8].map((dx) => C(6.4, 12, -1, dx, 3))]
        : [-21, -7.5].map((y) => slot(7.2, 9.6, y, 12, -1));
      // Cored cells leave a continuous 2.5 mm top deck and the mounting bosses joined to it.
      housing = cut(housing, cut(union(...undersideCells), ...mountingBosses));
      housing = cut(housing, B(11.8, 3.4, height - 30, 0, rear - 0.9, 27));
      // Three locating pins enter blind sockets in the next modular clip.
      housing = union(
        housing,
        ...[
          [-23, 5],
          [13.5, 6],
          [13, 30],
        ].map(([y, z]) => cylinder(0.85, 0.65, [width / 2 - 0.2, y, z], 'x')),
      );
      housing = cut(
        housing,
        ...(bottomTab
          ? [
              slot(3.2, 4.8, -21, baseThickness + 2),
              ...[-4.8, 4.8].map((dx) => C(3.2, baseThickness + 2, -1, dx, 3)),
            ]
          : [-21, -7.5].map((y) => slot(3.2, 4.8, y, baseThickness + 2))),
        ...[
          [-23, 5],
          [13.5, 6],
          [13, 30],
        ].map(([y, z]) => cylinder(1.0, 1.3, [-width / 2 - 0.1, y, z], 'x')),
        ...(bottomTab
          ? [B(7.6, 2.4, fixedJawZ + 2, 0, 20.8, -1)]
          : [B(7.5, 2.5, 20, 0, 20.8, 9.8), B(7.5, 14.5, 1.7, 0, 27.3, 9.95)]),
      );
    }
    add(`${label} · molded housing`, housing, color, x);

    const leverProfile: Point[] = large
      ? [
          [-49.5, 52.4],
          [-48.8, 53.05],
          [-10, 42.4],
          [1, 37.9],
          [8, 35.9],
          [20, 47.5],
          [25, 53.3],
          [32.5, 53.3],
          [32.5, 49.3],
          [21, 40.1],
          [9, 27.9],
          [3, 28.8],
          [-4, 34.8],
          [-11, 37.5],
          [-49.5, 48.6],
        ]
      : [
          [-27.5, 37.8 + paddleRise],
          [-27, 38.65 + paddleRise],
          [-5, 33.8 + paddleRise],
          [1.5, 27.3],
          [7, 25.4],
          [14, 31.2],
          [18, 35.4],
          [24, 35.4],
          [24, 32],
          [17, 28],
          [8, 18.3],
          [3.4, 19.2],
          [-2.5, 25.9],
          [-7, 29.2],
          [-27.5, 34.3],
        ];
    const leverWidth = width - cheekThickness * 2 - 0.6;
    let lever = leverMolding(leverProfile, leverWidth, width - 1.5, large ? -11 : -7);
    const ridgeCount = large ? 16 : 11;
    const firstY = large ? -48.2 : -25.2;
    const slope = large ? (42.4 - 53.05) / 38.8 : (33.8 - 38.65) / 22;
    const ridgeHeight = 1.15;
    const angle = (Math.atan(slope) * 180) / Math.PI;
    const firstTop = large ? 53.9 : bottomTab ? 41 : 39.2;
    const ridgeDepth = large ? 0.8 : 0.7;
    const step = large ? 2.25 : 1.75;
    for (let i = 0; i < ridgeCount; i++) {
      const y = firstY + i * step;
      const top = firstTop + slope * (y - firstY);
      const localTop =
        ridgeHeight * Math.cos((angle * Math.PI) / 180) +
        (ridgeDepth / 2) * Math.abs(Math.sin((angle * Math.PI) / 180));
      lever = union(
        lever,
        move(rotate(B(width - 1.7, ridgeDepth, ridgeHeight), angle), 0, y, top - localTop),
      );
    }
    lever = cut(
      lever,
      crossPin(pinDiameter + 0.25, width + 2, pivotY, pivotZ),
      crossPin(jawDiameter + 0.2, width + 2, jawY, movingJawZ),
      B(width + 2, jawDiameter + 0.4, 12, 0, jawY, movingJawZ - 12),
      B(jawWidth - 1.6, jawDiameter + 3, height + 5, 0, jawY, fixedJawZ - 2),
    );
    add(`${label} · ridged pivot lever`, lever, color, x);

    let conductor: Shape;
    if (large) {
      conductor = cut(
        union(
          crossPin(jawDiameter, jawWidth, jawY, fixedJawZ),
          B(8, 1.8, fixedJawZ - 0.6, 0, 29, 2),
          B(12, 8, 4.4, 0, 27.5, 0.8),
        ),
        C(4, 5.5, -0.1, 0, 27),
      );
    } else if (bottomTab) {
      conductor = cut(
        union(crossPin(jawDiameter, jawWidth, jawY, fixedJawZ), B(7, 1.6, 43.1, 0, 20.8, -14)),
        cylinder(2, 4, [0, 18.8, -9], 'y'),
      );
    } else {
      conductor = cut(
        union(
          crossPin(jawDiameter, jawWidth, jawY, fixedJawZ),
          B(7, 1.6, 18.4, 0, 20.8, 10.7),
          B(7, 14, 1.2, 0, 27.3, 10.2),
        ),
        C(4, 3, 9.5, 0, 31.3),
      );
    }
    add(
      `${label} · fixed contact and ${large ? 'M4 termination' : bottomTab ? 'downward solder tab' : 'solder tag'}`,
      conductor,
      brass,
      x,
    );
    add(`${label} · moving brass jaw`, crossPin(jawDiameter, jawWidth, jawY, movingJawZ), brass, x);
    add(`${label} · steel pivot pin`, crossPin(pinDiameter, width - 0.3, pivotY, pivotZ), steel, x);
    add(
      `${label} · compression spring`,
      large ? spring(springY, 7.15, 41.5, 4.55, 0.55) : spring(springY, 11.65, 30.75, 3.6, 0.43),
      steel,
      x,
    );
  });
  return out;
}
