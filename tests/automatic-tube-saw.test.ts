import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3, Mesh } from 'three';
import { spawnSync } from 'node:child_process';
import part from '../src/parts/automatic-tube-saw/part';
import blade from '../src/parts/circular-saw-blade/part';
import roller from '../src/parts/conveyor-roller/part';
import pneumatic from '../src/parts/compact-pneumatic-cylinder/part';
import controls from '../src/parts/machine-control/part';
import measurement from '../src/parts/machine-measurement/part';
import { trayLink } from '../src/parts/automatic-tube-saw/lib/layout';
import motors from '../src/parts/machine-drive-motor/part';
import { engineering, issues } from '../src/parts/automatic-tube-saw/lib/engineering';
import {
  nextPhase,
  commands,
  step,
  type Recipe,
  type Feedback,
} from '../src/parts/automatic-tube-saw/lib/cycle';
import { machinePieces } from '../src/parts/automatic-tube-saw/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { budgetTotal } from '../src/parts/automatic-tube-saw/lib/bom';
import { geometry } from '../src/parts/automatic-tube-saw/lib/assembly';

test('saw distinguishes minimum ring length, mitre fixture clearance and projected kerf', () => {
  const p = { ...part.defaults, cutLength: 20 };
  assert.deepEqual(issues(p), []);
  assert.equal(engineering(p).advance, 24);
  assert.match(issues({ ...p, angle: 45 }).join(), /230 mm/);
  assert.deepEqual(issues({ ...p, angle: 45, cutLength: 230 }), []);
  assert.ok(Math.abs(engineering({ ...p, angle: -45 }).kerfAxial - Math.sqrt(32)) < 1e-9);
  const e = engineering(part.defaults);
  assert.ok(e.gripMargin >= 1.5);
  assert.ok(e.driveMargin > 1.5);
  assert.ok(e.stockMass > 23 && e.stockMass < 24);
  assert.equal(e.accuracy, 0.5);
  assert.ok(budgetTotal > 4000);
  assert.match(part.assessment!(part.defaults).join(), /NOT RELEASED/);
});
const recipe: Recipe = {
  feedMode: 'automatic',
  destination: 'good',
  advance: 24,
  shortPart: true,
  measurementTolerance: 0.2,
  slipLimit: 0.5,
};
const feedback: Feedback = {
  stockAuthorized: true,
  autoModulePresent: true,
  manualGuardPresent: true,
  spindleStopped: true,
  manualLengthConfirmed: false,
  guardLocked: true,
  safetyHealthy: true,
  pressureOk: true,
  bladeDown: true,
  bladeUp: false,
  spindleAtSpeed: true,
  gripperClosed: true,
  gripperOpen: false,
  stockClosed: true,
  offcutClosed: true,
  clampsOpen: false,
  feedHome: true,
  partClear: false,
  driveHealthy: true,
  start: true,
  measurementValid: true,
  materialPresent: true,
  materialTravel: 0,
  axisTravel: 0,
  sideReleased: false,
  transferPressureOk: false,
  receiverHome: true,
  receiverLoaded: false,
  receiverEntryClear: false,
  chutePassage: false,
  boxPresent: true,
  goodRouteSelected: true,
  scrapRouteSelected: false,
};
const next = (phase: Parameters<typeof nextPhase>[0], f: Partial<Feedback> = {}, r = recipe) =>
  nextPhase(phase, { ...feedback, ...f }, r);
