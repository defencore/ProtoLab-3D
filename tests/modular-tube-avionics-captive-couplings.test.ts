import assert from 'node:assert/strict';
import test from 'node:test';
import part from '../src/parts/modular-tube-avionics/part';
import standoff from '../src/parts/pcb-standoff/part';
import { grandadoSpec } from '../src/parts/catalog-enclosure/lib/grandado';
import {
  flightCouplingSlot,
  flightDatums,
  flightEarMountCuts,
  flightPayload,
  flightCouplingMount,
} from '../src/parts/modular-tube-avionics/lib/flight';

test('delivered coupling selection replaces the larger supplier execution without resizing it', () => {
  const couplings = flightPayload(part.defaults).filter((p) =>
    p.component.id.startsWith('m3-10-coupler-'),
  );
  assert.equal(couplings.length, 4);
  const measured = standoff.presets.find((p) => p.id === flightCouplingMount.couplerPreset)!;
  assert.equal(measured.parameters.bodyWidth, 4.7);
  assert.equal(measured.parameters.cornerDiameter, 5.2);
  assert.equal(measured.parameters.bodyLength, 10);
  for (const { component: c } of couplings) {
    assert.equal(c.presetId, 'user-m3x10-af4-7-ac5-2');
    assert.deepEqual(c.parameters, { ...standoff.defaults, ...measured.parameters });
    assert.deepEqual(c.placement!.rotation, [0, 0, 30]);
  }
  for (const [x, y] of grandadoSpec.screwCenters) {
    const slot = flightCouplingSlot(x, y);
    assert.equal(slot.kind, 'box');
    if (slot.kind !== 'box') continue;
    assert.ok(slot.size[0] > Number(measured.parameters.bodyWidth));
    assert.ok(slot.size[0] < Number(measured.parameters.cornerDiameter));
    assert.ok(slot.size[2] > Number(measured.parameters.bodyLength));
    const outboard = y > 0 ? slot.origin[1] + slot.size[1] : slot.origin[1];
    assert.ok(Math.abs(outboard - y) > flightCouplingMount.columnWidth / 2);
  }
});

test('Grandado ears have two actual screw/washer/nut stacks and side-loadable supported seats', () => {
  const hardware = flightPayload(part.defaults).filter((p) =>
    p.component.id.startsWith('grandado-ear-'),
  );
  assert.equal(hardware.length, 6);
  const cuts = flightEarMountCuts();
  assert.equal(cuts.length, 4);
  for (let i = 0; i < 2; i++) {
    const [x, y] = grandadoSpec.earCenters[i];
    const screw = hardware.find((p) => p.component.id === `grandado-ear-screw-${i + 1}`)!.component;
    const washer = hardware.find(
      (p) => p.component.id === `grandado-ear-washer-${i + 1}`,
    )!.component;
    const nut = hardware.find((p) => p.component.id === `grandado-ear-nut-${i + 1}`)!.component;
    assert.equal(screw.presetId, 'gvyntok-040-190-007');
    assert.equal(screw.parameters.length, 16);
    assert.equal(washer.presetId, 'gvyntok-e3f364f222e0');
    assert.equal(nut.presetId, 'gvyntok-474adfbe1cd7');
    assert.deepEqual(nut.placement!.translation, [x, y, 3.4]);
    const channel = cuts[i * 2 + 1];
    assert.equal(channel.kind, 'box');
    if (channel.kind === 'box') {
      assert.deepEqual(channel.size, [5.8, 16, 3]);
      assert.equal(channel.origin[2] + channel.size[2], 5.8);
      assert.ok(Math.abs(flightDatums.bodyBottom - 5.8 - 3.4) < 1e-8);
    }
  }
});
