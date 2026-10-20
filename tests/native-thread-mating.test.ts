import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { componentPython, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';
import bolt from '../src/parts/bolt-screw/part';
import nut from '../src/parts/hex-nut/part';
import { alignMatingFasteners } from '../src/parts/cnc-milling-machine/lib/thread-mating';

// Long external and short internal threads must use compatible sweep frames.
// An intentional phase error is a true-overlap positive control, not a tolerance exception.
test('native M3/M5/M6/M8 nominal flanks mate in two orientations and reject a 30-degree misphase',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 }, () => {
    const rows: ConfiguredPiece[] = [];
    const pairs: { diameter: number; male: number; female: number; axis: Vec; tip: Vec }[] = [];
    for (const [diameter, pitch, acrossFlats, height, headSize, driveWidth] of [[3, 0.5, 5.5, 2.4, 5.5, 2.5], [5, 0.8, 8, 4, 8.5, 4], [6, 1, 10, 5, 10, 5], [8, 1.25, 13, 6.5, 13, 6]]) {
      for (const reversed of [false, true]) {
        const x = pairs.length * 100, length = 50, headHeight = diameter;
        const axis: Vec = reversed ? [0, -1, 0] : [0, 0, 1];
        const tip: Vec = reversed ? [x, height + 1, 0] : [x, 0, -1];
        const translation = tip.map((n, i) => n + axis[i] * (length + headHeight) / 2) as Vec;
        const female = rows.length;
        rows.push({ label: `M${diameter} nut`, color: 0x888888, component: {
          id: `female-${female}`, name: 'Nominal nut', libraryId: nut.id, state: 'default', quantity: 1, supply: 'standard',
          parameters: { ...nut.defaults, bore: diameter, pitch, acrossFlats, height },
          placement: { translation: [x, 0, 0], rotation: reversed ? [-90, 0, 0] : [0, 0, 0] },
        } });
        const male = rows.length;
        rows.push({ label: `M${diameter} bolt`, color: 0x888888, component: {
          id: `male-${male}`, name: 'Nominal bolt', libraryId: bolt.id, state: 'default', quantity: 1, supply: 'standard',
          parameters: { ...bolt.defaults, diameter, shankDiameter: diameter, pitch, length, threadSpan: 'full', threadLength: 1, head: 'socket-cap', headHeight, headSize, drive: 'hex', driveWidth, driveDepth: diameter / 2, tip: 'flat' },
          placement: { translation, rotation: reversed ? [0, 90, -90] : [0, 0, 37] },
        } });
        pairs.push({ diameter, male, female, axis, tip });
      }
    }
    const source = withGeometryMode('full', () => componentPython([bolt, nut], alignMatingFasteners(rows)));
    const script = `import FreeCAD as App,Part,math,json
${source}
pairs=json.loads(${JSON.stringify(JSON.stringify(pairs))})
results=[]
for pair in pairs:
 a,b=components[pair['male']],components[pair['female']]
 for s in [a,b]:
  assert not s.isNull() and s.isValid() and s.isClosed() and len(s.Solids)==1 and math.isfinite(s.Volume) and s.Volume>0
  s.check(True)
 q={'diameter':pair['diameter'],'axis':pair['axis'],'inputMaxTolerancesMm':[s.getTolerance(1) for s in [a,b]],'checks':[]}
 for angle in [0,30]:
  x=a.copy();x.rotate(App.Vector(*pair['tip']),App.Vector(*pair['axis']),angle)
  c=x.common(b);v=c.Volume
  assert math.isfinite(v)
  check={'angleDegrees':angle,'overlapMm3':v,'intersectionMaxToleranceMm':c.getTolerance(1)}
  if c.Solids:
   assert c.isValid() and c.isClosed()
   try:c.check(True);check['bopPassed']=True
   except Exception as e:check['bopPassed']=False;check['bopDiagnostic']=str(e)
  if angle==0:assert abs(v)<=.001,('aligned nominal flanks',pair,v)
  else:assert v>.001,('true phase-error overlap was missed',pair,v)
  q['checks'].append(check)
 for index in [pair['male'],pair['female']]:
  features=json.loads(component_metadata[index]['ThreadFeaturesJSON'])
  assert all(f['nominalDiameter']==pair['diameter'] and f['representation']=='machined-helix' for f in features)
 results.append(q);print(q,flush=True)
print('NATIVE_THREAD_MATING '+json.dumps(results),flush=True)
`;
    const path = '/tmp/protolab-native-thread-mating.py';
    writeFileSync(path, script);
    const r = spawnSync(process.env.FREECAD_PYTHON!, [path], { encoding: 'utf8', env: process.env, timeout: 280_000, maxBuffer: 4_000_000 });
    assert.equal(r.status, 0, `${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
    const line = r.stdout.split('\n').find((q) => q.startsWith('NATIVE_THREAD_MATING '));
    assert.ok(line);
    if (process.env.NATIVE_THREAD_MATING_PROOF)
      writeFileSync(process.env.NATIVE_THREAD_MATING_PROOF, JSON.stringify({
        schemaVersion: 1,
        sourceSha256: createHash('sha256').update(script).digest('hex'),
        runtimeSha256: createHash('sha256').update(readFileSync(process.env.FREECAD_PYTHON!)).digest('hex'),
        cases: JSON.parse(line.slice('NATIVE_THREAD_MATING '.length)),
      }, null, 2) + '\n');
  });
