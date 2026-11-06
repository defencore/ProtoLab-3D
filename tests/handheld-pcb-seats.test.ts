import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Mesh, Vector3 } from 'three';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { pieces as modulePieces } from '../src/parts/lora-module/lib/model';
import { defaults } from '../src/parts/handheld-lora-controller/configurator';
import presets from '../src/parts/handheld-lora-controller/presets.json';
import { board, boardClamps } from '../src/parts/handheld-lora-controller/lib/layout';
import {
  boardBaseSupports,
  boardSeats,
} from '../src/parts/handheld-lora-controller/lib/board-supports';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import { B, move, subtract, union } from '../src/parts/handheld-lora-controller/lib/shapes';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Upper PCB seat regression', 0xffffff);
  try {
    let result = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute('position'),
        index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.clone().cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}
const overlap = (first: Shape, second: Shape) => volume(first) - volume(subtract(first, second));
function filled(witness: Shape, material: Shape, label: string): void {
  const missing = volume(witness) - volume({ kind: 'intersect', children: [witness, material] });
  assert.ok(missing < 1e-4, `${label}: ${missing} mm³ of required material is absent`);
}
const canonical = modulePieces({ model: 'heltec-wifi-lora32-v4' }, 'assembled');
const placed = (shape: Shape): Shape => move(shape, [board.x, board.y, board.z]);
const moduleShape: Shape = union(...canonical.map((piece) => placed(piece.shape)));
const pcb: Shape = placed(canonical.find((piece) => piece.label.startsWith('PCB —'))!.shape);
const seats = boardBaseSupports();
const surfaces = new Map<Shape, Shape>();
function evaluatedSurface(shape: Shape): Shape {
  const cached = surfaces.get(shape);
  if (cached) return cached;
  const model = manifoldBoundaryComponent(shape, 'Actual evaluated fit fixture', 0xffffff),
    boundaries: Shape[] = [];
  try {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position'),
        index = object.geometry.index;
      boundaries.push({
        kind: 'boundary',
        points: Array.from({ length: position.count }, (_, i): Vec =>
          new Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).toArray(),
        ),
        faces: Array.from({ length: (index?.count ?? position.count) / 3 }, (_, i) =>
          [0, 1, 2].map((j) => (index ? index.getX(3 * i + j) : 3 * i + j)),
        ),
      });
    });
  } finally {
    disposeModel(model);
  }
  const result = boundaries.length === 1 ? boundaries[0] : union(...boundaries);
  surfaces.set(shape, result);
  return result;
}

function productionSeats(p: Parameters): Shape {
  const base = details(p).find((detail) => detail.id === 'base')!.shape;
  assert.equal(base.kind, 'subtract');
  if (base.kind !== 'subtract') throw new Error('Production base is missing its final cutters');
  // The new upper saddle material is evaluated through every real base cutter.
  // Its lowest point is above the underside rounding, so that envelope cannot trim it.
  return subtract(seats, ...base.children.slice(1));
}
function ledgeWitnesses() {
  return [
    ...boardSeats.side.sites.map(({ x, y }) => ({
      label: `Side ledge ${x},${y}`,
      shape: B(4.4, 5.8, 3.3, Math.sign(x) * 14.3, y, 17.1),
    })),
    ...[-1, 1].map((sign) => ({
      label: `Rear ledge ${sign}`,
      shape: B(7, 3.8, 3.3, sign * 13, boardSeats.rear.centerY, 17.1),
    })),
  ];
}

const lidShapes = [
  ...new Map(
    presets.map((preset) => {
      const parameters = { ...defaults, ...preset.parameters };
      const shape = details(parameters).find((detail) => detail.id === 'lid')!.shape;
      return [JSON.stringify(shape), { id: preset.id, shape, parameters }] as const;
    }),
  ).values(),
];

test('All six PCB shelves retain a solid 3.3 mm finite bearing thickness across their full width', () => {
  for (const { label, shape } of ledgeWitnesses()) filled(shape, seats, label);
});

test('Side and rear shelf haunches contain continuous concave circular roots rather than thin overhangs', () => {
  for (const [inner, radius, width, y, label] of [
    ...boardSeats.side.sites.map(({ y }) => [12, 1.5, 5.8, y, 'side'] as const),
    [9.4, 4.1, 3.8, boardSeats.rear.centerY, 'rear'] as const,
  ])
    for (const sign of [-1, 1]) {
      const surfaceX = inner + radius / Math.SQRT2,
        surfaceZ = 17 - radius + radius / Math.SQRT2;
      filled(
        B(0.1, width, 0.1, sign * (surfaceX + 0.12), y, surfaceZ + 0.07),
        seats,
        `${label} ${sign} complete fillet root`,
      );
      assert.ok(
        overlap(B(0.1, width, 0.1, sign * (surfaceX - 0.12), y, surfaceZ - 0.17), seats) < 1e-4,
        `${label} ${sign}: preserve the actual concave root clearance`,
      );
    }
});

test('PCB locators have broad joined roots and rounded outward insertion edges', () => {
  for (const { x, y } of boardSeats.side.sites) {
    const sign = Math.sign(x);
    filled(B(2.8, 5.8, 1.3, sign * 15.1, y, 20.6), seats, `Broad side locator ${x},${y}`);
    const cx = 13.7,
      cz = 21.5,
      r = 0.5 / Math.SQRT2;
    filled(
      B(0.06, 5.8, 0.06, sign * (cx - r + 0.09), y, cz + r - 0.12),
      seats,
      `Rounded side lead-in ${x},${y}`,
    );
    assert.ok(
      overlap(B(0.06, 5.8, 0.06, sign * (cx - r - 0.09), y, cz + r + 0.06), seats) < 1e-4,
      `The side insertion edge ${x},${y} must round away from the PCB`,
    );
  }
  for (const sign of [-1, 1]) {
    filled(
      B(2.8, 2.2, 1.5, sign * 10.8, boardSeats.rear.stopFaceY - 1.2, 20.55),
      seats,
      `Thick rear stop ${sign}`,
    );
    filled(
      B(2.8, 1.8, 1, sign * 10.8, boardSeats.rear.stopFaceY - 1.2, 20),
      seats,
      `Rear stop ${sign} joins its shelf across a finite root`,
    );
  }
});

