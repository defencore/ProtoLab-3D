import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial } from 'three';
import nut from '../src/parts/hex-nut/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { componentPython } from '../src/core/assembly/detail-instances';
import machine from '../src/parts/cnc-milling-machine/part';
import { millingComponents, millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import thin from '../src/parts/thin-nut/part';
import coupling from '../src/parts/coupling-nut/part';
import high from '../src/parts/high-nut/part';
import square from '../src/parts/square-nut/part';
import flange from '../src/parts/flange-nut/part';
import nyloc from '../src/parts/nyloc-nut/part';
import metalLock from '../src/parts/metal-lock-nut/part';
import cap from '../src/parts/cap-nut/part';

const configured = { ...nut.defaults, bore: 4, pitch: 0.7, acrossFlats: 7, height: 3.2, threadAllowance: 0.05 };
test('all standard nut catalogues explicitly retain zero allowance and exclude it from supplier facts', () => {
  const definitions = [nut, thin, coupling, high, square, flange, nyloc, metalLock, cap];
  assert.equal(definitions.length, 9);
  for (const p of definitions) {
    assert.equal(p.defaults.threadAllowance, 0);
    assert.equal(p.parameters.find((f) => f.key === 'threadAllowance')!.filterable, false);
    for (const preset of p.presets) {
      assert.equal(preset.parameters.threadAllowance, 0, p.id + '/' + preset.id);
      assert.ok(!preset.catalog?.verifiedParameters.includes('threadAllowance'));
      assert.deepEqual(validateParameters(p, preset.parameters, 'default'), []);
    }
  }
});
test('CAD inspection allowance is bounded, requires remaining stock and preserves nominal callouts', () => {
  assert.deepEqual(validateParameters(nut, configured, 'default'), []);
  for (const value of [-0.01, 0.201, Number.NaN, Number.POSITIVE_INFINITY])
    assert.ok(validateParameters(nut, { ...configured, threadAllowance: value }, 'default').length);
  assert.ok(validateParameters(nut, { ...configured, acrossFlats: 4.29 }, 'default').length);
  for (const mode of ['simple', 'full'] as const) {
    const source = withGeometryMode(mode, () => nut.python(configured, 'default'));
    const line = source.split('\n').find((q) => q.startsWith('component_metadata = '))!;
    const record = JSON.parse(line.slice('component_metadata = '.length))[0];
    const features = JSON.parse(record.ThreadFeaturesJSON);
    assert.equal(features[0].nominalDiameter, 4);
    assert.equal(features[0].pitch, 0.7);
    assert.equal(features[0].length, 3.2);
    assert.match(source, /radial CAD inspection allowance 0.05 mm/);
    assert.match(source, /Not a supplier-certified ISO fit class/);
    if (mode === 'full') assert.match(source, /_protolab_thread\(4,0\.7,3\.2,True,False,0\.05,False\)/);
  }
});
test('Simple keeps the nominal bore and Full applies its declared inspection allowance without relabeling M4', () => {
  for (const mode of ['simple', 'full'] as const) {
    const model = withGeometryMode(mode, () => nut.buildGeometry(configured, 'default'));
    const radius: number[] = [];
    model.traverse((q) => {
      if (!(q instanceof Mesh)) return;
      assert.match(q.name, /^Internal M4×/);
      const positions = q.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) radius.push(Math.hypot(positions.getX(i), positions.getY(i)));
      if (mode === 'full') {
        const material = q.material as MeshStandardMaterial;
        assert.equal(material.userData.visualThreads[0].diameter, 4.1);
      }
    });
    assert.ok(Math.abs(Math.min(...radius) - (mode === 'full' ? 2.05 : 2)) < 1e-6);
    disposeModel(model);
  }
});
test('native Simple selected allowance retains a nominal bore matching its preview',
  { skip: !process.env.FREECAD_PYTHON, timeout: 30_000 }, () => {
    const script = `import FreeCAD as App,Part,math\n${withGeometryMode('simple', () => nut.python(configured, 'default'))}\nassert shape.isValid() and shape.isClosed()\nassert not shape.isInside(App.Vector(1.98,0,1.6),.000001,False)\nassert shape.isInside(App.Vector(2.02,0,1.6),.000001,False)\n`;
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], { input: script, encoding: 'utf8', env: process.env, timeout: 25_000 });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  });
test('native installed M4 captured nuts clear all fourteen joints and retain true misphase detection',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 }, () => {
    const all = millingComponents(machine.defaults);
    const females = all.filter((q) => q.component.libraryId === 'hex-nut' && q.component.id.startsWith('control-mount-') && q.component.parameters.bore === 4);
    assert.equal(females.length, 14);
    const rows = females.flatMap((q) => {
      const male = all.find((p) => p.component.id === q.component.id.slice(0, -4))!;
      assert.ok(male);
      assert.equal(q.component.parameters.threadAllowance, 0.05);
      return [male, q];
    });
    const source = withGeometryMode('full', () => componentPython(millingLibraries, rows));
    const script = `import FreeCAD as App,Part,math,json
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(rows.map((q) => q.component.id)))})
r=[]
for index in range(0,len(components),2):
 a,b=components[index:index+2]
 for s in [a,b]:assert s.isValid() and s.isClosed() and len(s.Solids)==1 and math.isfinite(s.Volume) and s.Volume>0
 feature=json.loads(component_metadata[index]['ThreadFeaturesJSON'])[0]
 pivot=App.Vector(*feature['origin']);axis=App.Vector(*feature['axis'])
 checks=[]
 for angle in [0,30]:
  x=a.copy();x.rotate(pivot,axis,angle);c=x.common(b);v=c.Volume
  assert math.isfinite(v)
  if c.Solids:assert c.isValid() and c.isClosed()
  if angle==0:assert abs(v)<=.001,(ids[index],'actual inspection fit',v)
  else:assert v>.001,(ids[index],'true phase overlap missed',v)
  checks.append({'angleDegrees':angle,'overlapMm3':v})
 features=json.loads(component_metadata[index+1]['ThreadFeaturesJSON'])
 assert features[0]['nominalDiameter']==4 and features[0]['pitch']==.7 and features[0]['length']==3.2
 assert '0.05' in component_metadata[index+1]['ThreadInspectionAllowance']
 assert 'Full-only' in component_metadata[index+1]['ThreadInspectionAllowance']
 r.append({'a':ids[index],'b':ids[index+1],'checks':checks})
print('NUT_INSPECTION_NATIVE '+json.dumps(r),flush=True)
`;
    const path = '/tmp/protolab-nut-inspection-native.py'; writeFileSync(path, script);
    const r = spawnSync(process.env.FREECAD_PYTHON!, [path], { encoding: 'utf8', env: process.env, timeout: 280_000, maxBuffer: 4_000_000 });
    assert.equal(r.status, 0, `${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
    const line = r.stdout.split('\n').find((q) => q.startsWith('NUT_INSPECTION_NATIVE ')); assert.ok(line);
    writeFileSync('/tmp/protolab-nut-inspection-native-proof.json', JSON.stringify({
      schemaVersion: 1, sourceSha256: createHash('sha256').update(script).digest('hex'),
      runtimeSha256: createHash('sha256').update(readFileSync(process.env.FREECAD_PYTHON!)).digest('hex'),
      pairs: JSON.parse(line.slice('NUT_INSPECTION_NATIVE '.length)),
    }, null, 2) + '\n');
  });
