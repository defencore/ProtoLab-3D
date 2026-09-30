import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialStock,
  stockStep,
  stockCanCut,
  admissionCommands,
  type StockFeedback,
  type StockRecipe,
} from '../src/parts/automatic-tube-saw/lib/stock-cycle';
import {
  safetyStep,
  type SafetyInputs,
  type SafetyState,
} from '../src/parts/automatic-tube-saw/lib/safety';
import { gateLink } from '../src/parts/automatic-tube-saw/lib/stock-loading';
const recipe: StockRecipe = {
  mode: 'automatic',
  stockLength: 1205,
  trim: 5,
  advance: 24,
  retainedTail: 1150,
  clearDwellMs: 1000,
  tolerance: 0.2,
};
const clear: StockFeedback = {
  safetyHealthy: true,
  loaderStopped: true,
  sawDown: true,
  spindleStopped: true,
  gateClosed: true,
  gateOpen: false,
  queuePresent: true,
  tailZoneClear: true,
  cuttingZoneClear: true,
  receiverClear: true,
  loadingCoverLocked: true,
};
function admit() {
  let s = stockStep(initialStock(), { type: 'remnant-removed' }, clear, recipe);
  for (let i = 0; i < 4; i++) s = stockStep(s, { type: 'tick', elapsedMs: 250 }, clear, recipe);
  assert.equal(s.emptyMs, 1000);
  s = stockStep(s, { type: 'admit' }, clear, recipe);
  assert.equal(s.phase, 'opening');
  assert.ok(!admissionCommands(s, clear).loadForward);
  s = stockStep(
    s,
    { type: 'tick', elapsedMs: 100 },
    { ...clear, gateClosed: false, gateOpen: true },
    recipe,
  );
  assert.equal(s.phase, 'admitting');
  const inside = {
    ...clear,
    gateClosed: false,
    gateOpen: true,
    tailZoneClear: false,
    cuttingZoneClear: false,
  };
  s = stockStep(s, { type: 'tick', elapsedMs: 100 }, inside, recipe);
  s = stockStep(s, { type: 'front-at-datum' }, inside, recipe);
  assert.equal(s.phase, 'facing');
  s = stockStep(s, { type: 'faced', scrapRemoved: true }, inside, recipe);
  assert.equal(s.phase, 'active');
  assert.equal(s.barId, 1);
  return s;
}
test('a new bar cannot inherit an uncleared remnant, beam flicker or an old zero', () => {
  assert.equal(stockStep(initialStock(), { type: 'admit' }, clear, recipe).phase, 'fault');
  let s = stockStep(initialStock(), { type: 'remnant-removed' }, clear, recipe);
  s = stockStep(s, { type: 'tick', elapsedMs: 250 }, clear, recipe);
  s = stockStep(s, { type: 'tick', elapsedMs: 100 }, { ...clear, cuttingZoneClear: false }, recipe);
  assert.equal(s.emptyMs, 0);
  assert.equal(stockStep(s, { type: 'admit' }, clear, recipe).phase, 'fault');
  assert.equal(
    stockStep(admit(), { type: 'faced', scrapRemoved: true }, clear, recipe).phase,
    'fault',
  );
});
test('ledger reserves a capturable tail, counts kerf and rejects stale/duplicated cuts', () => {
  let s = admit();
  const event = { type: 'cut-complete' as const, barId: 1, cutNumber: 1, measuredAdvance: 24 };
  assert.ok(stockCanCut(s, recipe));
  s = stockStep(s, event, clear, recipe);
  assert.equal(s.consumed, 29);
  assert.equal(stockStep(s, event, clear, recipe).phase, 'fault');
  assert.equal(stockStep(s, { ...event, barId: 0, cutNumber: 2 }, clear, recipe).phase, 'fault');
  s = stockStep(s, { ...event, cutNumber: 2 }, clear, recipe);
  assert.equal(s.phase, 'remnant');
  assert.ok(!stockCanCut(s, recipe));
  assert.equal(stockStep(s, { type: 'admit' }, clear, recipe).phase, 'fault');
  assert.equal(
    stockStep(s, { type: 'remnant-removed' }, { ...clear, receiverClear: false }, recipe).phase,
    'fault',
  );
  assert.equal(stockStep(admit(), { type: 'unexpected-tail' }, clear, recipe).phase, 'fault');
  assert.equal(
    stockStep(admit(), { ...event, measuredAdvance: NaN }, clear, recipe).phase,
    'fault',
  );
});
test('admission requires ordered edges, cover lock and timed gate proofs', () => {
  let s = initialStock();
  s = { ...s, phase: 'opening' };
  for (let i = 0; i < 21; i++) s = stockStep(s, { type: 'tick', elapsedMs: 250 }, clear, recipe);
  assert.equal(s.phase, 'fault');
  const entering = { ...initialStock(), phase: 'admitting' as const };
  assert.equal(
    stockStep(
      entering,
      { type: 'front-at-datum' },
      { ...clear, gateOpen: true, gateClosed: false, cuttingZoneClear: false },
      recipe,
    ).phase,
    'fault',
  );
  assert.ok(!admissionCommands(entering, { ...clear, loadingCoverLocked: false }).loadForward);
  assert.ok(!admissionCommands(admit(), { ...clear, tailZoneClear: false }).closeGate);
  for (let angle = 0; angle <= 90; angle += 5)
    assert.ok(gateLink(angle).extension >= 0 && gateLink(angle).extension <= 50);
});
const inputs: SafetyInputs = {
  estopsReleased: true,
  guardsLocked: true,
  contactorsHealthy: true,
  standstill: true,
  liftHeld: true,
  pressureHealthy: true,
  reset: false,
  start: false,
  stop: false,
  mode: 'automatic',
  autoModulePresent: true,
  manualGuardPresent: false,
};
const tripped: SafetyState = {
  phase: 'tripped',
  mode: 'automatic',
  lastReset: false,
  lastStart: false,
};
test('E-stop release and held start cannot restart; reset and new start are separate', () => {
  let s = safetyStep(tripped, { ...inputs, start: true });
  assert.equal(s.phase, 'tripped');
  s = safetyStep(s, { ...inputs, start: true, reset: true });
  assert.equal(s.phase, 'armed');
  s = safetyStep(s, { ...inputs, start: true });
  assert.equal(s.phase, 'armed');
  s = safetyStep(s, inputs);
  s = safetyStep(s, { ...inputs, start: true });
  assert.equal(s.phase, 'running');
  for (const key of [
    'estopsReleased',
    'guardsLocked',
    'contactorsHealthy',
    'pressureHealthy',
    'autoModulePresent',
  ] as const)
    assert.equal(safetyStep(s, { ...inputs, [key]: false }).phase, 'tripped');
  assert.equal(
    safetyStep(s, { ...inputs, mode: 'manual', manualGuardPresent: true }).phase,
    'tripped',
  );
  assert.equal(safetyStep(tripped, { ...inputs, reset: true, standstill: false }).phase, 'tripped');
});

