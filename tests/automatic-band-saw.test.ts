import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/automatic-band-saw/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { fitAuditCases, fitAuditCode } from './helpers/bandsaw-fit';
import {
  engineering,
  trayLink,
  headPoint,
  bladeHeight,
  liftLink,
  HEAD_PIVOT,
  HEAD_ANGLE,
  TABLE,
} from '../src/parts/automatic-band-saw/lib/layout';
import {
  initialCycle,
  nextCycle,
  step,
  commands,
  type Feedback,
  type Recipe,
  type Cycle,
} from '../src/parts/automatic-band-saw/lib/cycle';

const recipe: Recipe = {
  length: 50,
  kerf: 1.5,
  stockLength: 2000,
  stopWindow: 0.05,
  axisDrift: 0.05,
};
const feedback: Feedback = {
  safety: true,
  guardsLocked: true,
  pressureOk: true,
  driveHealthy: true,
  headUp: true,
  headDown: false,
  lowerNC: true,
  headHeld: true,
  bandStopped: true,
  bandAtSpeed: false,
  contactorOff: true,
  gripperClosed: true,
  gripperOpen: false,
  sideClosed: true,
  topClosed: true,
  viseOpen: false,
  axisHome: false,
  axisStopped: true,
  axisReferenced: true,
  axis: 55.75,
  shelfLevel: true,
  shelfTipped: false,
  partOnShelf: true,
  shelfEmpty: false,
  boxPresent: true,
  passage: false,
  stockDetected: true,
  edgeAxis: null,
  datumCalibrated: true,
  sensorHomeX: -165,
  start: true,
  newBarConfirmed: true,
  timedOut: false,
  toolingConfirmed: true,
};
const state = (phase: Cycle['phase'], patch: Partial<Cycle> = {}): Cycle => ({
  ...initialCycle(),
  phase,
  datumKnown: true,
  noseX: -25,
  heldAxis: 55.75,
  target: 55.75,
  ...patch,
});
const next = (phase: Cycle['phase'], f: Partial<Feedback> = {}, s: Partial<Cycle> = {}) =>
  nextCycle(state(phase, s), { ...feedback, ...f }, recipe);