test('cycle confirms measured travel, both clamps, blade return and complete short-part transfer', () => {
  assert.equal(next('ready'), 'unclamping');
  assert.ok(step('ready', feedback, recipe).outputs.resetTravel);
  assert.ok(!step('unclamping', feedback, recipe).outputs.resetTravel);
  assert.equal(next('unclamping'), 'unclamping');
  assert.equal(next('unclamping', { clampsOpen: true }), 'feeding');
  assert.equal(
    next('feeding', { clampsOpen: true, materialTravel: 24, axisTravel: 24 }),
    'clamping',
  );
  assert.equal(next('clamping'), 'cutting');
  assert.equal(next('cutting', { bladeDown: false, bladeUp: true }), 'retracting');
  assert.equal(next('retracting', { bladeDown: false }), 'retracting');
  assert.equal(next('retracting'), 'releasing');
  assert.equal(next('releasing', { sideReleased: true }), 'releasing');
  assert.equal(next('releasing', { sideReleased: true, transferPressureOk: true }), 'transferring');
  const transfer = { sideReleased: true, transferPressureOk: true, receiverLoaded: true };
  assert.equal(
    next('transferring', transfer),
    'transferring',
    'leading edge alone must not tip a partly transferred part',
  );
  assert.equal(next('transferring', { ...transfer, receiverEntryClear: true }), 'sorting');
  assert.equal(next('sorting', { chutePassage: true }), 'resetting');
  assert.equal(next('resetting', { receiverLoaded: true }), 'resetting');
  assert.equal(next('resetting'), 'ungripping');
  assert.equal(next('ungripping'), 'ungripping');
  assert.ok(!commands('ungripping', recipe).feedReturn);
  assert.equal(next('ungripping', { gripperOpen: true }), 'returning');
  assert.equal(next('returning', { gripperOpen: true, gripperClosed: false }), 'ready');
  assert.ok(commands('transferring', recipe).offcutTop);
  assert.ok(commands('sorting', recipe).tiltReceiver);
});
test('long parts stay on level rollers; faults remove motion commands immediately', () => {
  const long = { ...recipe, shortPart: false };
  assert.equal(
    next('transferring', { sideReleased: true, transferPressureOk: true, partClear: true }, long),
    'ungripping',
  );
  assert.ok(!commands('sorting', long).tiltReceiver);
  assert.ok(commands('transferring', long).outletDrive);
  assert.ok(!commands('transferring', recipe).outletDrive);
  for (const f of [
    { bladeDown: false },
    { materialTravel: 25, axisTravel: 25 },
    { materialTravel: 23, axisTravel: 24 },
    { measurementValid: false },
    { materialTravel: NaN },
  ])
    assert.equal(next('feeding', { clampsOpen: true, ...f }), 'fault');
  for (const key of [
    'guardLocked',
    'safetyHealthy',
    'pressureOk',
    'driveHealthy',
    'stockClosed',
    'offcutClosed',
  ] as const)
    assert.equal(next('cutting', { [key]: false }), 'fault');
  assert.equal(next('cutting', { boxPresent: false }), 'fault');
  assert.equal(nextPhase('cutting', feedback, recipe, true), 'fault');
  assert.equal(next('fault'), 'fault');
  const result = step('transferring', { ...feedback, guardLocked: false }, recipe);
  assert.equal(result.phase, 'fault');
  assert.ok(
    !result.outputs.takeAway &&
      !result.outputs.receiverDrive &&
      !result.outputs.tiltReceiver &&
      !result.outputs.sawUp,
  );
});
test('tilt linkage stays inside the real ACE50X200SG stroke throughout its motion', () => {
  for (let angle = 0; angle <= 60; angle += 2) {
    const link = trayLink(angle);
    assert.ok(link.extension >= 0 && link.extension <= 200, `${angle}: ${link.extension}`);
    assert.ok(Math.abs(link.length - 293.5 - link.extension) < 1e-9);
  }
});
test('profile and discharge selections enforce physical operating limits', () => {
  assert.match(
    issues({ ...part.defaults, profile: 'square', angle: 45, cutLength: 500 }).join(),
    /blade sweep/,
  );
  assert.deepEqual(
    issues({
      ...part.defaults,
      profile: 'rectangular',
      tubeDiameter: 120,
      profileHeight: 110,
      angle: 45,
      cutLength: 500,
    }),
    [],
  );
  assert.ok(engineering({ ...part.defaults, cutLength: 20 }).shortPart);
  assert.ok(!engineering({ ...part.defaults, cutLength: 500 }).shortPart);
  assert.match(issues({ ...part.defaults, cutLength: 250, discharge: 'box' }).join(), /200 mm/);
  assert.ok(
    engineering({ ...part.defaults, profile: 'square' }).stockMass >
      engineering(part.defaults).stockMass,
  );
  assert.match(
    issues({ ...part.defaults, profile: 'rectangular', profileHeight: 6 }).join(),
    /open bore/,
  );
});
test('new catalog selections validate and render within advertised bounds', () => {
  for (const item of [blade, roller, pneumatic, controls, motors, measurement])
    for (const preset of item.presets) {
      const p = { ...item.defaults, ...preset.parameters };
      assert.deepEqual(validateParameters(item, p, 'default'), [], `${item.id}/${preset.id}`);
      const g = item.buildGeometry(p, 'assembled');
      try {
        const b = new Box3().setFromObject(g, true).getSize(new Vector3()).toArray();
        item
          .dimensions(p, 'assembled')
          .forEach((v, i) =>
            assert.ok(Math.abs(v - b[i]) < 0.05, `${item.id}/${preset.id}: ${v} vs ${b[i]}`),
          );
        g.traverse((c) => {
          if (c instanceof Mesh) assert.ok(c.geometry.getAttribute('position').count > 0);
        });
      } finally {
        disposeModel(g);
      }
    }
});
test('machine exports grouped components with honest procurement and nominal metal threads', () => {
  for (const preset of part.presets)
    for (const state of part.states!) {
      const p = { ...part.defaults, ...preset.parameters };
      assert.deepEqual(validateParameters(part, p, state.id), []);
      const pieces = machinePieces(p, state.id);
      assert.ok(pieces.length > 100);
      if (state.id === 'mechanism')
        assert.ok(!pieces.some((q) => q.group === 'Guards' || q.group === 'Workpiece'));
      const code = part.python(p, state.id);
      assert.match(code, /component_groups/);
      assert.match(code, /ENGINEERING_REVIEW_REQUIRED/);
      assert.doesNotMatch(code, /makeHelix/);
    }
});
test('default machine preview renders finite complete components', () => {
  const g = part.buildGeometry(part.defaults, 'mechanism');
  try {
    const b = new Box3().setFromObject(g, true).getSize(new Vector3());
    assert.ok(b.x > 2000 && b.z > 1000);
    let count = 0;
    g.traverse((c) => {
      if (c instanceof Mesh) {
        count++;
        for (const x of c.geometry.getAttribute('position').array) assert.ok(Number.isFinite(x));
      }
    });
    assert.ok(count > 100);
  } finally {
    disposeModel(g);
  }
});
test('feed carriage stays on both rails and clear of roller tables over the supported travel', () => {
  for (const cutLength of [20, 250, 500])
    for (const state of ['assembled', 'feeding']) {
      const pieces = machinePieces({ ...part.defaults, cutLength, fullStock: true }, state);
      const relevant = pieces.filter(
        (q) =>
          q.label.includes('HGW20CC') ||
          q.label.includes('HGR20') ||
          q.label.startsWith('Feed carriage') ||
          q.group === 'Roller tables' ||
          q.label.startsWith('Outfeed roller'),
      );
      const g = geometry(relevant);
      try {
        const bounds = g.children.map((c) => new Box3().setFromObject(c, true));
        const rails = relevant.flatMap((q, i) => (q.label.includes('HGR20') ? [bounds[i]] : []));
        for (let i = 0; i < relevant.length; i++) {
          const q = relevant[i],
            b = bounds[i];
          if (q.label.includes('HGW20CC'))
            assert.ok(
              rails.some(
                (r) =>
                  b.min.x >= r.min.x &&
                  b.max.x <= r.max.x &&
                  b.min.y < r.min.y &&
                  b.max.y > r.max.y,
              ),
              `${cutLength}/${state}: carriage outside rail`,
            );
          if (q.label.startsWith('Feed carriage'))
            relevant.forEach((other, j) => {
              if (other.group === 'Roller tables')
                assert.ok(
                  !b.intersectsBox(bounds[j]),
                  `${cutLength}/${state}: plate hits ${other.label}`,
                );
            });
        }
        assert.ok(
          relevant.some((q, i) => q.label.startsWith('Outfeed roller') && bounds[i].min.x > 0),
          'full-stock view must retain outfeed rollers',
        );
      } finally {
        disposeModel(g);
      }
    }
});
test(
  'native saw solids are valid and the blade clears fixed machinery at straight and mitre cut poses',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = [-45, -22.5, 0, 22.5, 45].flatMap((angle) =>
      [0, 50, 100].map((strokePosition) => ({
        angle,
        strokePosition,
        profile: 'round',
        tubeDiameter: 120,
        profileHeight: 120,
      })),
    );
    cases.push(
      ...['round', 'square', 'rectangular'].flatMap((profile) =>
        [0, 50, 100].map((strokePosition) => ({
          angle: 0,
          strokePosition,
          profile,
          tubeDiameter: 30,
          profileHeight: 30,
        })),
      ),
    );
    for (const settings of cases) {
      const state = 'stroke',
        angle = settings.angle;
      const code = part.python({ ...part.defaults, ...settings, cutLength: 500 }, state);
      const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input:
          'import FreeCAD as App\nimport Part,json\n' +
          code +
          `\nfor i,s in enumerate(components):\n    assert not s.isNull() and s.isValid() and s.Volume > 0, (i, component_labels[i])\nblade_index=next(i for i,l in enumerate(component_labels) if l.startswith('BUY Freud'))\nblade=components[blade_index]\nclashes=[]\nfor i,s in enumerate(components):\n    if i==blade_index or component_groups[i][-1]=='Workpiece': continue\n    if not blade.BoundBox.intersect(s.BoundBox): continue\n    v=blade.common(s).Volume\n    if v>0.05: clashes.append((i,component_labels[i],round(v,3)))\nassert not clashes, clashes\nmov=[i for i,l in enumerate(component_labels) if component_groups[i][-1] in ['Saw drive','Saw spindle'] or any(t in l for t in ['Saw moving backplate','Saw lift carriage bushing','Saw lift nut housing','Saw lift nut-to-carriage'])]\nclashes=[]\nfor i in mov:\n    for j,s in enumerate(components):\n        if j in mov or component_groups[j][-1]=='Workpiece': continue\n        if not components[i].BoundBox.intersect(s.BoundBox): continue\n        v=components[i].common(s).Volume\n        if v>0.05: clashes.append((component_labels[i],component_labels[j],round(v,3)))\nassert not clashes, clashes\nprint('SAW_NATIVE_OK',len(components))\n`,
        encoding: 'utf8',
        timeout: 240000,
      });
      assert.equal(r.status, 0, `${JSON.stringify(settings)}/${state}: ${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /SAW_NATIVE_OK/);
    }
  },
);

test(
  'native receiver clears fixed machinery in level and box-discharge poses',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    for (const state of ['assembled', 'sorting', 'rejecting']) {
      const code = part.python({ ...part.defaults, cutLength: 20 }, state);
      const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input:
          'import FreeCAD as App\nimport Part,json\n' +
          code +
          String.raw`
mov=[i for i,g in enumerate(component_groups) if g[-1]=='Tilting receiver']
clashes=[]
for i in mov:
    assert components[i].isValid() and components[i].Volume>0, component_labels[i]
    for j,s in enumerate(components):
        if j in mov or component_groups[j][-1]=='Workpiece': continue
        if not components[i].BoundBox.intersect(s.BoundBox):continue
        v=components[i].common(s).Volume
        if v>0.05:clashes.append((component_labels[i],component_labels[j],round(v,3)))
assert not clashes, clashes
print('RECEIVER_OK')
`,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${state}: ${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /RECEIVER_OK/);
    }
  },
);

test(
  'native feed gripper and ball nut clear fixed frame over carriage travel',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    for (const cutLength of [20, 500]) {
      const code = part.python({ ...part.defaults, cutLength }, 'feeding');
      const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input:
          'import FreeCAD as App\nimport Part,json\n' +
          code +
          String.raw`
mov=[i for i,l in enumerate(component_labels) if component_groups[i][-1]=='Feed gripper' or any(t in l for t in ['HGW20CC carriage','Feed carriage','SFU1605 nut','Ball nut carrier'])]
fixed=[i for i,l in enumerate(component_labels) if component_groups[i][-1] in ['Frame','Roller tables','Flat stock table'] or 'HGR20 rail' in l]
clashes=[]
for i in mov:
    assert components[i].isValid() and components[i].Volume>0, component_labels[i]
    for j in fixed:
        if j in mov:continue
        if not components[i].BoundBox.intersect(components[j].BoundBox):continue
        v=components[i].common(components[j]).Volume
        if v>0.05:clashes.append((component_labels[i],component_labels[j],round(v,3)))
assert not clashes, clashes
print('FEED_OK')
`,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${cutLength}: ${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /FEED_OK/);
    }
  },
);

test('manual module removes powered feed and side gripper; flat bed remains', () => {
  const p = { ...part.defaults, feedMode: 'manual' };
  const pieces = machinePieces(p, 'assembled');
  assert.ok(!pieces.some((q) => ['Feed axis', 'Feed gripper'].includes(q.group)));
  assert.ok(!pieces.some((q) => q.label.startsWith('Admission drive')));
  assert.ok(!pieces.some((q) => q.label.startsWith('Continuous infeed table')));
  assert.ok(
    !pieces.some((q) =>
      ['Powered outfeed', 'Stock separation module', 'Tilting receiver'].includes(q.group),
    ),
  );
  assert.ok(pieces.some((q) => q.label.includes('DDCS v4.1 fascia')));
  assert.equal(pieces.filter((q) => q.label.includes('latching emergency mushroom')).length, 1);
  assert.ok(
    !machinePieces(part.defaults, 'assembled').some((q) => q.label.includes('lower radius insert')),
  );
  const manual = { ...recipe, feedMode: 'manual' as const };
  for (const phase of [
    'ready',
    'feeding',
    'returning',
    'manual-loading',
    'cutting',
    'fault',
  ] as const) {
    const out = commands(phase, manual);
    assert.ok(!out.feedForward && !out.feedReturn && !out.grip);
  }
  assert.equal(next('ready', { spindleStopped: true }, manual), 'manual-loading');
  assert.equal(
    next('manual-loading', { guardLocked: false, spindleStopped: true }, manual),
    'manual-loading',
  );
  assert.equal(
    next(
      'manual-loading',
      { manualLengthConfirmed: true, spindleStopped: true, materialTravel: 24 },
      manual,
    ),
    'manual-clamping',
  );
  assert.equal(next('cutting', { guardLocked: false }, manual), 'fault');
  assert.equal(next('ready', { autoModulePresent: false }), 'fault');
  assert.equal(next('ready', { stockAuthorized: false }), 'fault');
});

test(
  'native flat stock support, nose bridge and admission gate clear their moving interfaces',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    for (const feedMode of ['automatic']) {
      const p = { ...part.defaults, feedMode, cutLength: 20 };
      const code = part.python(p, 'bar-change');
      const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input:
          'import FreeCAD as App\nimport Part\n' +
          code +
          String.raw`
for i,s in enumerate(components):
    assert s.isValid() and s.Volume>0,component_labels[i]
support=[s for i,s in enumerate(components) if any(t in component_labels[i] for t in ['Continuous infeed table','Steel cutting table','Stationary keyed throat','Flush steel nose','Take-away belt','Stock traction -'])]
for x in [-1600,-1400,-1100,-600,-500,-455,-420,-395,-350,-150,-20,-5,5,8,10,18,20,100,400,600]:
    for y in [-60,0,60]:
        assert any(s.isInside(App.Vector(x,y,899.99),0.00001,True) for s in support),(x,y,'unsupported table')
bridge=next(s for i,s in enumerate(components) if component_labels[i].startswith('Flush steel nose bridge'))
for i,s in enumerate(components):
    if component_groups[i][-1]=='Powered outfeed' and bridge.BoundBox.intersect(s.BoundBox):
        assert bridge.common(s).Volume<0.05,('bridge interference',component_labels[i])
gate=next(s for i,s in enumerate(components) if component_labels[i].startswith('Single-bar admission gate'))
fixed=[i for i,l in enumerate(component_labels) if component_groups[i][-1]=='Flat stock table' or any(t in l for t in ['Admission flat bridge','Admission table cross','Admission gate support','Admission shaft bearing','proof'])]
for angle in range(0,91,5):
    blade=gate.copy()
    blade.rotate(App.Vector(-1700,0,1070),App.Vector(0,1,0),-angle)
    for i in fixed:
        if blade.BoundBox.intersect(components[i].BoundBox):
            assert blade.common(components[i]).Volume<0.05,(angle,component_labels[i])
print('FLAT_TABLE_GATE_OK')
`,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${feedMode}: ${r.stdout}\n${r.stderr}`);
    }
  },
);

