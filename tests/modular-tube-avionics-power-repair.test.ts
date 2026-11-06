import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { Euler, Vector3 } from 'three';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import part from '../src/parts/modular-tube-avionics/part';
import {
  powerContactSpecs,
  powerCellFit,
  powerInterface,
  powerPayload,
  powerPrinted,
  powerServiceGauges,
  powerStructure,
  powerTerminalWireGauges,
  powerTerminalWireGrooves,
  powerTerminalWiring,
} from '../src/parts/modular-tube-avionics/lib/power';
import { upsInterface } from '../src/parts/waveshare-ups-3s/part';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8);

test('printed dry-fit correction removes only the UPS liner and its three TPU contact claims', () => {
  for (const keyClearance of [0.2, 0.3, 0.6]) {
    const p = { ...part.defaults, keyClearance };
    const printed = powerPrinted(p);
    assert.equal(printed.length, 6);
    assert.equal(printed.filter((piece) => piece.material === 'PETG').length, 5);
    assert.deepEqual(
      printed.filter((piece) => piece.material === 'TPU').map((piece) => piece.id),
      ['power-holder-cell-liner'],
    );
    const pairs = powerContactSpecs(p).map((contact) => contact.ids);
    assert.equal(
      pairs.filter((pair) => pair.some((id) => id.startsWith('power-holder-cell-reference-')))
        .length,
      3,
    );
    assert.ok(!pairs.flat().some((id) => id.includes('power-ups-')));
  }
});

test('UPS purchased unit receives a proper in-plane rotation with its battery face and seat centers retained', () => {
  const installed = powerPayload(part.defaults).find(
    (piece) => piece.component.id === 'power-ups-3s',
  )!.component;
  assert.equal(installed.libraryId, 'waveshare-ups-3s');
  assert.equal(installed.presetId, 'ups-module-3s');
  assert.deepEqual(installed.parameters, { model: 'ups-module-3s' });
  assert.deepEqual(installed.placement!.translation, [188.5, 0, 24.2]);
  assert.deepEqual(installed.placement!.rotation, [0, 0, 180]);
  const rotation = new Euler(0, 0, Math.PI);
  const sourceNormal = new Vector3(0, 0, -1).applyEuler(rotation);
  close(sourceNormal.z, -1);
  const socketEdge = new Vector3(upsInterface.bounds.max[0], 0, 0).applyEuler(rotation);
  assert.ok(socketEdge.x < 0, 'Source +X socket edge faces the forward XT60 panel');
  const ys = upsInterface.cellSeats
    .map((seat) => {
      const p = new Vector3(...seat.center).applyEuler(rotation).add(new Vector3(188.5, 0, 24.2));
      close(p.x, 188.5);
      close(p.z, 12.8);
      return Math.round(p.y * 10) / 10;
    })
    .sort((a, b) => a - b);
  assert.deepEqual(ys, [-19.5, 0, 19.5]);
});

test('UPS can witnesses follow the source seat datum without claiming a TPU preload', () => {
  const rotation = new Euler(0, 0, Math.PI);
  const sourceCenters = upsInterface.cellSeats
    .map((seat) =>
      new Vector3(...seat.center).applyEuler(rotation).add(new Vector3(188.5, 0, 24.2)),
    )
    .sort((a, b) => a.y - b.y);
  const references = powerCellFit.seats.filter((seat) => seat.bank === 'ups');
  for (let i = 0; i < sourceCenters.length; i++) {
    references[i].center.forEach((coordinate, axis) =>
      close(coordinate, sourceCenters[i].toArray()[axis]),
    );
    close(references[i].center[2], 12.8);
  }
  assert.deepEqual(powerCellFit.linerBanks, ['holder']);
  assert.equal(powerInterface.cellRetention.bank, 'holder');
  assert.ok(!Object.hasOwn(powerInterface.cellRetention, 'upsKeeperUndersideZ'));
});

test('spine apertures follow the bought UPS connector frame without changing outer interfaces', () => {
  const gauges = powerServiceGauges();
  assert.equal(gauges.length, 6);
  for (const gauge of gauges) {
    assert.equal(gauge.shape.kind, 'transform');
    if (gauge.shape.kind !== 'transform') continue;
    assert.deepEqual(gauge.shape.rotation, powerInterface.ups.rotation);
    assert.deepEqual(gauge.shape.translation, [188.5, 0, 24.2]);
    const source = gauge.shape.child;
    assert.ok(source.kind === 'box' || source.kind === 'cylinder');
    if (source.kind !== 'box' && source.kind !== 'cylinder') continue;
    const center = new Vector3(...source.origin).applyEuler(new Euler(0, 0, Math.PI));
    center.x += 188.5;
    if (gauge.id.includes('socket')) assert.ok(center.x < 150);
    else assert.ok(center.x > 225);
  }
  // Unaffected physical recipes retain rev A geometry exactly. These are the
  // salvage parts, including the independent holder's still-required liner.
  const unchanged = {
    'power-forward-disc': '47671a6126ab90d6bdfb7a722d4c6c3969aab93e441016dcc84ea44f728f821a',
    'power-aft-disc': '7932fa0ad4d82e9b96e33fa5f355062ab46b6b05f8a9269f674f1c767fbbd2cc',
    'power-upper-cage': 'd289906f9592f054fd1ced9c2e607203b373e046ffb1ba58ccffd475d2d2559d',
    'power-holder-cell-liner': '4fe4b5e7b16323cf6208248c1a7e9b0bc08033b67d920903dd17deb374938a63',
  };
  for (const piece of powerPrinted(part.defaults)) {
    const hash = unchanged[piece.id as keyof typeof unchanged];
    if (hash)
      assert.equal(
        createHash('sha256').update(pythonShape(piece.shape)).digest('hex'),
        hash,
        piece.id,
      );
  }
});

test('D1.5 terminal-wire guides link the slots with 0.25 radial clearance and two millimetres of bearing floor', () => {
  const d = powerTerminalWiring;
  close(d.wireDiameter, 1.5);
  close(d.radialClearance, 0.25);
  close(d.grooveDepth, 1);
  close(d.remainingFloor, 2);
  close(d.remainingFloor, d.floorTopZ - d.floorBottomZ - d.grooveDepth);
  close(d.wireProtrusion, 0.75);
  assert.deepEqual(d.stationsX, [153.5, 223.5]);
  for (const x of d.stationsX) {
    for (const [a, b] of powerStructure.crossheadsX)
      assert.ok(x + d.grooveRadius < a || x - d.grooveRadius > b);
  }
  assert.equal(powerTerminalWireGrooves().length, 2);
  for (const groove of powerTerminalWireGrooves()) {
    assert.equal(groove.kind, 'cylinder');
    if (groove.kind !== 'cylinder') continue;
    assert.equal(groove.axis, 'y');
    close(groove.origin[2], d.floorBottomZ);
    close(groove.radius, 1);
    assert.match(pythonShape(groove), /^Part.makeCylinder\(/);
  }
  for (const gauge of powerTerminalWireGauges()) {
    assert.equal(gauge.shape.kind, 'cylinder');
    if (gauge.shape.kind === 'cylinder') close(gauge.shape.radius, 0.75);
  }
});
