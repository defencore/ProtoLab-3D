import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Box3, Euler, Vector3 } from 'three';
import motor, {
  feedServoParameters,
  feedServoLayout,
  feedServoMountingHoles,
} from '../src/parts/cnc-feed-servo/part';
import driver, {
  servoDriveLayout,
  servoDriveMountingHoles,
} from '../src/parts/cnc-servo-drive/part';
import nut, {
  precisionNutLayout,
  precisionNutMountingHoles,
  precisionNutParameters,
} from '../src/parts/cnc-precision-nut/part';
import screw, {
  precisionScrewLayout,
  precisionScrewParameters,
} from '../src/parts/cnc-precision-screw/part';
import support, {
  precisionSupportLayout,
  precisionSupportMountingHoles,
  precisionSupportParameters,
} from '../src/parts/cnc-precision-support/part';
import coupling, {
  precisionCouplingLayout,
  precisionCouplingParameters,
} from '../src/parts/cnc-precision-coupling/part';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import type { PartDefinition, Parameters } from '../src/core/types';
import bolt from '../src/parts/bolt-screw/part';
import { precisionDriveInterfaces } from '../src/parts/cnc-milling-machine/lib/precision-drives';
import {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/lib/composition';
import { millingLayout } from '../src/parts/cnc-milling-machine/lib/layout';
import machine from '../src/parts/cnc-milling-machine/part';
import frame from '../src/parts/cnc-frame-part/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import kit, {
  precisionAxisParameters,
  precisionAxisComponents,
} from '../src/parts/cnc-precision-axis/part';

