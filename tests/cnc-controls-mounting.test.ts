import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import machine from '../src/parts/cnc-milling-machine/part';
import { spindleSpec } from '../src/parts/cnc-spindle/part';
import control, { controlMounting } from '../src/parts/machine-control/part';
import {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/lib/composition';
import {
  controlMountJoints,
  controlMountErrors,
} from '../src/parts/cnc-milling-machine/lib/control-equipment';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';

test('every installed control device has an explicit retained physical mounting path', () => {
  for (const spindle of machine.parameters.find((q) => q.key === 'spindle')!.options!) {
    const p = { ...machine.defaults, spindle: spindle.value };
    const rows = millingComponents(p),
      power = Number(
        rows.find((q) => q.component.id === 'spindle-variable-frequency-drive')!.component
          .parameters.model === 'gpenny-huanyang-4kw-220v'
          ? 3000
          : 2200,
      );
    assert.deepEqual(controlMountErrors(rows, power), []);
    assert.deepEqual(
      new Set(controlMountJoints(power).map((q) => q.device)),
      new Set([
        'axis-servo-drive-0',
        'axis-servo-drive-1',
        'axis-servo-drive-2',
        'spindle-variable-frequency-drive',
        'auxiliary-24v-power-supply',
        'independent-safety-relay',
        'motion-controller',
        'emergency-stop',
      ]),
    );
    assert.ok(
      !rows.some((q) => /control-rack|servo-board|control-rack-shelf/.test(q.component.id)),
    );
    assert.ok(
      rows
        .filter((q) => q.component.id.startsWith('control-support-post-'))
        .every((q) => q.component.parameters.wall === 3),
    );
  }
});
test('mount completeness rejects omitted retaining hardware and unowned extra bolts', () => {
  const rows = millingComponents(machine.defaults);
  assert.match(
    controlMountErrors(
      rows.filter((q) => q.component.id !== 'control-mount-psu-0'),
      2200,
    ).join('\n'),
    /Missing mount fastener: control-mount-psu-0/,
  );
  assert.match(
    controlMountErrors(
      rows.filter((q) => q.component.id !== 'control-mount-servo-0-0-nut'),
      2200,
    ).join('\n'),
    /Missing retained mount nut/,
  );
  const bolt = rows.find((q) => q.component.id === 'control-mount-servo-0-0')!;
  assert.match(
    controlMountErrors(
      [...rows, { ...bolt, component: { ...bolt.component, id: 'control-mount-unowned' } }],
      2200,
    ).join('\n'),
    /Unmatched installed mount fastener/,
  );
  assert.match(
    controlMountErrors(rows.filter((q) => q.component.id !== 'control-support-panel--250-50-nut'), 2200).join('\n'),
    /Missing retained mount nut/,
  );
  assert.match(
    controlMountErrors([...rows, { ...bolt, component: { ...bolt.component, id: 'control-support-unowned' } }], 2200).join('\n'),
    /Unmatched installed mount fastener/,
  );
});
test('bought mounting interfaces retain source evidence and nominal thread/fixing data', () => {
  const atv = controlMounting({ ...control.defaults, model: 'atv12hu22m2' }),
    psu = controlMounting({ ...control.defaults, model: 'lrs15024' }),
    stop = controlMounting({ ...control.defaults, model: 'xb5as8444' });
  assert.equal(atv.kind, 'rear-tabs');
  if (atv.kind === 'rear-tabs')
    assert.deepEqual(atv.holes, [
      [-46.5, 0, 137],
      [46.5, 0, 17],
    ]);
  assert.equal(psu.kind, 'rear-taps');
  if (psu.kind === 'rear-taps') {
    assert.equal(psu.depth, 3);
    assert.equal(psu.diameter, 3);
    assert.deepEqual(psu.holes, [
      [-55.5, 0, 32],
      [22.5, 0, 32],
    ]);
  }
  assert.equal(stop.kind, 'panel-collar');
  if (stop.kind === 'panel-collar') {
    assert.equal(stop.panelFront - stop.panelRear, 4);
    assert.equal(stop.hole, 22.5);
  }
  for (const p of control.presets)
    assert.deepEqual(validateParameters(control, p.parameters, 'default'), []);
});

test(
  'optional native control fixtures have seating, capture, closed parts and clear Y drive',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    assert.ok(
      !process.env.CNC_CONTROL_MODE || ['simple', 'full'].includes(process.env.CNC_CONTROL_MODE),
      'Native control mode must be Simple or Full.',
    );
    const results = [];
    const cases = [
      { spindle: String(machine.defaults.spindle), controller: 'ddcs-v3-1' },
      { spindle: 'jst-jgd80c3-3-0', controller: 'ddcs-v4-1' },
    ];
    // Use an actual registered3 kW spindle identity.
    const models = machine.parameters.find((q) => q.key === 'spindle')!.options!;
    const threeKw = models.find((q) => spindleSpec(String(q.value)).power === 3000);
    assert.ok(threeKw, 'Actual source3 kW execution must exist.');
    cases[1].spindle = String(threeKw.value);
    for (const [index, cfg] of cases.entries()) {
      const p = { ...machine.defaults, ...cfg },
        mode = process.env.CNC_CONTROL_MODE === 'full' ? ('full' as const) : ('simple' as const);
      const all = millingComponents(p),
        equipment = all.filter(
          (q) =>
            q.component.id.startsWith('control-') ||
            q.component.id.startsWith('safety-relay-') ||
            q.component.id.startsWith('controller-rear-clamp-') ||
            q.component.id.startsWith('vfd-') ||
            [
              'axis-servo-drive-0',
              'axis-servo-drive-1',
              'axis-servo-drive-2',
              'spindle-variable-frequency-drive',
              'auxiliary-24v-power-supply',
              'independent-safety-relay',
              'motion-controller',
              'emergency-stop',
            ].includes(q.component.id),
        );
      const rows = all.filter(
        (q) =>
          equipment.includes(q) ||
          q.component.id === 'drive-end-crossmember-0' ||
          // The exact Simple neighbours cover the support relocation. Full here
          // exercises actual control joints; the whole-assembly audit covers the
          // complete Full bed, avoiding repeated long rail-pad thread generation.
          (mode === 'simple' && (
            ['fixed-bed-side-1','fixed-bed-lower-flange-1','y-rail-pad-1','y-guide-rail-1','stand-top-plate-1--1120'].includes(q.component.id) ||
            q.component.id.startsWith('bed-flange-1-clamp-0-')
          )) ||
          q.component.id.startsWith('y-servo-') ||
          q.component.id === 'y-feed-servo',
      );
      const ids = rows.map((q) => q.component.id),
        source = withGeometryMode(mode, () => componentPython(millingLibraries, rows));
      const material = rows.map((q) =>
          q.component.libraryId === 'din-rail'
            ? 'steel'
            : q.component.libraryId === 'manufactured-detail'
              ? 'aluminium'
              : (q.component.parameters.material ?? null),
        ),
        support = equipment
          .filter((q) => q.component.supply === 'manufactured')
          .map((q) => q.component.id);
      const power = spindleSpec(String(p.spindle)).power;
      const mountFaces = controlMountJoints(power).flatMap((j) =>
        j.fasteners.flatMap((id) => {
          let headHost = j.device,
            nutHost = 'control-mounting-panel';
          if (j.capture === 'source-taps' || j.capture === 'rear-clamps')
            headHost = 'control-mounting-panel';
          if (j.capture === 'rear-clamps')
            nutHost = 'controller-rear-clamp-' + id.split('-').at(-1);
          if (j.capture === 'external-cradle')
            headHost = id.includes('-top-') ? 'vfd-removable-top-stop' : 'vfd-captive-cradle';
          if (j.capture === 'din-latch')
            headHost = id.includes('-stop-')
              ? 'safety-relay-end-stop-' + id.split('-').at(-1)
              : 'safety-relay-din-rail';
          return [
            { a: id, b: headHost },
            ...(j.capture === 'source-taps' ? [] : [{ a: id + '-nut', b: nutHost }]),
          ];
        }),
      );
      const script = `import FreeCAD as App,Part,math,json\n${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
support=json.loads(${JSON.stringify(JSON.stringify(support))})
materials=json.loads(${JSON.stringify(JSON.stringify(material))})
assert len(components)==len(ids)
for ident,q in zip(ids,components):assert not q.isNull() and q.Solids and q.isValid() and q.isClosed() and math.isfinite(q.Volume) and q.Volume>0,ident
def shape(ident):return components[ids.index(ident)]
def contact(a,b):
 x,y=shape(a),shape(b);distance=x.distToShape(y)[0];assert math.isfinite(distance) and distance<.00001,(a,b,'floating',distance)
 area=0
 for fa in x.Faces:
  if not isinstance(fa.Surface,Part.Plane):continue
  for fb in y.Faces:
   if not isinstance(fb.Surface,Part.Plane):continue
   if fa.distToShape(fb)[0]>.00001:continue
   c=fa.common(fb)
   if c.Faces:area+=c.Area
 assert math.isfinite(area) and area>1,(a,b,'no meaningful bearing face',area)
 return {'a':a,'b':b,'distanceMm':distance,'bearingAreaMm2':area}
contacts=[]
mount_faces=json.loads(${JSON.stringify(JSON.stringify(mountFaces))})
for pair in mount_faces:contacts.append(contact(pair['a'],pair['b']))
for i in range(3):contacts.append(contact('axis-servo-drive-'+str(i),'control-mounting-panel'))
contacts.append(contact('auxiliary-24v-power-supply','control-mounting-panel'))
contacts.append(contact('independent-safety-relay','safety-relay-din-rail'))
contacts.append(contact('emergency-stop','control-mounting-panel'))
contacts.append(contact('motion-controller','control-mounting-panel'))
for i in range(4):contacts.append(contact('motion-controller','controller-rear-clamp-'+str(i)))
if 'vfd-captive-cradle' in ids:
 contacts.append(contact('spindle-variable-frequency-drive','vfd-captive-cradle'));contacts.append(contact('spindle-variable-frequency-drive','vfd-removable-top-stop'))
else:contacts.append(contact('spindle-variable-frequency-drive','control-mounting-panel'))
for x in [-250,80]:
 contacts.append(contact('control-support-post-'+str(x),'control-support-bed-pad-'+str(x)))
 contacts.append(contact('control-support-bed-pad-'+str(x),'drive-end-crossmember-0'))
 contacts.append(contact('control-support-post-'+str(x),'control-mounting-panel'))
if ${JSON.stringify(mode)}=='full':
 Part.makeCompound(components).exportBrep('/tmp/protolab-cnc-controls-full-${index}-diagnostic.brep')
pairs=[]
failures=[]
for i,a in enumerate(components):
 for j in range(i+1,len(components)):
  b=components[j];aa=a.BoundBox;bb=b.BoundBox
  if min(aa.XMax,bb.XMax)-max(aa.XMin,bb.XMin)<=0 or min(aa.YMax,bb.YMax)-max(aa.YMin,bb.YMin)<=0 or min(aa.ZMax,bb.ZMax)-max(aa.ZMin,bb.ZMin)<=0:continue
  c=a.common(b);vol=c.Volume;assert math.isfinite(vol),(ids[i],ids[j],vol)
  if abs(vol)>.001:failures.append({'a':ids[i],'b':ids[j],'volumeMm3':vol})
  if c.Solids and not (c.isValid() and c.isClosed()):
   failures.append({'a':ids[i],'b':ids[j],'volumeMm3':vol,'error':'Invalid or open returned Common'})
   print('INVALID_CONTROL_COMMON '+json.dumps(failures[-1]),flush=True)
  pairs.append({'a':ids[i],'b':ids[j],'volumeMm3':vol})
open('/tmp/protolab-cnc-controls-collisions-${mode}-${index}.json','w').write(json.dumps(failures,indent=2,allow_nan=False))
assert not failures,failures
mass=[]
for ident in support:
 i=ids.index(ident);density=7850 if materials[i]=='steel' else 2700
 mass.append({'id':ident,'libraryId':${JSON.stringify(rows.map((q) => q.component.libraryId))}[i],'material':materials[i],'volumeMm3':components[i].Volume,'densityKgM3':density,'estimatedKg':components[i].Volume*density/1e9})
open('/tmp/protolab-cnc-controls-${mode}-${index}.json','w').write(json.dumps({'ids':ids,'mode':${JSON.stringify(mode)},'contacts':contacts,'pairs':pairs,'supportMass':mass,'supportMassKg':sum(q['estimatedKg'] for q in mass),'freecadVersion':App.Version(),'passed':True},indent=2,allow_nan=False))
`;
      const path = `/tmp/protolab-cnc-controls-${mode}-${index}.py`;
      writeFileSync(path, script);
      const r = spawnSync(process.env.FREECAD_PYTHON!, [path], {
        encoding: 'utf8',
        env: process.env,
        timeout: 290_000,
        maxBuffer: 2_000_000,
      });
      assert.equal(r.status, 0, `${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
      results.push({
        configuration: p,
        nativeRuntime: [
          process.env.FREECAD_PYTHON!,
          process.env.FREECAD_LIB
            ? process.env.FREECAD_LIB + '/FreeCAD.so'
            : '/Applications/FreeCAD.app/Contents/Resources/lib/FreeCAD.so',
        ].map((path) => ({
          path,
          sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
        })),
        geometrySourceSha256: createHash('sha256').update(source).digest('hex'),
        installedSupportConfigurations: equipment
          .filter((q) => q.component.supply === 'manufactured')
          .map((q) => q.component),
        executedSourceSha256: createHash('sha256').update(script).digest('hex'),
        ...JSON.parse(readFileSync(`/tmp/protolab-cnc-controls-${mode}-${index}.json`, 'utf8')),
      });
    }
    writeFileSync(
      `/tmp/protolab-cnc-controls-${process.env.CNC_CONTROL_MODE === 'full' ? 'full' : 'simple'}-native-proof.json`,
      JSON.stringify(results, null, 2),
    );
  },
);
