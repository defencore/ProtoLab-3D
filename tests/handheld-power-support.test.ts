import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Mesh, Vector3 } from 'three';
import { cylinder, type Shape } from '../src/core/assembly/boundary/shapes';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import {
  powerBase,
  powerLid,
  powerSwitch,
  powerSwitchShape,
} from '../src/parts/handheld-lora-controller/lib/power-button';
import { B, move, subtract, union } from '../src/parts/handheld-lora-controller/lib/shapes';
import { internalFpcEnvelope } from '../src/parts/handheld-lora-controller/lib/antenna-seat';

before(async () => initializeManifoldGeometry());

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Power-support fit control', 0xffffff);
  try {
    let result = 0;
    model.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const position = item.geometry.getAttribute('position'),
        index = item.geometry.index;
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.clone().cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}

function overlap(first: Shape, second: Shape): number {
  return volume(first) - volume(subtract(first, second));
}

function contained(witness: Shape, material: Shape, label: string): void {
  const missing = volume(witness) - volume({ kind: 'intersect', children: [witness, material] });
  assert.ok(missing < 1e-5, `${label}: ${missing} mm³ missing`);
}

test('Both front shoulders connect the switch bearing wall to the end aperture continuously', () => {
  const base = powerBase(),
    f = powerSwitch.frontBridge;
  assert.ok(Math.abs(f.backY - f.frontY - 5.7) < 1e-9);
  assert.ok(f.shoulderWidth >= 2.8);
  for (const side of [-1, 1])
    contained(B(2.8, 5.6, 9.8, side * 4.75, -49.55, 15.1), base, `Front shoulder ${side}`);
});

test('Base and lid retain broad T-shaped rear bearings with a clear split between halves', () => {
  const base = powerBase(),
    lid = powerLid(),
    t = powerSwitch.rearT;
  assert.ok(Math.abs(t.lidBottomZ - t.baseTopZ - 0.2) < 1e-9);
  assert.ok(t.crossbarDepth >= 2.8 && t.stemWidth >= 3.2);
  for (const [material, bottom, top, label] of [
    [base, 15.1, 24.9, 'Base'],
    [lid, 25.3, 28.2, 'Lid'],
  ] as const) {
    contained(B(5.8, 2.6, top - bottom, 0, -40.9, bottom), material, `${label} T crossbar`);
    contained(B(3, 3.9, top - bottom, 0, -40.25, bottom), material, `${label} T stem`);
  }
  assert.ok(overlap(base, lid) < 1e-5, 'The new T ribs must not interfere at closure');
});

test('The complete tactile switch drops in and the lid closes over its unpressed actuator', () => {
  const base = powerBase(),
    lid = powerLid(),
    power = powerSwitchShape({ powerButton: 'first' });
  for (let step = 0; step <= 60; step++) {
    const lift = step * 0.5;
    assert.ok(
      overlap(move(power, [0, 0, lift]), base) < 1e-5,
      `The real switch is blocked at vertical insertion lift ${lift} mm`,
    );
  }
  for (let step = 0; step <= 48; step++) {
    const lift = step * 0.25,
      moving = move(lid, [0, 0, lift]);
    assert.ok(overlap(moving, base) < 1e-5, `The lid hits the base at lift ${lift} mm`);
    assert.ok(overlap(moving, power) < 1e-5, `The lid hits the switch at lift ${lift} mm`);
  }
});

test('Rear T ribs clear the DS-225 body and solder lugs and the internal FPC film/feed', () => {
  // Conservative solid envelopes preserve the actual installed DS-225 body,
  // barrel, rectangular bezel and both complete lugs, including their slot stock.
  const sideSwitch = union(
      cylinder(5.65, 7.5, [3.5, -35, 18.5], 'x'),
      cylinder(6.3, 10, [11, -35, 18.5], 'x'),
      B(3, 15, 15, 22.5, -35, 11),
      ...[15.5, 21.5].map((z) => B(6, 2, 0.6, 0.5, -35, z - 0.3)),
    ),
    support = union(powerBase(), powerLid());
  assert.ok(
    overlap(support, sideSwitch) < 1e-5,
    'Power supports obstruct the adjacent side switch',
  );
  for (const bodyModel of ['original', 'contoured', 'web-grip'])
    assert.ok(
      overlap(support, internalFpcEnvelope({ bodyModel })) < 1e-5,
      `${bodyModel}: rear T support obstructs the FPC film or feed`,
    );
});
