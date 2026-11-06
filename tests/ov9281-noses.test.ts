import test from 'node:test';
import assert from 'node:assert/strict';
import part, { configuredPieces } from '../src/parts/rocket-camera-nose/part';
import { cameraCablePlans } from '../src/parts/rocket-camera-nose/lib/csi';
import { opticalLayout } from '../src/parts/rocket-camera-nose/lib/optical-layout';
import { availableModelState } from '../src/core/part-selection';

const preset = (id: string) => {
  const found = part.presets.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
};

test('interchangeable single-camera hardware retains supplier identities while the dual execution stays separate', () => {
  const original = preset('structural-90-86').parameters,
    ov = preset('ov9281-90-86').parameters;
  for (const p of [original, ov]) {
    assert.equal(p.tubeOD, 90);
    assert.equal(p.tubeID, 86);
    assert.equal(p.shoulderLength, 98);
    assert.equal(p.wall, 3);
    assert.equal(p.shoulderClearance, 0.2);
    assert.deepEqual(part.validate?.(p, 'assembled'), []);
    assert.equal(part.dimensions(p, 'assembled')[2], 240);
    for (const state of part.states!)
      assert.equal(availableModelState(part, p, state.id), state.id);
  }
  const first = configuredPieces(original),
    second = configuredPieces(ov);
  for (const id of ['outer-shell', 'cassette-cage-base', 'cassette-cage-cover', 'rear-retainer']) {
    const a = first.find((piece) => piece.component.id === id)!.component,
      b = second.find((piece) => piece.component.id === id)!.component;
    assert.ok(a && b, id);
    assert.equal(a.libraryId, b.libraryId);
    assert.deepEqual(a.parameters, b.parameters, id + ' is the same physical reusable rigid part');
    assert.deepEqual(a.placement, b.placement);
  }
  for (const pieces of [first, second]) {
    assert.equal(new Set(pieces.map((piece) => piece.component.id)).size, pieces.length);
    assert.ok(!pieces.some((piece) => piece.component.libraryId === 'optical-dome-window'));
  }
  assert.equal(second.length, 39);
  assert.equal(second.filter((piece) => piece.component.libraryId === 'bolt-screw').length, 8);
  assert.equal(
    second.filter((piece) => piece.component.manufacturing?.processes.includes('printing')).length,
    14,
  );
  const camera = second.find(
    (piece) => piece.component.libraryId === 'waveshare-ov9281-110',
  )!.component;
  assert.equal(
    camera.id,
    'csi-camera',
    'both interchangeable products occupy the common camera slot',
  );
  assert.equal(camera.libraryId, 'waveshare-ov9281-110');
  assert.equal(camera.presetId, 'waveshare-21653');
  assert.equal(camera.parameters.focusExtension, 10);
  assert.ok(!second.some((piece) => piece.component.libraryId === 'board-camera-19'));
  assert.deepEqual(
    second.find((piece) => piece.component.id === 'pi5')!.component.placement,
    first.find((piece) => piece.component.id === 'pi5')!.component.placement,
  );
  const singleLead = cameraCablePlans(ov);
  assert.equal(singleLead.length, 1);
  assert.equal(singleLead[0].availableLength, 150);
  assert.ok(singleLead[0].totalLength > 100);
  assert.ok(singleLead[0].totalLength <= singleLead[0].availableLength);
  assert.ok(singleLead[0].slack >= 0);

  const dual = preset('dual-90-86').parameters,
    dualPieces = configuredPieces(dual);
  assert.equal(dual.shoulderLength, 94);
  assert.equal(dual.wall, 2.4);
  assert.equal(dual.shoulderClearance, 0.4);
  assert.deepEqual(part.validate?.(dual, 'assembled'), []);
  assert.equal(dualPieces.length, 106);
  assert.equal(
    dualPieces.filter((piece) => piece.component.id.startsWith('optical-window')).length,
    2,
  );
  assert.ok(dualPieces.some((piece) => piece.component.id === 'ov9281-camera'));
  assert.ok(dualPieces.some((piece) => piece.component.id === 'csi-camera'));
  assert.equal(
    dualPieces.find((piece) => piece.component.id === 'pi5')!.component.placement.translation[2],
    39,
  );
  const dualLeads = cameraCablePlans(dual);
  assert.equal(dualLeads.length, 2);
  assert.equal(new Set(dualLeads.map((route) => route.port)).size, 2);
  for (const route of dualLeads) {
    assert.ok(route.totalLength < 100);
    assert.ok(route.slack > 0.5);
    assert.ok(route.minBendRadius > 3);
    assert.equal(route.insertionAllowance, 10);
  }
  assert.equal(opticalLayout(dual).windows.length, 2);
});
