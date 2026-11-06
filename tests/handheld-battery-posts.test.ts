import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Mesh, Vector3 } from 'three';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import part from '../src/parts/handheld-lora-controller/part';
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';
import { pieces as modulePieces } from '../src/parts/lora-module/lib/model';
import { details, screwMountCutouts } from '../src/parts/handheld-lora-controller/lib/details';
import { batteryPostSupports } from '../src/parts/handheld-lora-controller/lib/battery-supports';
import { baseReinforcement } from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { roundedFloorEnvelope } from '../src/parts/handheld-lora-controller/lib/grip';
import {
  batteryBridge,
  batteryMount,
  batteryScrews,
  board,
  layout,
} from '../src/parts/handheld-lora-controller/lib/layout';
import { B, C, move, subtract, union } from '../src/parts/handheld-lora-controller/lib/shapes';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Battery tower failure regression', 0xffffff);
  try {
    let sum = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute('position'),
        index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
        );
        sum += a.dot(b.clone().cross(c)) / 6;
      }
    });
    return sum;
  } finally {
    disposeModel(model);
  }
}
const overlap = (a: Shape, b: Shape) => volume(a) - volume(subtract(a, b));
function filled(shape: Shape, stock: Shape, label: string): void {
  const absent = volume(shape) - volume({ kind: 'intersect', children: [shape, stock] });
  assert.ok(absent < 1e-4, `${label}: ${absent} mm³ of required material is absent`);
}
function boundary(model: ReturnType<typeof componentGeometry>): Shape {
  const shapes: Shape[] = [];
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const p = object.geometry.getAttribute('position'),
      index = object.geometry.index;
    shapes.push({
      kind: 'boundary',
      points: Array.from({ length: p.count }, (_, i): Vec =>
        new Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld).toArray(),
      ),
      faces: Array.from({ length: (index?.count ?? p.count) / 3 }, (_, i) =>
        [0, 1, 2].map((j) => (index ? index.getX(3 * i + j) : 3 * i + j)),
      ),
    });
  });
  return shapes.length === 1 ? shapes[0] : union(...shapes);
}
const prepared = new Map<string, Shape>();
function evaluated(shape: Shape): Shape {
  const key = JSON.stringify(shape),
    cached = prepared.get(key);
  if (cached) return cached;
  const model = manifoldBoundaryComponent(shape, 'Finished battery support fixture', 0xffffff);
  try {
    const result = boundary(model);
    prepared.set(key, result);
    return result;
  } finally {
    disposeModel(model);
  }
}
function productionStock(p: Parameters, ties = false): Shape {
  const base = details(p).find((item) => item.id === 'base')!.shape;
  assert.equal(base.kind, 'subtract');
  if (base.kind !== 'subtract') throw new Error('The final production cutters are unavailable');
  return evaluated(
    subtract(
      {
        kind: 'intersect',
        children: [
          ties ? union(batteryPostSupports(), baseReinforcement()) : batteryPostSupports(),
          roundedFloorEnvelope(p),
        ],
      },
      ...base.children.slice(1),
    ),
  );
}
const cases = part.presets.map((preset) => ({
  id: preset.id,
  p: { ...part.defaults, ...preset.parameters },
}));
const commonStock = () => evaluated(subtract(batteryPostSupports(), ...screwMountCutouts()));

test('Every finished battery tower keeps broad nut-side rails, entry cheeks and a closed back wall', () => {
  for (const { id, p } of cases) {
    const stock = productionStock(p);
    for (const [x, y] of batteryScrews) {
      const sign = Math.sign(x);
      for (const side of [-1, 1]) {
        filled(
          B(4.6, 2.2, 2, sign * 9, y + side * 3.75, 9.3),
          stock,
          `${id}: 2.2 mm core rail ${x}/${side}`,
        );
        filled(
          B(0.5, 2, 2, sign * 6.05, y + side * 3.9, 9.3),
          stock,
          `${id}: 2.0 mm entry cheek ${x}/${side}`,
        );
      }
      filled(B(2.2, 3, 2, sign * 14, y, 9.3), stock, `${id}: 2.2 mm closed back ${x}`);
    }
  }
});

test('The screw load bears on an uninterrupted two millimetre roof above each nut pocket', () => {
  for (const { id, p } of cases) {
    const stock = productionStock(p);
    for (const [x, y] of batteryScrews) {
      // Independently protect a complete loaded annulus over the clearance pocket.
      const ring = subtract(C(5.6, 1.99998, 11.40001, x, y), C(2.3, 2.1, 11.35, x, y));
      filled(ring, stock, `${id}: complete 2 mm roof ${x}`);
      for (const side of [-1, 1])
        filled(
          B(4.6, 2.2, 1.99998, Math.sign(x) * 9, y + side * 3.75, 11.40001),
          stock,
          `${id}: rail-to-roof ${x}/${side}`,
        );
    }
  }
});