test('straight saw has no angle axis; all section and cut-length presets validate and render', () => {
  assert.ok(!part.parameters.some((f) => /angle|mitre/i.test(f.key)));
  for (const [presetIndex, preset] of part.presets.entries())
    for (const { id } of part.states!) {
      assert.deepEqual(validateParameters(part, preset.parameters, id), []);
      if (presetIndex > 0 && id !== 'assembled') continue;
      const model = part.buildGeometry(preset.parameters, id);
      try {
        const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        assert.ok(size.every((v) => Number.isFinite(v) && v > (id.endsWith('detail') ? 10 : 1000)));
        const names: string[] = [];
        model.children.forEach((c) => names.push(c.name));
        assert.equal(names.length, new Set(names).size);
        model.traverse((c) => {
          if (c instanceof Mesh)
            assert.ok(Array.from(c.geometry.getAttribute('position').array).every(Number.isFinite));
        });
        part
          .dimensions(preset.parameters, id)
          .forEach((v, i) => assert.ok(Math.abs(v - size[i]) < 0.05));
      } finally {
        disposeModel(model);
      }
    }
});
test('kerf, grip reserve, resolution and shelf cylinder stroke are explicit', () => {
  const e = engineering(part.defaults);
  assert.equal(e.advance, 51.5);
  assert.equal(e.firstAdvance, 60.75);
  assert.equal(e.parts, 30);
  assert.ok(e.remainder >= 400 && e.remainder < 451.5);
  assert.equal(e.axisIncrement, 0.00125);
  assert.ok(e.liftMargin > 2 && e.feedMargin > 1.5 && e.holdMargin > 1.5);
  for (let angle = 0; angle <= HEAD_ANGLE; angle++) {
    assert.deepEqual(headPoint(HEAD_PIVOT, angle), HEAD_PIVOT);
    assert.equal(headPoint([0, 140, 900], angle)[0], 0, 'cut plane remains perpendicular to feed');
    const lift = liftLink(angle);
    assert.ok(lift.extension > 10 && lift.extension < 480);
    assert.ok(lift.momentArm > 0.6);
  }
  assert.ok(
    bladeHeight(-60, HEAD_ANGLE) > TABLE + 120 + 20,
    'raised blade clears the largest stock at the fixed datum',
  );
  for (let a = 0; a >= -70; a--) {
    const link = trayLink(a);
    assert.ok(link.extension > 5 && link.extension < 95, `${a}: ${link.extension}`);
  }
});
test('moving optical sensor scans fixed stock with the shuttle open, then returns before grip', () => {
  const load = {
    ...feedback,
    axis: 0,
    axisHome: true,
    gripperOpen: true,
    gripperClosed: false,
    shelfEmpty: true,
    partOnShelf: false,
  };
  let s = nextCycle(initialCycle(), load, recipe);
  assert.equal(s.phase, 'securing');
  assert.equal(commands(s, load, recipe).gripperClose, false);
  assert.equal(
    nextCycle(s, { ...load, edgeAxis: 140 }, recipe).phase,
    'fault',
    'reject stale latch',
  );
  s = nextCycle(s, load, recipe);
  assert.equal(s.phase, 'scanning');
  assert.equal(
    nextCycle(s, { ...load, gripperOpen: false, gripperClosed: true }, recipe).phase,
    'fault',
  );
  assert.equal(nextCycle(s, { ...load, sideClosed: false }, recipe).phase, 'fault');
  const edge = { ...load, axis: 140, axisHome: false, stockDetected: false, edgeAxis: 140 };
  assert.equal(nextCycle(s, { ...edge, edgeAxis: null }, recipe).phase, 'fault');
  assert.equal(
    nextCycle(s, { ...edge, edgeAxis: 110 }, recipe).phase,
    'fault',
    'nose outside loading window',
  );
  s = nextCycle(s, edge, recipe);
  assert.equal(s.phase, 'scan-return');
  assert.equal(s.noseX, -25);
  assert.equal(s.target, 55.75);
  assert.equal(commands(s, edge, recipe).feedReturn, true);
  s = nextCycle(s, load, recipe);
  assert.equal(s.phase, 'gripping');
  s = nextCycle(s, { ...load, gripperClosed: true, gripperOpen: false }, recipe);
  assert.equal(s.phase, 'opening');
  const open = {
    ...load,
    gripperClosed: true,
    gripperOpen: false,
    sideClosed: false,
    topClosed: false,
    viseOpen: true,
  };
  s = nextCycle(s, open, recipe);
  assert.equal(s.phase, 'feeding');
  s = nextCycle(s, { ...open, axisHome: false, axis: 55.75 }, recipe);
  assert.equal(s.phase, 'clamping');
  assert.equal(nextCycle(s, feedback, recipe).phase, 'starting');
});
test('feed uses referenced axis and calibrated kerf, without pretending to observe stock slip', () => {
  const open = { sideClosed: false, topClosed: false, viseOpen: true };
  assert.equal(next('feeding', open).phase, 'clamping');
  assert.equal(next('feeding', { ...open, axisStopped: false }).phase, 'feeding');
  for (const bad of [
    { axis: 56 },
    { axisReferenced: false },
    { datumCalibrated: false },

    { axis: NaN },
  ])
    assert.equal(next('feeding', { ...open, ...bad }).phase, 'fault');
  assert.equal(next('clamping', { axis: 55.85 }).phase, 'fault');
  assert.equal(next('clamping').phase, 'starting');
  assert.equal(
    next('gripping', { axis: 0, axisHome: true, stockDetected: false }).phase,
    'fault',
    'presence is checked before gripping at home',
  );
  assert.equal(
    next('feeding', { ...open, stockDetected: false }).phase,
    'clamping',
    'a carriage sensor crossing the fixed wall is not a qualified stock-motion proof',
  );
  for (const count of [0, 1, 20, 100]) {
    const s = state('gripping', { facing: false, count });
    const f = { ...feedback, axis: 0, axisHome: true };
    const opened = nextCycle(s, f, recipe);
    assert.equal(opened.target, 51.5);
    assert.equal(
      nextCycle(
        { ...opened, phase: 'feeding' },
        { ...f, ...open, axisHome: false, axis: 51.5 },
        recipe,
      ).phase,
      'clamping',
    );
  }
  // A motor encoder cannot detect bar slip. Actual grip error needs measured cut trials.
  assert.equal('material' in feedback, false);
});
test('bottom switch cuts contactor command immediately; dumping waits for physical standstill', () => {
  const down = {
    headUp: false,
    headDown: true,
    lowerNC: false,
    bandStopped: false,
    bandAtSpeed: true,
    contactorOff: false,
  };
  const stoppedRequest = step(state('cutting'), { ...feedback, ...down }, recipe);
  assert.equal(stoppedRequest.state.phase, 'stopping');
  assert.equal(stoppedRequest.outputs.bandContactor, false);
  assert.equal(stoppedRequest.outputs.headDescend, false);
  assert.equal(stoppedRequest.outputs.headRaise, false);
  assert.equal(next('stopping', down).phase, 'stopping');
  assert.equal(
    next('stopping', { ...down, bandAtSpeed: false, contactorOff: true }).phase,
    'stopping',
  );
  assert.equal(
    next('stopping', { ...down, bandAtSpeed: false, bandStopped: true, contactorOff: true }).phase,
    'dropping',
  );
  assert.equal(
    commands(state('starting'), { ...feedback, lowerNC: false }, recipe).bandContactor,
    false,
  );
});
test('shelf supports through cutting and requires a full part passage before reset and lift', () => {
  assert.equal(
    next('cutting', {
      bandStopped: false,
      bandAtSpeed: true,
      contactorOff: false,
      headUp: false,
      shelfLevel: false,
    }).phase,
    'fault',
  );
  const down = {
    ...feedback,
    headUp: false,
    headDown: true,
    lowerNC: false,
    shelfLevel: false,
    shelfTipped: true,
    partOnShelf: false,
    shelfEmpty: true,
  };
  let s = nextCycle(state('dropping'), down, recipe);
  assert.equal(s.phase, 'dropping', 'idle clear beam cannot acknowledge a part');
  s = nextCycle(s, { ...down, passage: true }, recipe);
  assert.equal(s.phase, 'dropping', 'blocked beam cannot acknowledge a full passage');
  s = nextCycle(s, down, recipe);
  assert.equal(s.phase, 'restoring');
  assert.equal(s.count, 0, 'first facing piece is not production');
  assert.equal(s.consumed, 31.5);
  assert.equal(nextCycle(s, down, recipe).phase, 'restoring');
  s = nextCycle(s, { ...down, shelfLevel: true, shelfTipped: false }, recipe);
  assert.equal(s.phase, 'raising');
  s = nextCycle(s, { ...feedback, shelfEmpty: true, partOnShelf: false }, recipe);
  assert.equal(s.phase, 'ungripping');
});
test('completion stops before the grip reserve; failures cannot request feed, band or head movement', () => {
  const f = { ...feedback, axis: 0, axisHome: true, gripperClosed: false, gripperOpen: true };
  assert.equal(nextCycle(state('returning', { consumed: 1628 }), f, recipe).phase, 'complete');
  for (const bad of [
    { safety: false },
    { timedOut: true },
    { guardsLocked: false },
    { boxPresent: false },
  ]) {
    const result = step(state('starting'), { ...feedback, ...bad }, recipe);
    assert.equal(result.state.phase, 'fault');
    for (const key of [
      'bandContactor',
      'headRaise',
      'headDescend',
      'feedForward',
      'feedReturn',
      'shelfOpen',
      'shelfClose',
    ] as const)
      assert.equal(result.outputs[key], false, key);
    assert.ok(result.outputs.headHold);
  }
  assert.equal(next('cutting', { headDown: true, headUp: false, lowerNC: true }).phase, 'fault');
});

test(
  'all hardware pairs and stock clear across the assembly, feed, head and shelf sample matrix',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: fitAuditCode(fitAuditCases()),
      encoding: 'utf8',
      timeout: 1200000,
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    assert.match(result.stdout, /ALL_PAIRS_FIT_OK/);
  },
);