const definitions = [motor, driver, nut, screw, support, coupling];
test('precision support ordering requests the maker-recommended C3 execution without delivery approval', () => {
  for (const preset of support.presets) {
    assert.match(preset.id, /^(bk|bf)(15|20)-c3$/);
    assert.equal(preset.parameters.model, preset.id);
    assert.match(preset.catalog!.geometryEvidence!.limitations!, /not a delivered certificate/);
    assert.match(preset.catalog!.specifications![0].value, /C3.*C3 ground screw/);
  }
  assert.ok(support.product.releaseRequirements.some((r) => /delivered certificates/.test(r)));
});
test('source-specific precision drive presets retain full configurations and explicit unapproved order requirements', () => {
  for (const part of definitions)
    for (const row of part.presets) {
      assert.deepEqual(
        validateParameters(part, row.parameters, 'default'),
        [],
        `${part.id}/${row.id}`,
      );
      assert.ok(row.catalog?.sourceUrl.startsWith('https://'));
      assert.ok(row.catalog?.geometryEvidence?.limitations);
      assert.ok(row.catalog?.geometryEvidence?.sourceSha256);
      assert.ok(part.product.releaseRequirements.length >= 3);
    }
  assert.equal(nut.presets[0].catalog?.attributes?.nominalShaft, 25);
  assert.match(nut.notes!, /10%/);
  assert.ok(nut.presets[0].catalog?.geometryEvidence?.limitations.includes('3%'));
});
test('actual Delta flange/key/tip and factory-brake interfaces are distinct without holding/running torque confusion', () => {
  const a = feedServoLayout(feedServoParameters()),
    b = feedServoLayout(feedServoParameters('ecm-a3h-c20807ss1'));
  assert.equal(a.bodyLength, 115.8);
  assert.equal(b.bodyLength, 153.2);
  assert.equal(b.brakeTorqueNm, 2.5);
  assert.equal(a.brakeTorqueNm, 0);
  assert.equal(a.ratedTorqueNm, 2.39);
  assert.equal(a.peakTorqueNm, 8.36);
  assert.equal(a.shaftEnd - a.usableShaftStart, 37);
  assert.equal(a.tipThreadDepth, 10);
  for (const [x, y, z] of feedServoMountingHoles()) {
    assert.equal(z, 0);
    assert.ok(Math.abs(Math.hypot(x, y) - 45) < 1e-9);
  }
  assert.equal(servoDriveLayout().mountPitch, 172.5);
  assert.equal(servoDriveMountingHoles()[1][2] - servoDriveMountingHoles()[0][2], 172.5);
});
test('FDI flanges derive six true30degree mounting holes and body-side fit land rather than generic SFU geometry', () => {
  for (const model of ['r25-10t3-fdi', 'r20-5t3-fdi'] as const) {
    const p = precisionNutParameters(model),
      v = precisionNutLayout(p),
      holes = precisionNutMountingHoles(p);
    assert.equal(v.fitStart, 0);
    assert.equal(v.fitEnd, 24);
    assert.equal(v.maximum - v.minimum, v.length);
    assert.equal(holes.length, 6);
    assert.ok(
      holes.every(
        ([x, y, z]) => x === 0 && Math.abs(Math.hypot(y, z) - v.mountingCircle / 2) < 1e-9,
      ),
    );
    assert.ok(Math.abs((Math.atan2(holes[0][2], holes[0][1]) * 180) / Math.PI - 30) < 1e-9);
  }
});
test('published15/20 bearing journals, real retention spans and22mm coupling fit remain coaxial', () => {
  for (const model of ['r25-10t3-fdi', 'r20-5t3-fdi'] as const) {
    const p = precisionScrewParameters(model, model === 'r25-10t3-fdi' ? 1800 : 460),
      v = precisionScrewLayout(p),
      large = model === 'r25-10t3-fdi';
    const fixed = precisionSupportLayout(precisionSupportParameters(large ? 'bk20-c3' : 'bk15-c3'));
    const free = precisionSupportLayout(precisionSupportParameters(large ? 'bf20-c3' : 'bf15-c3'));
    assert.equal(v.fixedSupportCenter + fixed.shoulderContact, v.fixedShoulder);
    assert.equal(v.freeSupportCenter + free.shoulderContact, v.freeShoulder);
    assert.equal(fixed.shaftDiameter, v.fixedJournal.diameter);
    assert.equal(free.shaftDiameter, v.freeJournal.diameter);
    assert.equal(v.overallLength, v.maximum - v.minimum);
    assert.equal(v.fixedJournal.end - v.fixedJournal.start, large ? 53 : 40);
    assert.equal(v.freeJournal.end - v.freeJournal.start, large ? 16 : 13);
    const c = precisionCouplingLayout(precisionCouplingParameters(large ? 20 : 15));
    assert.equal(c.screwBore, v.driveJournal.diameter);
    assert.equal(c.motorBore, feedServoLayout(motor.defaults).shaftDiameter);
    assert.ok(c.hubLength <= v.driveJournal.end - v.driveJournal.start);
    assert.ok(c.hubLength <= 40 - 3);
    assert.equal(c.torsionalNmPerRad, 20000);
    assert.equal(c.inertiaKgM2, 6e-5);
    assert.ok(
      precisionSupportMountingHoles(precisionSupportParameters(fixed.model)).every(
        (h) => h[2] === fixed.bottom,
      ),
    );
  }
});
test('actual widened portal determines X extension and leaves the source shaft/key inside both coupling hubs', () => {
  const v = millingLayout(machine.defaults),
    axes = precisionDriveInterfaces(v);
  const x = axes.find((a) => a.id === 'x')!;
  assert.ok(x.motorFace + 26 <= -v.sideCenterX - v.sideThickness / 2 - 20);
  assert.equal(x.layout.fixedJournal.start, -v.racewayX / 2 - 53);
  assert.ok(x.layout.driveExtension >= 90);
  for (const a of axes) {
    assert.equal(a.couplingCenter + 7.5, a.layout.driveJournal.start);
    assert.equal(a.couplingCenter + 29.5, a.layout.driveJournal.start + 22);
    assert.equal(a.motorFace + 18, a.couplingCenter - 29.5);
    assert.equal(a.motorFace + 40, a.couplingCenter - 7.5);
  }
});
test('matched supplier set is one purchased parent with two real configured physical library children', () => {
  for (const axis of precisionDriveInterfaces(millingLayout(machine.defaults))) {
    const flange = axis.id === 'z' ? 11.5 : -55,
      p = precisionAxisParameters(
        axis.model,
        axis.layout.racewayLength,
        axis.layout.driveExtension,
        flange,
        axis.id === 'z',
      );
    assert.deepEqual(validateParameters(kit, p, 'default'), []);
    assert.equal(kit.product.supply, 'purchased');
    const children = precisionAxisComponents(p);
    assert.deepEqual(
      children.map((c) => c.libraryId),
      ['cnc-precision-screw', 'cnc-precision-nut'],
    );
    assert.equal(children[0].parameters.racewayLength, axis.layout.racewayLength);
    assert.equal(children[1].placement.translation[0], flange);
    assert.equal(children[1].placement.rotation[1], axis.id === 'z' ? 180 : 0);
    assert.equal(children.length, 2);
  }
});
test('central Z retains source interfaces on actual shims and a bolted in-plane servo carrier', () => {
  const v = millingLayout(machine.defaults),
    rows = millingComponents(machine.defaults),
    get = (id: string) => {
      const row = rows.find((r) => r.component.id === id);
      assert.ok(row, id);
      return row.component;
    };
  assert.equal(v.zScrewX, 0);
  assert.equal(v.zScrewY, 178);
  assert.equal(get('z-drive-screw').parameters.driveExtension, 20);
  for (const [kind, sourceLength] of [
    ['fixed', 27],
    ['free', 20],
  ] as const) {
    const shim = get(`z-${kind}-support-shim`);
    assert.deepEqual(
      [shim.parameters.sizeX, shim.parameters.sizeY, shim.parameters.sizeZ],
      [sourceLength, 70, 5],
    );
    assert.deepEqual(frame.validate!(shim.parameters, shim.state), []);
    const bolts = rows.filter((r) => r.component.id.startsWith(`z-support-${kind}-bolt-`));
    assert.equal(bolts.length, kind === 'fixed' ? 4 : 2);
    assert.ok(
      bolts.every(
        (r) => r.component.parameters.diameter === 6 && r.component.parameters.length === 45,
      ),
    );
  }
  assert.ok(
    !rows.some((r) => /^z-support-datum|^z-(fixed|free)-support-platform/.test(r.component.id)),
  );
  const bridge = get('z-servo-tower-bridge');
  assert.deepEqual(
    [bridge.parameters.sizeX, bridge.parameters.sizeY, bridge.parameters.sizeZ],
    [v.fixedPlateWidth, 110, 20],
  );
  assert.deepEqual(frame.validate!(bridge.parameters, bridge.state), []);
  const opening = JSON.parse(String(bridge.parameters.holes)).find(
    (h: { diameter: number }) => h.diameter === 51,
  );
  assert.ok(opening);
  const carrier = get('z-servo-structural-carrier');
  for (const i of [0, 1, 2]) {
    const column = get(`z-servo-tower-column-${i}`);
    assert.deepEqual(
      [column.parameters.sizeX, column.parameters.sizeY, column.parameters.sizeZ],
      [20, 20, 24],
    );
    assert.ok(
      Math.abs(column.placement.translation[0] - carrier.placement.translation[0]) + 10 <= 125,
    );
    assert.ok(
      Math.abs(column.placement.translation[1] - carrier.placement.translation[1]) + 10 <= 125,
    );
  }
  const xBracket = get('x-nut-bracket');
  assert.equal(xBracket.parameters.cornerReliefRadius, 35);
  assert.deepEqual(frame.validate!(xBracket.parameters, xBracket.state), []);
});
test('actual servo flange nuts seat on the carrier and engage their whole height with tip reserve', () => {
  const rows = millingComponents(machine.defaults);
  for (const axis of precisionDriveInterfaces(millingLayout(machine.defaults))) {
    const direction = new Vector3(1, 0, 0).applyEuler(
      new Euler(...(axis.r.map((n) => (n * Math.PI) / 180) as [number, number, number]), 'ZYX'),
    );
    const nuts = rows.filter((r) => r.component.id.startsWith(axis.id + '-servo-flange-nut-'));
    assert.equal(nuts.length, 4);
    for (const row of nuts) {
      const c = row.component,
        face = new Vector3(...c.placement.translation).sub(new Vector3(...axis.at)).dot(direction),
        height = Number(c.parameters.height),
        normal = new Vector3(0, 0, 1).applyEuler(
          new Euler(
            ...(c.placement.rotation.map((n) => (n * Math.PI) / 180) as [number, number, number]),
            'ZYX',
          ),
        );
      assert.ok(
        Math.abs(face - axis.motorFace - 26) < 1e-8,
        c.id + ' must bear on the actual carrier face',
      );
      assert.ok(normal.dot(direction) > 1 - 1e-9, c.id + ' must extend away from the carrier');
      const bolt = rows.find((r) => r.component.id === c.id.replace('-nut-', '-bolt-'))!.component;
      const tip = axis.motorFace - 8 + Number(bolt.parameters.length);
      assert.equal(height, 5);
      assert.ok(
        tip - (face + height) >= 0.5,
        c.id + ' must engage the whole nut and protrude beyond it',
      );
    }
  }
});
test('new drive preview envelopes match reported dimensions in Simple and Full', () => {
  for (const mode of ['simple', 'full'] as const)
    for (const part of definitions)
      for (const preset of part.presets) {
        if (part === screw && preset.parameters.racewayLength === 1800) continue;
        const object = withGeometryMode(mode, () =>
          part.buildGeometry(preset.parameters, 'default'),
        );
        try {
          const size = new Box3().setFromObject(object, true).getSize(new Vector3()).toArray();
          const expected = part.dimensions(preset.parameters, 'default');
          for (let i = 0; i < 3; i++)
            assert.ok(
              Math.abs(size[i] - expected[i]) < 0.05,
              `${part.id}/${preset.id}/${mode}: ${size} vs ${expected}`,
            );
        } finally {
          disposeModel(object);
        }
      }
});
test(
  'optional native source interfaces keep valid closed subdivisions and strict shaft/key/support mating',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const scripts: string[] = ['import FreeCAD as App, Part, math, json\nresults=[]'];
    function caseScript(part: PartDefinition, p: Parameters, mode: 'simple' | 'full', tag: string) {
      scripts.push(withGeometryMode(mode, () => part.python(p, 'default')));
      scripts.push(
        `assert len(components)>0\nfor i,s in enumerate(components):\n    assert not s.isNull() and len(s.Solids)>0 and s.isValid() and s.isClosed() and math.isfinite(s.Volume) and s.Volume>0, ${JSON.stringify(tag)}+str(i)\nresults.append({'case':${JSON.stringify(tag)},'componentCount':len(components),'volume':sum(s.Volume for s in components)})`,
      );
    }
    for (const mode of ['simple', 'full'] as const) {
      for (const part of definitions)
        for (const preset of part.presets) {
          const p =
            part === screw ? { ...preset.parameters, racewayLength: 200 } : preset.parameters;
          caseScript(part, p, mode, part.id + '/' + preset.id + '/' + mode);
          if (part === motor)
            scripts.push(
              `motor_components=list(components)\nfor i in range(len(components)):\n    for j in range(i+1,len(components)):\n        c=components[i].common(components[j])\n        assert math.isfinite(c.Volume) and abs(c.Volume)<=.001, ('motor/key overlap',i,j,c.Volume)`,
            );
        }
      for (const model of ['r25-10t3-fdi', 'r20-5t3-fdi'] as const) {
        const p = precisionScrewParameters(model, 200),
          v = precisionScrewLayout(p),
          large = model === 'r25-10t3-fdi';
        scripts.push(
          withGeometryMode(mode, () => screw.python(p, 'default')),
          '_pl_actual_shaft=shape.copy()',
        );
        for (const fixed of [true, false]) {
          const sp = precisionSupportParameters(
            large ? (fixed ? 'bk20-c3' : 'bf20-c3') : fixed ? 'bk15-c3' : 'bf15-c3',
          );
          scripts.push(withGeometryMode(mode, () => support.python(sp, 'default')));
          scripts.push(
            `for i,c in enumerate(components):\n    s=c.copy()\n    s.translate(App.Vector(${fixed ? v.fixedSupportCenter : v.freeSupportCenter},0,0))\n    common=s.common(_pl_actual_shaft)\n    assert math.isfinite(common.Volume) and abs(common.Volume)<=.001, (${JSON.stringify(model + '/' + String(sp.model) + '/' + mode)},i,common.Volume)\n    if common.Solids: assert common.isValid() and common.isClosed()\nresults.append({'case':${JSON.stringify('shaft-support/' + model + '/' + String(sp.model) + '/' + mode)},'passed':True})`,
          );
        }
      }
      for (const axis of precisionDriveInterfaces(millingLayout(machine.defaults))) {
        const mp = feedServoParameters(axis.id === 'z' ? 'ecm-a3h-c20807ss1' : 'ecm-a3h-c20807rs1');
        scripts.push(
          withGeometryMode(mode, () => motor.python(mp, 'default')),
          `_pl_installed_motor=[q.copy() for q in components]\nfor q in _pl_installed_motor:\n    q.rotate(App.Vector(),App.Vector(0,1,0),90)\n    q.translate(App.Vector(${axis.motorFace},0,0))`,
        );
        scripts.push(
          withGeometryMode(mode, () =>
            coupling.python(precisionCouplingParameters(axis.id === 'z' ? 15 : 20), 'default'),
          ),
          `for q in components: q.translate(App.Vector(${axis.couplingCenter},0,0))\nfor i,a in enumerate(_pl_installed_motor):\n    for j,b in enumerate(components):\n        c=a.common(b)\n        assert math.isfinite(c.Volume) and abs(c.Volume)<=.001, ('installedmotor/key/coupling',${JSON.stringify(axis.id + '/' + mode)},i,j,c.Volume)\n        if c.Solids: assert c.isValid() and c.isClosed()\nresults.append({'case':${JSON.stringify('installedmotor/key/coupling/' + axis.id + '/' + mode)},'passed':True})`,
        );
      }
    }
    const output = '/tmp/protolab-cnc-precision-native.json',
      source = '/tmp/protolab-cnc-precision-native.py';
    scripts.push(
      `open(${JSON.stringify(output)},'w').write(json.dumps(results,indent=2,allow_nan=False))`,
    );
    const script = scripts.join('\n');
    writeFileSync(source, script);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [source], {
      encoding: 'utf8',
      env: process.env,
      timeout: 900000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    assert.ok(existsSync(output));
    const measurements = JSON.parse(readFileSync(output, 'utf8'));
    writeFileSync(
      '/tmp/protolab-cnc-precision-native-proof.json',
      JSON.stringify(
        {
          executedSourceSha256: createHash('sha256').update(script).digest('hex'),
          cases: measurements,
        },
        null,
        2,
      ),
    );
    assert.equal(measurements.length, 42);
  },
);
test(
  'optional native real-length matched kits retain valid source shaft/nut solids and ordered geometry',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const lines = ['import FreeCAD as App, Part, math, json', 'results=[]'];
    for (const axis of precisionDriveInterfaces(millingLayout(machine.defaults))) {
      const p = precisionAxisParameters(
        axis.model,
        axis.layout.racewayLength,
        axis.layout.driveExtension,
        axis.id === 'z' ? 11.5 : -55,
        axis.id === 'z',
      );
      const shaft = axis.layout;
      lines.push(
        withGeometryMode('full', () => kit.python(p, 'default')),
        `assert len(components)==2\nfor i,q in enumerate(components):\n    assert not q.isNull() and q.isValid() and q.isClosed() and len(q.Solids)==1 and math.isfinite(q.Volume) and q.Volume>0, (${JSON.stringify(axis.id)},i)\nfeatures=json.loads(component_metadata[0]['ThreadFeaturesJSON'])\nassert len(features)==1 and features[0]['nominalDiameter']==${shaft.thread.diameter} and features[0]['pitch']==1 and features[0]['length']==${shaft.thread.end - shaft.thread.start} and features[0]['representation']=='machined-helix',('retention machining callout',features)\nassert abs(components[0].BoundBox.XMin-${shaft.minimum})<.00001 and abs(components[0].BoundBox.XMax-${shaft.maximum})<.00001,('authored shaft end datums',${JSON.stringify(axis.id)})\nassert components[0].isInside(App.Vector(${shaft.thread.start + 3},0,${-shaft.thread.diameter / 2 + 0.1}),.000001,False),('retained thread crest',${JSON.stringify(axis.id)})\nassert not components[0].isInside(App.Vector(${shaft.thread.start + 3},0,${shaft.thread.diameter / 2 - 0.1}),.000001,False),('retention groove must be physically removed',${JSON.stringify(axis.id)})\nresults.append({'axis':${JSON.stringify(axis.id)},'parameters':json.loads(${JSON.stringify(JSON.stringify(p))}),'volumesMm3':[q.Volume for q in components],'componentCount':len(components),'retentionFeature':features[0],'physicalCrestAndGrooveChecked':True})`,
      );
    }
    const path = '/tmp/protolab-cnc-precision-kits-native.py',
      out = '/tmp/protolab-cnc-precision-kits-native.json';
    lines.push(
      `open(${JSON.stringify(out)},'w').write(json.dumps(results,indent=2,allow_nan=False))`,
    );
    const source = lines.join('\n');
    writeFileSync(path, source);
    const r = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 900000,
    });
    assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
    const results = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(results.length, 3);
    writeFileSync(
      '/tmp/protolab-cnc-precision-kits-native-proof.json',
      JSON.stringify(
        { executedSourceSha256: createHash('sha256').update(source).digest('hex'), results },
        null,
        2,
      ),
    );
  },
);
test(
  'optional native central Z support and servo bridge assembly retains real closed geometry and strict installed mating',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const rows = millingComponents(machine.defaults).filter(
      (r) =>
        r.component.id === 'x-z-fixed-saddle' ||
        r.component.id === 'z-bk15' ||
        r.component.id === 'z-bf15' ||
        r.component.id.startsWith('z-support-') ||
        /^z-(fixed|free)-support-shim$/.test(r.component.id) ||
        r.component.id.startsWith('z-servo-') ||
        r.component.id === 'z-axis-motor' ||
        r.component.id === 'z-precision-coupling',
    );
    assert.ok(
      rows.length >= 30,
      'The fixture must include real source supports, tower, bridge, thermal/carrier stack and bolts.',
    );
    const results: unknown[] = [];
    for (const mode of ['simple', 'full'] as const) {
      const source = withGeometryMode(mode, () => componentPython(millingLibraries, rows)),
        script = `import FreeCAD as App, Part, math, json\n${source}
ids=json.loads(${JSON.stringify(JSON.stringify(rows.map((r) => r.component.id)))})
assert len(components)==len(ids)
for i,q in enumerate(components):
    assert not q.isNull() and q.Solids and q.isValid() and q.isClosed() and math.isfinite(q.Volume) and q.Volume>0,ids[i]
byid={id:q for id,q in zip(ids,components)}
carrier=byid['z-servo-structural-carrier']
def bearing_faces(q):
    return [f for f in q.Faces if isinstance(f.Surface,Part.Plane) and abs(f.normalAt(0,0).z)>1-1e-9]
carrier_face=min(bearing_faces(carrier),key=lambda f:f.CenterOfMass.z)
nut_stacks=[]
for k in range(4):
    n=byid['z-servo-flange-nut-'+str(k)];b=byid['z-servo-flange-bolt-'+str(k)]
    nf=bearing_faces(n);upper=max(nf,key=lambda f:f.CenterOfMass.z);lower=min(nf,key=lambda f:f.CenterOfMass.z)
    tip=min(f.CenterOfMass.z for f in bearing_faces(b))
    assert abs(upper.CenterOfMass.z-carrier_face.CenterOfMass.z)<1e-7,('actual planar nut bearing seat',k)
    assert abs(upper.CenterOfMass.z-lower.CenterOfMass.z-5)<1e-7,('actual whole nut height',k)
    area=upper.common(carrier_face).Area
    assert math.isfinite(area) and area>=20,('real bearing face area',k,area)
    protrusion=lower.CenterOfMass.z-tip
    assert protrusion>=.5,('whole nut engagement/tip protrusion',k)
    nut_stacks.append({'nut':k,'seatZ':upper.CenterOfMass.z,'nutHeightMm':upper.CenterOfMass.z-lower.CenterOfMass.z,'bearingAreaMm2':area,'boltTipProtrusionMm':protrusion})
cases=[];overlaps=[]
for i,a in enumerate(components):
 for j in range(i+1,len(components)):
    b=components[j];ab=a.BoundBox;bb=b.BoundBox
    if min(ab.XMax,bb.XMax)-max(ab.XMin,bb.XMin)<=0 or min(ab.YMax,bb.YMax)-max(ab.YMin,bb.YMin)<=0 or min(ab.ZMax,bb.ZMax)-max(ab.ZMin,bb.ZMin)<=0:continue
    c=a.common(b);vol=c.Volume
    assert math.isfinite(vol),(ids[i],ids[j],vol)
    if c.Solids:assert c.isValid() and c.isClosed(),(ids[i],ids[j],'intersection topology')
    cases.append({'a':ids[i],'b':ids[j],'overlapMm3':vol})
    if abs(vol)>.001:overlaps.append({'a':ids[i],'b':ids[j],'overlapMm3':vol})
report={'mode':${JSON.stringify(mode)},'components':len(ids),'pairs':cases,'overlaps':overlaps,'nutStacks':nut_stacks,'passed':not overlaps}
open('/tmp/protolab-central-z-${mode}.json','w').write(json.dumps(report,indent=2,allow_nan=False))
assert not overlaps,overlaps
`;
      const path = `/tmp/protolab-central-z-${mode}.py`;
      writeFileSync(path, script);
      const run = spawnSync(process.env.FREECAD_PYTHON!, [path], {
        encoding: 'utf8',
        env: process.env,
        timeout: 290_000,
        maxBuffer: 2_000_000,
      });
      assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
      results.push({
        executedSourceSha256: createHash('sha256').update(script).digest('hex'),
        geometrySourceSha256: createHash('sha256').update(source).digest('hex'),
        ...JSON.parse(readFileSync(`/tmp/protolab-central-z-${mode}.json`, 'utf8')),
      });
    }
    writeFileSync(
      '/tmp/protolab-central-z-proof.json',
      JSON.stringify({ rootConfiguration: machine.defaults, results }, null, 2),
    );
  },
);
test(
  'optional native source drive slots clear both actual M4x8 socket heads without treating housing relief as OEM CAD',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const p = {
      ...bolt.defaults,
      diameter: 4,
      shankDiameter: 4,
      length: 8,
      head: 'socket-cap',
      headSize: 7,
      headHeight: 4,
      drive: 'hex',
      driveWidth: 3,
      driveDepth: 2,
      pitch: 0.7,
      threadLength: 8,
      tipLength: 0.5,
      tipDiameter: 2.6,
    };
    const lines = ['import FreeCAD as App, Part, math, json', 'results=[]'];
    for (const mode of ['simple', 'full'] as const) {
      lines.push(
        withGeometryMode(mode, () => driver.python(driver.defaults, 'default')),
        '_pl_actual_drive=[q.copy() for q in components]\nfor q in _pl_actual_drive: assert not q.isNull() and q.Solids and q.isValid() and q.isClosed() and math.isfinite(q.Volume) and q.Volume>0',
      );
      for (const [x, , z] of servoDriveMountingHoles())
        lines.push(
          withGeometryMode(mode, () => bolt.python(p, 'default')),
          // The centered M4x8 bolt has its under-head seat at +2 after Rx(-90),
          // exactly the installed native drive seat. Its physical head occupies Y2..6.
          'components=[shape]',
          `for q in components:\n    q.rotate(App.Vector(),App.Vector(1,0,0),-90)\n    q.translate(App.Vector(${x},0,${z}))\n    assert q.isValid() and q.isClosed() and q.Volume>0\n    for b in _pl_actual_drive:\n        c=q.common(b)\n        assert math.isfinite(c.Volume) and abs(c.Volume)<=.001, ('driverM4head',${JSON.stringify(mode)},${z},c.Volume)\n        if c.Solids: assert c.isValid() and c.isClosed()`,
        );
      lines.push(
        `results.append({'mode':${JSON.stringify(mode)},'bolt':'M4x8/socket7x4','slotCount':2,'passed':True})`,
      );
    }
    const source =
      lines.join('\n') +
      "\nopen('/tmp/protolab-cnc-servo-drive-slots.json','w').write(json.dumps(results,indent=2,allow_nan=False))";
    const path = '/tmp/protolab-cnc-servo-drive-slots.py';
    writeFileSync(path, source);
    const r = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    });
    assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
    const results = JSON.parse(readFileSync('/tmp/protolab-cnc-servo-drive-slots.json', 'utf8'));
    assert.equal(results.length, 2);
    writeFileSync(
      '/tmp/protolab-cnc-servo-drive-slots-proof.json',
      JSON.stringify(
        { executedSourceSha256: createHash('sha256').update(source).digest('hex'), results },
        null,
        2,
      ),
    );
  },
);
