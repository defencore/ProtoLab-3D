import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/electronics/assembly';
import {
  box,
  cylinder,
  prism,
  subtract,
  type Shape,
} from '../../../core/assembly/electronics/shapes';
import modelData from './models.json';

export const models = modelData;
export function selected(p: Parameters) {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Select a supported addressable LED module.');
  return model;
}

// Bake planar component orientation into the same shape tree used by both
// renderers. Assembly bounding boxes then include the actual rotated outline.
function orient(shape: Shape, x: number, y: number, angle: number): Shape {
  if (angle === 0) return shape;
  const rad = (angle * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad);
  const point = ([px, py]: [number, number]): [number, number] => [
    x + (px - x) * c - (py - y) * s,
    y + (px - x) * s + (py - y) * c,
  ];
  switch (shape.kind) {
    case 'box': {
      const [px, py, z] = shape.origin,
        [w, l, h] = shape.size;
      const corners: [number, number][] = [
        [px, py],
        [px + w, py],
        [px + w, py + l],
        [px, py + l],
      ];
      return prism(corners.map(point), h, z);
    }
    case 'prism':
      if (shape.axis !== 'z') throw new Error('LED components use planar XY profiles.');
      return prism(shape.points.map(point), shape.depth, shape.origin);
    case 'cylinder': {
      if (shape.axis !== 'z') throw new Error('LED components use normal Z axes.');
      const xy = point([shape.origin[0], shape.origin[1]]);
      return cylinder(shape.radius, shape.height, [...xy, shape.origin[2]]);
    }
    case 'subtract':
    case 'union':
      return {
        kind: shape.kind,
        children: shape.children.map((child) => orient(child, x, y, angle)),
      };
    default:
      throw new Error('Unsupported LED component orientation.');
  }
}

export function pieces(p: Parameters, state = 'assembled'): Piece[] {
  const m = selected(p),
    out: Piece[] = [],
    bores: Shape[] = [];
  const add = (shape: Shape, label: string, color: number, layer = 0) =>
    out.push({ shape, label, color, z: state === 'exploded' ? layer * 5 : 0 });
  const silver = 0xb6bec5,
    white = 0xf1efe7,
    cream = 0xd9d6b4;
  for (const [x, y, d] of m.holes) bores.push(cylinder(d / 2, m.pcbThickness + 2, [x, y, -1]));

  // Pad locations belong to each fixed supplier execution. Ring lands are
  // surface contacts; the rectangular boards retain their small via bores.
  for (const pad of m.pads) {
    const land = box(
      [pad.width, pad.length, 0.03],
      [pad.x - pad.width / 2, pad.y - pad.length / 2, -0.03],
    );
    if (pad.drill > 0) bores.push(cylinder(pad.drill / 2, m.pcbThickness + 2, [pad.x, pad.y, -1]));
    add(
      pad.drill > 0 ? subtract(land, cylinder(pad.drill / 2, 0.3, [pad.x, pad.y, -0.15])) : land,
      pad.label,
      silver,
    );
  }
  if (m.innerDiameter > 0)
    bores.push(cylinder(m.innerDiameter / 2, m.pcbThickness + 2, [0, 0, -1]));
  const board =
    m.outline === 'ring'
      ? cylinder(m.length / 2, m.pcbThickness, [0, 0, 0])
      : prism(
          [
            [-m.length / 2, -m.width / 2],
            [m.length / 2, -m.width / 2],
            [m.length / 2, m.width / 2],
            [-m.length / 2, m.width / 2],
          ],
          m.pcbThickness,
          0,
        );
  add(subtract(board, ...bores), 'PCB · ' + m.layout, 0x23262b);

  for (const [index, [x, y, angle]] of m.ledPositions.entries()) {
    const n = index + 1;
    const led = (shape: Shape, label: string, color: number) =>
      add(orient(shape, x, y, angle), label, color, 1);
    // Published 5050 package envelope. The clipped corner identifies its orientation.
    const z = 1.66,
      h = 1.5;
    const frame = prism(
      [
        [x - 2.5, y - 2.5],
        [x + 2.05, y - 2.5],
        [x + 2.5, y - 2.05],
        [x + 2.5, y + 2.5],
        [x - 2.5, y + 2.5],
      ],
      h,
      z,
    );
    led(subtract(frame, cylinder(1.85, h, [x, y, z + 0.22])), `LED ${n} · 5050 package`, white);
    led(cylinder(1.85, 1.23, [x, y, z + 0.22]), `LED ${n} · optical window`, cream);
    // Small die/controller silhouettes help distinguish the clear optical windows.
    // Their exact internals are not used as installation interfaces.
    led(
      box([0.48, 0.48, 0.04], [x + 0.28, y - 0.24, 3.11]),
      `LED ${n} · driver silhouette`,
      0x8c8a73,
    );
    for (const [i, dx, dy, color] of [
      [1, -0.25, -0.38, 0xd2b8a1],
      [2, -0.48, 0.25, 0xb5c3ad],
      [3, 0.05, 0.48, 0xb2bbcb],
    ])
      led(box([0.14, 0.14, 0.025], [x + dx, y + dy, 3.11]), `LED ${n} · RGB die ${i}`, color);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        led(
          box([0.55, 0.9, 0.12], [x + sx * 2.55 - 0.275, y + sy * 1.65 - 0.45, 1.6]),
          `LED ${n} · terminal ${sx}/${sy}`,
          silver,
        );
  }

  for (const [i, [x, y, angle]] of m.capacitors.entries()) {
    const passive = (shape: Shape, label: string, color: number) =>
      add(orient(shape, x, y, angle), label, color, 1);
    passive(
      box([0.9, 0.7, 0.6], [x - 0.45, y - 0.35, 1.6]),
      `Capacitor ${i + 1} · ceramic body`,
      0xae9774,
    );
    for (const side of [-1, 1])
      passive(
        box([0.3, 0.8, 0.65], [x + side * 0.6 - 0.15, y - 0.4, 1.6]),
        `Capacitor ${i + 1} · termination ${side}`,
        silver,
      );
  }
  return out;
}