test('standalone completes its stopped manual cycle without discharge hardware', () => {
  const r = { ...recipe, feedMode: 'manual' as const };
  const absent = {
    receiverHome: false,
    boxPresent: false,
    autoModulePresent: false,
    spindleStopped: true,
  };
  assert.equal(next('ready', absent, r), 'manual-loading');
  assert.equal(
    next('manual-loading', { ...absent, guardLocked: false, manualLengthConfirmed: true }, r),
    'manual-clamping',
  );
  assert.ok(!commands('manual-clamping', r).requestSpindle);
  assert.equal(
    next('manual-clamping', { ...absent, stockClosed: true, offcutClosed: true }, r),
    'clamping',
  );
  assert.equal(
    next(
      'retracting',
      { ...absent, stockClosed: true, offcutClosed: true, spindleStopped: false },
      r,
    ),
    'stopping',
  );
  assert.ok(!commands('stopping', r).requestSpindle);
  assert.equal(next('stopping', { ...absent, stockClosed: true, offcutClosed: true }, r), 'ready');
  assert.ok(!commands('sorting', r).tiltReceiver);
});
test('assisted configuration has measuring feed and discharge but no automatic admission module', () => {
  const pieces = machinePieces({ ...part.defaults, feedMode: 'assisted' }, 'assembled');
  assert.ok(pieces.some((q) => q.group === 'Feed axis'));
  assert.ok(pieces.some((q) => q.group === 'Tilting receiver'));
  assert.ok(!pieces.some((q) => q.group === 'Stock separation module'));
});

