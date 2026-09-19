import type { Parameters } from '../src/core/types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, Box3 } from 'three';
import part from '../src/parts/rocket-parachute-recovery/part';
import {
  motion,
  assessment,
  camPoint,
  releaseParameters,
  springDimensions,
  camLift,
} from '../src/parts/rocket-parachute-recovery/lib/motion';
import { pieces } from '../src/parts/rocket-parachute-recovery/lib/model';
import releasePresets from '../src/parts/rocket-release/presets.json';
import { material } from '../src/parts/rocket-release/lib/names';
import { fastenerCatalog } from '../src/parts/rocket-release/lib/fastener-catalog';

test('recovery uses the actual 2S library configuration and defaults to the supplied 1 kg mass', () => {
  assert.equal(part.defaults.noseMass, 1);
  const reference = releasePresets.find(
    (p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini',
  )!.parameters;
  const p = releaseParameters(part.defaults);
  for (const key of [
    'drive',
    'wingBattery',
    'pwmMountPitch',
    'pwmRowPitch',
    'pwmSplineDiameter',
    'wingHolePitchX',
    'wingHolePitchY',
  ])
    assert.equal(p[key], reference[key as keyof typeof reference]);
  const a = pieces(part.defaults, 'stowed');
  assert.equal(a.rigid.filter((x) => x.label.startsWith('BUY TowerPro MG996R')).length, 1);
  assert.ok(a.rigid.some((x) => x.label.includes('F405')));
  assert.ok(!a.rigid.some((x) => x.label.includes('Micro servo reserved')));
  assert.equal(a.rigid.filter((x) => x.label.startsWith('Enclosed compression spring ')).length, 4);
  assert.equal(a.rigid.filter((x) => x.label.startsWith('Guide ejector spring ')).length, 3);
  assert.ok(!a.rigid.some((x) => x.label.startsWith('Central cassette spring')));
  const plastic = a.rigid.filter((x) => x.label.includes('PTFE'));
  assert.ok(plastic.length > 0);
  for (const component of plastic) assert.equal(material(component), 'PTFE');
});
test('inspection states and packing restraint preserve the intended mechanism', () => {
  const base = pieces(part.defaults, 'stowed');
  const bare = pieces(part.defaults, 'mechanisms');
  const packing = pieces(part.defaults, 'packing');
  assert.equal(base.rigid.filter((x) => x.label.startsWith('Main body tube section')).length, 1);
  assert.ok(!base.rigid.some((x) => x.label.startsWith('Recovery bay tube extension')));
  assert.ok(
    !bare.rigid.some((x) =>
      /^(Main body tube section|Nose tube section|Hollow nose cone)/.test(x.label),
    ),
  );
  assert.equal(bare.flex.length, 0);
  assert.ok(pieces(part.defaults, 'no-shells').flex.length > 0);
  assert.equal(base.rigid.filter((x) => x.label.startsWith('Nose X-crossmember screw')).length, 4);
  assert.ok(!base.rigid.some((x) => x.label.includes('integral bridle lug')));
  assert.equal(
    base.rigid.filter((x) => x.label.startsWith('Upper guide support tube screw')).length,
    3,
  );
  assert.ok(!base.rigid.some((x) => x.label.startsWith('Removable packing')));
  assert.equal(packing.rigid.filter((x) => x.label.startsWith('Removable packing')).length, 1);
  assert.equal(motion(part.defaults, 'packing').springTravel, 0);
  assert.equal(motion(part.defaults, 'packing').lift, 0);
  assert.equal(motion(part.defaults, 'packing').noseLift, part.defaults.separation);
  for (const state of ['no-shells', 'mechanisms', 'packing'])
    assert.deepEqual(part.validate(part.defaults, state), []);
});
test('both cam laws keep followers on their rotating slot throughout the sweep', () => {
  for (const mechanism of ['spiral', 'sculpted-cam'])
    for (const camSweep of [75, 90, 105])
      for (let i = 0; i <= 100; i++) {
        const p = { ...part.defaults, mechanism, camSweep },
          f = i / 100,
          [x, y] = camPoint(p, f),
          a = (f * camSweep * Math.PI) / 180;
        assert.ok(Math.abs(x * Math.cos(a) - y * Math.sin(a) - (23 - 8 * camLift(p, f))) < 1e-8);
        assert.ok(Math.abs(x * Math.sin(a) + y * Math.cos(a)) < 1e-8);
      }
});
test('cam thrust and output screws have catalog purchase specifications', () => {
  const assembly = pieces({ ...part.defaults, mechanism: 'spiral' }, 'stowed');
  const screws = assembly.rigid.filter((p) =>
    /^(Cam thrust plate screw|MG996R cam retaining screw)/.test(p.label),
  );
  assert.equal(screws.length, 4);
  for (const p of screws)
    assert.ok(fastenerCatalog(p.shape, p.label)?.procurement.startsWith('BUY_'));
  for (const p of screws.filter((p) => p.label.startsWith('Cam thrust plate screw')))
    assert.equal(material(p), 'stainless steel A4');
});
test('unlock precedes lift; captive stroke cannot continue during extraction', () => {
  for (const p of part.presets) {
    assert.deepEqual(part.validate(p.parameters, 'assembled'), []);
    for (const sequence of [0, 15, 30])
      assert.equal(motion({ ...p.parameters, sequence }, 'assembled').lift, 0);
    for (const sequence of [55, 80, 100])
      assert.equal(
        motion({ ...p.parameters, sequence }, 'assembled').springTravel,
        p.parameters.springTravel,
      );
  }
});
test('energy includes a full bag-clearance path, gravity, friction and terminal velocity', () => {
  const p: Parameters = { ...part.defaults, mechanism: 'rotary-ring' },
    a = assessment(p);
  assert.equal(a.extractionDistance, 79.15);
  assert.ok(Math.abs(a.rate - 0.6800730010609569) < 1e-10);
  assert.ok(Math.abs(a.required - (17.76798 * 0.07915 + 0.6) * 1.5) < 1e-10);
  assert.ok(a.energyPass && a.torquePass && a.forcePass);
  assert.ok(!assessment({ ...p, noseMass: 3 }).energyPass);
  assert.ok(!assessment({ ...p, extractionForce: 30 }).energyPass);
  assert.ok(!assessment({ ...p, lockFriction: 0.4 }).torquePass);
  assert.ok(assessment({ ...p, thrustFriction: 0.2 }).torque > a.torque);
  assert.ok(!assessment({ ...p, packVoltage: 6.8 }).voltagePass);
  const d = springDimensions(p);
  assert.equal(d.closed - d.solid, 3);
  assert.equal(d.free - d.closed, +p.springTravel + +p.springPreload);
  assert.ok(
    assessment({ ...p, mechanism: 'sculpted-cam' }).torque >
      assessment({ ...p, mechanism: 'spiral' }).torque,
  );
  assert.ok(part.assessment!(p).some((x) => x.includes('UNVERIFIED')));
});
test('invalid fit and nonphysical inputs are rejected', () => {
  for (const delta of [
    { packDiameter: 60 },
    { tubeID: 88 },
    { noseMass: NaN },
    { springCoils: 25.5 },
    { mechanism: 'bad' },
    { bayLength: 120, packLength: 90 },
    { mechanism: 'spiral', packDiameter: 56 },
    { packDiameter: 51 },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...delta }, 'assembled').length);
});
test('shared detailed parts and new cams render finite geometry with unique component labels', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'stowed');
    model.updateMatrixWorld(true);
    assert.equal(new Set(model.children.map((c) => c.name)).size, model.children.length);
    model.traverse((o) => {
      if (o instanceof Mesh)
        for (const v of o.geometry.getAttribute('position').array) assert.ok(Number.isFinite(v));
    });
    const b = new Box3().setFromObject(model);
    assert.ok(b.max.z > 150);
    assert.ok(b.min.z <= -150);
  }
});

