import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Raycaster, Vector3 } from 'three';
import pi, { pi5Interface } from '../src/parts/raspberry-pi/part';
import adapter, {
  adapterInterface,
  adapterCableReference,
} from '../src/parts/waveshare-pcie-m2-d/part';
import { disposeModel } from '../src/core/mechanical';
import pi5Source from '../src/parts/raspberry-pi/lib/pi5/native.json';

test('the public Pi5 interface matches retained PCB holes and every lightweight populated-package envelope', () => {
  const model = pi.buildGeometry({ model: 'raspberry-pi-5', detail: 'lightweight' }, 'assembled');
  try {
    model.updateMatrixWorld(true);
    assert.equal(pi5Interface.source.sourceSolidCount, 2689);
    assert.equal(pi5Interface.packages.length, 19);
    assert.equal(model.children.length, 20);
    assert.equal(new Set(pi5Interface.packages.map((p) => p.label)).size, 19);
    const pcb = model.children[0];
    const b = new Box3().setFromObject(pcb, true);
    assert.ok(b.min.distanceTo(new Vector3(...pi5Interface.pcb.bounds.min)) < 1e-4);
    assert.ok(b.max.distanceTo(new Vector3(...pi5Interface.pcb.bounds.max)) < 1e-4);
    assert.ok(Math.abs(b.max.z - b.min.z - pi5Interface.pcb.thickness) < 1e-4);
    for (const hole of pi5Interface.pcb.holes) {
      assert.equal(
        new Raycaster(new Vector3(hole.x, hole.y, 3), new Vector3(0, 0, -1)).intersectObject(
          pcb,
          true,
        ).length,
        0,
        'source PCB mounting bore stays open',
      );
      assert.ok(
        new Raycaster(new Vector3(hole.x + 1.6, hole.y, 3), new Vector3(0, 0, -1)).intersectObject(
          pcb,
          true,
        ).length > 0,
        'material remains beside mounting bore',
      );
    }
    for (const record of pi5Interface.packages) {
      const child = model.children.find((c) => c.name === record.label);
      assert.ok(child, record.label);
      const box = new Box3().setFromObject(child, true);
      assert.ok(
        box.min.distanceTo(new Vector3(...record.bounds.min)) < 1e-4,
        record.label + ' min',
      );
      assert.ok(
        box.max.distanceTo(new Vector3(...record.bounds.max)) < 1e-4,
        record.label + ' max',
      );
      assert.ok(record.sourceSolids.length > 0);
      assert.ok(Object.isFrozen(record.bounds.min));
    }
  } finally {
    disposeModel(model);
  }
});

test('public ribbon datums preserve actual new cassette entry orientations without changing supplier board dimensions', () => {
  const rotation = new Euler(0, -Math.PI / 2, 0, 'ZYX');
  const piMouth = new Vector3(...pi5Interface.connectors.pcie.mouth)
    .applyEuler(rotation)
    .add(new Vector3(6.5, 0, 45));
  assert.ok(piMouth.distanceTo(new Vector3(1.214, 1.995, 5.13)) < 1e-9);
  assert.ok(
    new Vector3(...pi5Interface.connectors.pcie.exit)
      .applyEuler(rotation)
      .distanceTo(new Vector3(-1, 0, 0)) < 1e-12,
  );
  assert.ok(
    new Vector3(...adapterInterface.ribbonConnector.exit)
      .applyEuler(rotation)
      .distanceTo(new Vector3(0, 0, 1)) < 1e-12,
  );
  for (const reference of Object.values(pi5Interface.connectors)) {
    assert.equal(new Vector3(...reference.exit).dot(new Vector3(...reference.widthAxis)), 0);
    assert.equal(reference.mouth[2], reference.bounds.max[2]);
  }
  assert.equal(adapterCableReference.nominalLength, 40);
  assert.match(adapterInterface.ribbonConnector.datumEvidence, /not a dimensioned mating drawing/);
  assert.deepEqual(adapter.dimensions(adapter.defaults, 'default'), [88, 56.5, 8]);
  const model = adapter.buildGeometry(adapter.defaults, 'default');
  try {
    const pcb = model.children[0];
    model.updateMatrixWorld(true);
    const opening = adapterInterface.ribbonPassage;
    const center = opening.min.map((value, axis) => (value + opening.max[axis]) / 2);
    const hits = (x: number) =>
      new Raycaster(new Vector3(x, center[1], 3), new Vector3(0, 0, -1)).intersectObject(pcb, true);
    assert.equal(
      hits(center[0]).length,
      0,
      'published host reference corresponds to the real board opening',
    );
    assert.ok(hits(opening.min[0] - 1).length > 0, 'PCB remains beside the cable opening');
  } finally {
    disposeModel(model);
  }
});

test('identified GPIO power-pin tips retain source coordinates and standard physical numbering', () => {
  assert.deepEqual(
    pi5Interface.gpio.pins.map((p) => [p.number, p.signal, p.sourceSolid]),
    [
      [1, '3V3', 1360],
      [2, '5V', 1380],
      [4, '5V', 1379],
      [6, 'GND', 1378],
    ],
  );
  assert.equal(
    pi5Interface.gpio.seatZ,
    pi5Source.components[pi5Interface.gpio.plasticSourceSolid].bounds[5],
  );
  assert.ok(pi5Interface.gpio.seatZ < pi5Interface.gpio.pins[0].tip[2]);
  for (const pin of pi5Interface.gpio.pins) {
    const b = pi5Source.components[pin.sourceSolid].bounds;
    assert.deepEqual(pin.tip, [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5]]);
  }
  const pin4 = pi5Interface.gpio.pins.find((p) => p.number === 4)!;
  const pin6 = pi5Interface.gpio.pins.find((p) => p.number === 6)!;
  assert.ok(Math.abs(pin6.tip[0] - pin4.tip[0] - 2.54) < 1e-12);
  assert.equal(pin6.tip[1], pin4.tip[1]);
  const rotation = new Euler(0, -Math.PI / 2, 0, 'ZYX');
  const installed = new Vector3(...pin4.tip).applyEuler(rotation).add(new Vector3(4.5, -2, 46));
  assert.ok(installed.distanceTo(new Vector3(-5.376, 23.77, 14.41)) < 1e-9);
});