test('Large circular floor roots and six millimetre wall ties carry the battery towers continuously', () => {
  for (const { id, p } of cases) {
    const stock = productionStock(p, true);
    for (const [x, y] of batteryScrews) {
      const sign = Math.sign(x);
      filled(B(0.3, 3, 0.2, sign * 15.8, y, 2.1), stock, `${id}: enlarged side root ${x}`);
      filled(B(3, 0.3, 0.2, x, y + 5.3, 2.1), stock, `${id}: enlarged USB-side root ${x}`);
      filled(
        B(2.2, 3, 9, sign * 14, y, 3.3),
        stock,
        `${id}: continuous floor-to-roof load path ${x}`,
      );
      filled(B(1.8, 5.8, 1.8, sign * 16.9, y, 4), stock, `${id}: six millimetre wall tie ${x}`);
    }
  }
});

test('Actual M2 nut corners clear the generous side entrance throughout a continuous eight millimetre insertion', () => {
  const pieces = configuredPieces(cases[0].p, 'assembled'),
    stock = commonStock();
  for (const [i, [x, y]] of batteryScrews.entries()) {
    const piece = pieces.find((item) => item.component.id === `battery-nut-${i}`)!;
    assert.ok(piece, 'The canonical purchased nut must be present');
    const model = componentGeometry(libraries, [piece], true),
      points: [number, number][] = [];
    let bottom = Infinity,
      top = -Infinity;
    try {
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const p = object.geometry.getAttribute('position');
        for (let j = 0; j < p.count; j++) {
          const v = new Vector3().fromBufferAttribute(p, j).applyMatrix4(object.matrixWorld);
          bottom = Math.min(bottom, v.z);
          top = Math.max(top, v.z);
          points.push([v.x, v.y], [v.x - Math.sign(x) * 8, v.y]);
        }
      });
    } finally {
      disposeModel(model);
    }
    assert.ok(
      Math.abs(bottom - 9.6) < 1e-6 && Math.abs(top - 11.2) < 1e-6,
      'Keep the original metal nut and screw engagement planes',
    );
    const sorted = [...new Map(points.map((point) => [point.join(','), point])).values()].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1],
    );
    const cross = (a: number[], b: number[], c: number[]) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const hull = [sorted, [...sorted].reverse()].flatMap((order) => {
      const chain: [number, number][] = [];
      for (const point of order) {
        while (
          chain.length > 1 &&
          cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
        )
          chain.pop();
        chain.push(point);
      }
      return chain.slice(0, -1);
    });
    // A filled convex swept envelope encloses all metal poses, including the corners.
    assert.ok(
      overlap(
        { kind: 'prism', points: hull, origin: bottom, depth: top - bottom, axis: 'z' },
        stock,
      ) < 1e-5,
      `Nut ${x},${y} must slide in without spreading the tower`,
    );
  }
});

test('The actual short and long M2 screws clear the new towers while the blind well stays closed', () => {
  const stock = commonStock();
  for (const length of [6, 8, 10]) {
    const pieces = configuredPieces(cases[0].p, 'assembled');
    for (const [i, [x, y]] of batteryScrews.entries()) {
      const original = pieces.find((piece) => piece.component.id === `battery-screw-${i}`)!;
      const screw = {
        ...original,
        component: {
          ...original.component,
          parameters: { ...original.component.parameters, length, threadLength: length },
          placement: {
            ...original.component.placement,
            translation: [x, y, batteryMount.screwSeat - (length - 2) / 2] as Vec,
          },
        },
      };
      const model = componentGeometry(libraries, [screw], true);
      try {
        assert.ok(
          overlap(boundary(model), stock) < 1e-5,
          `Actual M2 × ${length} hits tower ${x},${y}`,
        );
      } finally {
        disposeModel(model);
      }
      assert.ok(
        batteryMount.screwSeat - length <= 9.6 && batteryMount.screwSeat - length >= 4.4,
        'Preserve full nut traversal and blind-bottom clearance',
      );
      filled(C(2, 1.2, 1.9, x, y), stock, `Closed floor beneath M2 × ${length}`);
    }
  }
  assert.equal(batteryBridge.top, 15.4);
});

test('The actual canonical Heltec and moved battery retainer clear the wider battery towers', () => {
  const module = evaluated(
    union(
      ...modulePieces({ model: 'heltec-wifi-lora32-v4' }, 'assembled').map((piece) =>
        move(piece.shape, [board.x, board.y, board.z]),
      ),
    ),
  );
  for (const { id, p } of cases) {
    const stock = productionStock(p),
      retainer = details(p).find((piece) => piece.id === 'battery-retainer')!.shape;
    assert.ok(overlap(module, stock) < 1e-5, `${id}: the wider towers hit the real module`);
    assert.ok(overlap(retainer, stock) < 1e-5, `${id}: the retainer cannot sit on the tower faces`);
  }
});

test('The reinforced towers preserve the physically confirmed battery bay and clearance for its longest configured cell', () => {
  for (const { id, p } of cases) {
    for (const length of [43, 50]) {
      const d = layout({ ...p, batteryLength: length }),
        b = d.battery;
      const cell = B(b.width, b.length, b.height, b.x, b.y, b.z);
      assert.ok(
        overlap(cell, productionStock(p, true)) < 1e-5,
        `${id}: ${length} mm cell hits a tower or its root`,
      );
      assert.ok(
        33.5 - 5 - (b.y + b.length / 2) >= 0.5 - 1e-9,
        'The root must retain half a millimetre in front of the largest bay',
      );
    }
  }
});