test(
  'parked blade full yaw envelope clears the stationary table, conveyor and guards',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    for (const feedMode of ['manual', 'automatic']) {
      const code = part.python({ ...part.defaults, feedMode }, 'mitre-setup');
      const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input:
          'import FreeCAD as App\nimport Part\n' +
          code +
          String.raw`
# Conservative solid cylinder contains every orientation of the parked vertical blade.
# Clearing this volume proves clearance over continuous yaw, not just sampled angles.
sweep=Part.makeCylinder(252,504,App.Vector(0,0,318))
for i,s in enumerate(components):
    if component_groups[i][-1] not in ['Cutting fixtures','Powered outfeed','Tilting receiver','Guards']: continue
    if sweep.BoundBox.intersect(s.BoundBox):
        assert sweep.common(s).Volume<0.05,component_labels[i]
print('YAW_ENVELOPE_OK')
`,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${feedMode}: ${r.stdout}\n${r.stderr}`);
    }
  },
);

test(
  'fixed traction nip clears feed carriage, measuring wheel and closed hood',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const code = part.python({ ...part.defaults, cutLength: 500 }, 'feeding');
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input:
        'import FreeCAD as App\nimport Part\n' +
        code +
        String.raw`
clashes=[]
for i,l in enumerate(component_labels):
    if not l.startswith(('Stock traction -','Traction pressure -','Traction captive','Traction upper roller axle','Traction guided','Traction fork guide')):continue
    for j,s in enumerate(components):
        if component_groups[j][-1] in ['Workpiece','Fixed stock traction']:continue
        if not components[i].BoundBox.intersect(s.BoundBox):continue
        v=components[i].common(s).Volume
        if v>0.05:clashes.append((l,component_labels[j],round(v,3)))
assert not clashes,clashes
`,
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  },
);

test('facing cut retains stock while selecting the scrap bin and waits for route proof', () => {
  const r = { ...recipe, destination: 'scrap' as const };
  assert.ok(commands('releasing', r).selectScrap);
  assert.ok(commands('releasing', r).stockClamp);
  const f = { sideReleased: true, transferPressureOk: true };
  assert.equal(next('releasing', f, r), 'releasing');
  assert.equal(
    next('releasing', { ...f, goodRouteSelected: false, scrapRouteSelected: true }, r),
    'transferring',
  );
  assert.equal(
    next('transferring', { ...f, goodRouteSelected: false, scrapRouteSelected: false }, r),
    'fault',
  );
});