import {
  newMaterialTrack,
  trackMaterial,
  remainingAtCut,
} from '../src/parts/automatic-tube-saw/lib/material-tracker';
import {
  initialReject,
  rejectStep,
  rejectCommands,
  type RejectFeedback,
} from '../src/parts/automatic-tube-saw/lib/reject-cycle';
test('material edges measure physical length and cannot fabricate travel after wheel contact loss', () => {
  const f = { count: 100, contact: true, frontBeam: true, tailBeam: true, newBar: false };
  const front = trackMaterial(newMaterialTrack(1, 0), f, 1205, 0.2);
  assert.equal(front.frontCount, 100);
  const tail = trackMaterial(front, { ...f, count: 1225, tailBeam: false }, 1205, 0.2);
  assert.equal(tail.measuredLength, 1205);
  assert.equal(remainingAtCut(tail), 390);
  assert.equal(
    stockStep(
      admit(),
      { type: 'physical-tail', barId: tail.barId, measuredLength: tail.measuredLength! },
      clear,
      recipe,
    ).phase,
    'active',
  );
  assert.equal(
    remainingAtCut(trackMaterial(tail, { ...f, count: 1255, tailBeam: false }, 1205)),
    360,
  );
  assert.equal(
    remainingAtCut(
      trackMaterial(tail, { ...f, count: 1255, contact: false, tailBeam: false }, 1205),
    ),
    undefined,
  );
  for (const bad of [
    { ...f, count: 90 },
    { ...f, contact: false },
    { ...f, newBar: true },
    { ...f, count: 1100, tailBeam: false },
  ])
    assert.ok(trackMaterial(front, bad, 1205, 0.2).fault);
  assert.ok(trackMaterial(front, f, 1205, NaN).fault);
  assert.ok(trackMaterial(tail, f, 1205).fault);
});
const rejectFeedback: RejectFeedback = {
  safety: true,
  guards: true,
  sawDown: true,
  spindleStopped: true,
  gateClosed: true,
  clampsOpen: true,
  feedJawOpen: true,
  receiverLevel: true,
  receiverEntry: false,
  cutExitClear: true,
  receiverEntryClear: true,
  receiverPark: false,
  receiverEmpty: true,
  scrapSelected: false,
  scrapPassage: false,
  scrapBinPresent: true,
  timedOut: false,
};
function positionedRemnant() {
  let s = rejectStep(initialReject(), rejectFeedback, true);
  s = rejectStep(s, rejectFeedback);
  assert.equal(s.phase, 'purging');
  s = rejectStep(s, { ...rejectFeedback, cutExitClear: false, receiverEmpty: false });
  s = rejectStep(s, {
    ...rejectFeedback,
    cutExitClear: false,
    receiverEmpty: false,
    receiverEntry: true,
    receiverEntryClear: false,
  });
  assert.equal(s.phase, 'positioning');
  return s;
}
test('reject requires occupancy, tail clearance, selected scrap route and a full passage pulse', () => {
  let s = positionedRemnant();
  const parked = { ...rejectFeedback, receiverEmpty: false, receiverPark: true };
  assert.equal(rejectStep(s, { ...parked, cutExitClear: false }).phase, 'fault');
  assert.equal(rejectStep(s, { ...parked, clampsOpen: false }).phase, 'fault');
  s = rejectStep(s, parked);
  assert.equal(s.phase, 'diverting');
  assert.ok(!rejectCommands(s).tilt);
  s = rejectStep(s, { ...parked, scrapSelected: true });
  assert.equal(s.phase, 'dumping');
  assert.ok(rejectCommands(s).tilt);
  assert.equal(rejectStep(s, { ...parked, scrapSelected: false }).phase, 'fault');
  const cleared = { ...rejectFeedback, receiverLevel: false, scrapSelected: true };
  s = rejectStep(s, { ...cleared, scrapPassage: true });
  assert.equal(s.phase, 'dumping');
  s = rejectStep(s, cleared);
  assert.equal(s.phase, 'returning');
  s = rejectStep(s, { ...cleared, receiverLevel: true });
  assert.equal(s.phase, 'complete');
  let stock = admit();
  for (let n = 1; n <= 2; n++)
    stock = stockStep(
      stock,
      { type: 'cut-complete', barId: 1, cutNumber: n, measuredAdvance: 24 },
      clear,
      recipe,
    );
  stock = stockStep(
    stock,
    { type: 'reject-confirmed', barId: 1, receiverEmpty: true, passageSeen: s.passageSeen },
    clear,
    recipe,
  );
  assert.equal(stock.phase, 'clearing');
  assert.equal(stock.emptyMs, 0);
  assert.equal(stockStep(stock, { type: 'admit' }, clear, recipe).phase, 'fault');
  const fault = rejectStep(positionedRemnant(), { ...parked, timedOut: true });
  assert.ok(!Object.values(rejectCommands(fault)).some(Boolean));
});
test('a blocked scrap beam cannot masquerade as a completed reject', () => {
  const s = rejectStep(initialReject(), rejectFeedback, true);
  assert.equal(rejectStep(s, { ...rejectFeedback, scrapPassage: true }).phase, 'fault');
});
test('assisted loading needs a cleared identity and facing waste confirmation', () => {
  const r = { ...recipe, mode: 'assisted' as const },
    f = { ...clear, gateClosed: false };
  let s = stockStep(initialStock(), { type: 'remnant-removed' }, f, r);
  for (let i = 0; i < 4; i++) s = stockStep(s, { type: 'tick', elapsedMs: 250 }, f, r);
  assert.equal(stockStep(s, { type: 'admit' }, f, r).phase, 'fault');
  s = stockStep(s, { type: 'operator-loaded' }, { ...f, cuttingZoneClear: false }, r);
  assert.equal(s.phase, 'facing');
  assert.equal(
    stockStep(s, { type: 'faced', scrapRemoved: false }, { ...f, cuttingZoneClear: false }, r)
      .phase,
    'fault',
  );
  assert.equal(
    stockStep(s, { type: 'faced', scrapRemoved: true }, { ...f, cuttingZoneClear: false }, r).phase,
    'active',
  );
});