test('Every finished enclosure preserves the thicker shelf and locator material after its real cutouts', () => {
  for (const preset of presets) {
    const finished = productionSeats({ ...defaults, ...preset.parameters });
    for (const { label, shape } of ledgeWitnesses()) {
      if (preset.parameters.bodyModel === 'web-grip' && label === 'Side ledge -12.2,17.3') {
        // The lid-owned endcap relieves only the outboard heel of this seat.
        // Protect both the useful PCB bearing and the full-height inner root.
        filled(
          B(0.5, 5.8, 3.3, -12.35, 17.3, 17.1),
          finished,
          `${preset.id}: complete PCB bearing thickness`,
        );
        filled(
          B(0.7, 5.8, 3.3, -13.15, 17.3, 17.1),
          finished,
          `${preset.id}: complete inner root thickness`,
        );
      } else if (preset.parameters.bodyModel === 'web-grip' && label === 'Rear ledge -1') {
        filled(
          B(3.1, 3.8, 3.3, -11.05, boardSeats.rear.centerY, 17.1),
          finished,
          `${preset.id}: complete rear PCB bearing thickness`,
        );
        filled(
          B(0.7, 3.8, 3.3, -13.15, boardSeats.rear.centerY, 17.1),
          finished,
          `${preset.id}: complete rear inner root thickness`,
        );
      } else filled(shape, finished, `${preset.id}: ${label}`);
    }
    for (const { x, y } of boardSeats.side.sites) {
      if (preset.parameters.bodyModel === 'web-grip' && x < 0 && y === 17.3) {
        filled(
          B(2.5, 5.8, 0.8, -14.5, y, 20.6),
          finished,
          `${preset.id}: retained 2.5 mm guide root`,
        );
        filled(
          B(2, 5.8, 0.3, -14.75, y, 21.65),
          finished,
          `${preset.id}: retained 2.0 mm rounded guide top`,
        );
        filled(
          B(2.5, 5.8, 0.4, -14.5, y, 20.3),
          finished,
          `${preset.id}: full guide-to-bearing attachment`,
        );
      } else {
        filled(
          B(2.8, 5.8, 1.3, Math.sign(x) * 15.1, y, 20.6),
          finished,
          `${preset.id}: complete broad side locator ${x},${y}`,
        );
        filled(
          B(2.8, 5.8, 0.4, Math.sign(x) * 15.1, y, 20.3),
          finished,
          `${preset.id}: side locator joined to bearing ${x},${y}`,
        );
      }
    }
    for (const sign of [-1, 1])
      filled(
        B(2.8, 1.8, 1, sign * 10.8, boardSeats.rear.stopFaceY - 1.2, 20),
        finished,
        `${preset.id}: rear stop root ${sign}`,
      );
  }
});

test('The actual canonical Heltec module clears the stronger seats throughout vertical insertion', () => {
  for (const lift of [0, 0.2, 0.5, 1, 2, 4, 8, 12, 20]) {
    const hit = overlap(move(evaluatedSurface(moduleShape), [0, 0, lift]), seats);
    assert.ok(
      hit < 1e-4,
      `Canonical Heltec is obstructed by ${hit} mm³ at insertion lift ${lift} mm`,
    );
  }
});

test('The unchanged PCB datum retains four lower bearings and four separate relieved lid contacts', () => {
  const lowered = move(pcb, [0, 0, -0.02]),
    raised = move(pcb, [0, 0, 0.02]);
  for (const { x, y } of boardClamps) {
    const area =
      volume({
        kind: 'intersect',
        children: [lowered, seats, B(2, 6.2, 0.04, x, y, board.pcbBottom - 0.03)],
      }) / 0.02;
    assert.ok(area >= 3, `Lower bearing ${x},${y} only supports ${area} mm² of actual PCB`);
    for (const lid of lidShapes) {
      const upperArea =
        volume({
          kind: 'intersect',
          children: [raised, lid.shape, B(3, 6.2, 0.04, x, y, board.pcbTop - 0.01)],
        }) / 0.02;
      assert.ok(
        upperArea >= 1,
        `${lid.id}: lid foot ${x},${y} only contacts ${upperArea} mm² of actual PCB`,
      );
    }
  }
});

test('Existing lids close around the stronger guides and canonical module without interference', () => {
  for (const lid of lidShapes)
    for (const lift of [0, 0.2, 0.5, 1, 2, 4, 8, 12]) {
      const moving = move(evaluatedSurface(lid.shape), [0, 0, lift]),
        seatHit = overlap(moving, productionSeats(lid.parameters)),
        boardHit = overlap(moving, evaluatedSurface(moduleShape));
      assert.ok(
        seatHit < 1e-4,
        `${lid.id}: lid hits ${seatHit} mm³ of stronger seat at lift ${lift} mm`,
      );
      assert.ok(
        boardHit < 1e-4,
        `${lid.id}: lid hits ${boardHit} mm³ of canonical module at lift ${lift} mm`,
      );
    }
});