test(
  'native countersinks and captive ejector interfaces remain clear at both stroke limits',
  { skip: !process.env.FREECAD_PYTHON, timeout: 240_000 },
  async () => {
    const { spawnSync } = await import('node:child_process');
    const { python } = await import('../src/parts/rocket-release/lib/assembly');
    const jobs = [];
    for (const mechanism of ['rotary-ring', 'spiral'])
      for (const sequence of [0, 55]) {
        const components = pieces({ ...part.defaults, mechanism, sequence }, 'assembled').rigid;
        jobs.push({
          id: `${mechanism}/${sequence}`,
          code: python(
            components.filter((p) =>
              /^(Cam cassette thrust plate|Cam thrust plate screw|Captive cassette pusher|Ejector guide rod|Ejector stop|Guide ejector spring|Upper ejector|Upper guide|Ejected parachute|Pusher central|Cassette central|Packing pin support)/.test(
                p.label,
              ),
            ),
          ),
        });
      }
    const result = spawnSync(
      process.env.FREECAD_PYTHON!,
      [
        '-c',
        `
import FreeCAD as App, Part, math, json, sys
for job in json.load(sys.stdin):
    env=dict(App=App,Part=Part,math=math)
    exec(job['code'],env)
    shapes=env['components']; labels=env['component_labels']
    for i,a in enumerate(shapes):
        assert a.isValid() and len(a.Solids)==1,(job['id'],labels[i])
        for j,b in enumerate(shapes[:i]):
            aa,bb=a.BoundBox,b.BoundBox
            if any(min(getattr(aa,d+'Max'),getattr(bb,d+'Max'))-max(getattr(aa,d+'Min'),getattr(bb,d+'Min'))<1e-6 for d in 'XYZ'): continue
            assert a.common(b).Volume<1e-3,(job['id'],labels[i],labels[j])
    print(job['id']+': clear',flush=True)
`,
      ],
      { input: JSON.stringify(jobs), encoding: 'utf8', timeout: 230_000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr + String(result.error ?? ''));
  },
);

test('AirBrakes is the default selection and latch inspection exposes the double-shear joint', async () => {
  const { defaultPartSelection } = await import('../src/core/part-selection');
  assert.equal(defaultPartSelection(part).presetId, 'spiral-90');
  assert.equal(part.defaults.mechanism, 'spiral');
  assert.equal(part.presets[0].id, 'spiral-90');
  const section = pieces(part.defaults, 'latch-section');
  assert.deepEqual(part.validate(part.defaults, 'latch-section'), []);
  assert.equal(section.flex.length, 0);
  assert.equal(section.rigid.filter((p) => p.label.startsWith('Retracting hook')).length, 3);
  assert.ok(section.rigid.some((p) => p.label.includes('INSPECTION SECTION ONLY')));
  assert.ok(
    !pieces(part.defaults, 'assembled').rigid.some((p) => p.label.includes('INSPECTION SECTION')),
  );
});

test(
  'native AirBrakes hooks block axial separation when locked and clear the receiver when released',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  async () => {
    const { spawnSync } = await import('node:child_process');
    const { python } = await import('../src/parts/rocket-release/lib/assembly');
    const { pythonShape } = await import('../src/parts/rocket-release/lib/shapes');
    const jobs = [];
    for (const mechanism of ['spiral', 'sculpted-cam'])
      for (const sequence of [0, 7.5, 15, 22.5, 30]) {
        const components = pieces(
          { ...part.defaults, mechanism, sequence },
          'assembled',
        ).rigid.filter((p) =>
          /^(Body hook locking|Nose cam and servo|Threaded spring barrel|Piston contact button|Retracting hook|Hook guide cover|MG996R (linear|eased)|Cam follower sleeve)/.test(
            p.label,
          ),
        );
        jobs.push({
          id: `${mechanism}/${sequence}`,
          sequence,
          components: components.map((p) => ({ label: p.label, code: pythonShape(p.shape) })),
        });
      }
    const result = spawnSync(
      process.env.FREECAD_PYTHON!,
      [
        '-c',
        `
import FreeCAD as App, Part, math, json, sys
payload=json.load(sys.stdin)
exec(payload['helpers'])
cache={}
tested=set()
for job in payload['jobs']:
    shapes=[]; labels=[]
    for item in job['components']:
        key=item['code']
        if key not in cache: cache[key]=eval(key).removeSplitter()
        shapes.append(cache[key]); labels.append(item['label'])
    receiver=shapes[next(i for i,l in enumerate(labels) if l.startswith('Body hook'))]
    nose=shapes[next(i for i,l in enumerate(labels) if l.startswith('Nose cam and servo'))]
    if job['sequence']==30:
        for dz in [0,.15,.3,.5,1,2,3,4,5,6,8,10,20,30]:
            lifted=nose.copy(); lifted.translate(App.Vector(0,0,dz))
            assert lifted.common(receiver).Volume<1e-3,(job['id'],dz,'released nose cheeks blocked')
    for i,a in enumerate(shapes):
        assert a.isValid() and len(a.Solids)==1,(job['id'],labels[i],'invalid solid')
        for j,b in enumerate(shapes[:i]):
            pair=(job['components'][i]['code'],job['components'][j]['code'])
            if pair in tested: continue
            tested.add(pair)
            if a.BoundBox.intersect(b.BoundBox):
                assert a.common(b).Volume<1e-3,(job['id'],labels[i],labels[j],'collision')
        if not labels[i].startswith('Retracting hook'): continue
        contact=a.copy(); contact.translate(App.Vector(0,0,.15))
        assert contact.common(receiver).Volume<1e-3,(job['id'],'axial take-up collision')
        if job['sequence']==0:
            assert abs(contact.distToShape(receiver)[0])<1e-5,(job['id'],'no body eye contact')
            blocked=a.copy(); blocked.translate(App.Vector(0,0,.25))
            assert blocked.common(receiver).Volume>1.5,(job['id'],'hook does not retain nose')
            nose=shapes[next(k for k,l in enumerate(labels) if l.startswith('Nose cam and servo'))]
            bearing=a.copy(); bearing.translate(App.Vector(0,0,-.25))
            support=bearing.common(nose)
            assert len(support.Solids)==2 and all(s.Volume>1.5 for s in support.Solids),(job['id'],'blade is not supported by both cheeks')
        if job['sequence']==30:
            for dz in [0,.3,.5,1,2,3,4,5,6,8,10,20,30]:
                released=a.copy(); released.translate(App.Vector(0,0,dz))
                assert released.common(receiver).Volume<1e-3,(job['id'],dz,'released hook blocked')
            assert receiver.distToShape(a)[0]>.49,(job['id'],'insufficient corner clearance')
    print(job['id']+': latch verified',flush=True)
`,
      ],
      {
        input: JSON.stringify({ helpers: python([]), jobs }),
        encoding: 'utf8',
        timeout: 590_000,
        maxBuffer: 1024 * 1024,
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr + String(result.error ?? ''));
  },
);

test('both hook bearing faces contribute friction and the eased cam limits peak torque', () => {
  const linear = assessment(part.defaults);
  const eased = assessment({ ...part.defaults, mechanism: 'sculpted-cam' });
  assert.ok(linear.torquePass && eased.torquePass);
  assert.ok(Math.abs(eased.torque / linear.torque - 1 / 0.9) < 1e-9);
  assert.ok(!assessment({ ...part.defaults, hookGuideFriction: 0.4 }).torquePass);
  for (let i = 1; i < 1000; i++) {
    const f = i / 1000,
      h = 1e-5;
    const slope =
      (camLift({ ...part.defaults, mechanism: 'sculpted-cam' }, f + h) -
        camLift({ ...part.defaults, mechanism: 'sculpted-cam' }, f - h)) /
      (2 * h);
    assert.ok(slope >= 0 && slope <= 1 / 0.9 + 1e-6);
  }
});

test('double-shear screening separates external retention load from ejection energy', () => {
  const base = assessment(part.defaults);
  const heavy = assessment({ ...part.defaults, retentionLoad: 2000 });
  assert.equal(heavy.retentionForce - base.retentionForce, 1000);
  assert.equal(heavy.energy, base.energy);
  assert.equal(heavy.torque, base.torque);
  assert.ok(heavy.bladeShear > base.bladeShear && heavy.bladeBending > base.bladeBending);
  assert.equal(base.eyeBearing, 2 * base.cheekBearing);
  assert.ok(part.assessment!(part.defaults).some((x) => x.includes('No strength PASS')));
});
