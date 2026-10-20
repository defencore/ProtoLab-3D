/** Native volume/centre measurements of actual configured frame leaves, without rebuilding purchased units. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Euler, Vector3 } from 'three';
import machine, { millingComponents } from '../src/parts/cnc-milling-machine/part';
import frame from '../src/parts/cnc-frame-part/part';
import spindleMount from '../src/parts/cnc-spindle-mount/part';
import { withGeometryMode } from '../src/core/geometry-mode';

const output = resolve(
  process.env.CNC_FRAME_VOLUME_DIR ?? 'test-results/cnc-milling/reinforced-structure',
);
const nativePython =
  process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python';
const nativeLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
const nativeMethod = 'valid-closed-single-solid-volume-and-optimal-bounds-v1';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const runtimeSignature = JSON.stringify(
  [nativePython, resolve(nativeLib, 'FreeCAD.so')].map((path) => ({
    path,
    ...(existsSync(path) ? { size: statSync(path).size, modified: statSync(path).mtimeMs } : {}),
  })),
);
mkdirSync(output, { recursive: true });
const definitions = [frame, spindleMount];
const pieces = millingComponents(machine.defaults).filter((p) =>
  definitions.some((definition) => definition.id === p.component.libraryId),
);
interface NativeMeasurement {
  sourceHash: string;
  volumeMm3: number;
  centerMm: [number, number, number];
  boundsMm: [number, number, number];
}
interface NativeReport {
  passed: boolean;
  nativeMethod: string;
  runtimeSignature: string;
  sourceCases: NativeMeasurement[];
  freecadVersion: string[];
}
const nativeReport = resolve(output, 'frame-volume-native.json');
const previous: NativeReport | undefined = existsSync(nativeReport)
  ? JSON.parse(readFileSync(nativeReport, 'utf8'))
  : undefined;
const reusable =
  previous?.runtimeSignature === runtimeSignature && previous.nativeMethod === nativeMethod
    ? previous.sourceCases
    : [];
const cases = new Map<string, { sourceHash: string; source: string }>();
const occurrences = pieces.map((piece) => {
  const c = piece.component;
  const definition = definitions.find((part) => part.id === c.libraryId)!;
  const errors = definition.validate(c.parameters, c.state);
  if (errors.length) throw new Error(c.id + ': ' + errors.join('; '));
  const source = withGeometryMode('simple', () => definition.python(c.parameters, c.state));
  const sourceHash = sha(source);
  cases.set(sourceHash, { sourceHash, source });
  return {
    id: c.id,
    libraryId: c.libraryId,
    motion: piece.motion,
    parameters: c.parameters,
    state: c.state,
    placement: c.placement,
    material: c.libraryId === spindleMount.id ? 'aluminium' : String(c.parameters.material),
    sourceHash,
  };
});
const manifest = {
  schemaVersion: 1,
  mode: 'simple',
  runtimeSignature,
  nativeMethod,
  rootConfiguration: machine.defaults,
  scope:
    'Only actual cnc-frame-part and cnc-spindle-mount physical leaves. No kit containers or purchased internal subparts.',
  cases: [...cases.values()],
  occurrences,
  reusable,
};
const manifestPath = resolve(output, 'frame-volume-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const runner = `import FreeCAD as App, Part, math, json, os, time, hashlib\nmanifest_path=${JSON.stringify(manifestPath)}\noutput=${JSON.stringify(nativeReport)}\nmanifest=json.load(open(manifest_path))\nrows=[]\nreused=0\ncache={r['sourceHash']:r for r in manifest['reusable']}\ndef save(passed):\n    data={'passed':passed,'nativeMethod':manifest['nativeMethod'],'runtimeSignature':manifest['runtimeSignature'],'manifestSha256':hashlib.sha256(open(manifest_path,'rb').read()).hexdigest(),'sourceCases':rows,'reused':reused,'freecadVersion':App.Version()}\n    temp=output+'.tmp'\n    open(temp,'w').write(json.dumps(data,indent=2,allow_nan=False))\n    os.replace(temp,output)\nfor index,case in enumerate(manifest['cases']):\n    key=case['sourceHash']\n    assert hashlib.sha256(case['source'].encode()).hexdigest()==key\n    if key in cache:\n        row=cache[key]\n        assert row['volumeMm3']>0 and math.isfinite(row['volumeMm3']) and all(math.isfinite(x) for x in row['centerMm']+row['boundsMm'])\n        reused+=1\n    else:\n        started=time.time()\n        namespace={'App':App,'Part':Part,'math':math,'json':json}\n        exec(case['source'],namespace)\n        shape=namespace['shape']\n        assert not shape.isNull() and len(shape.Solids)==1 and shape.isValid() and shape.isClosed() and math.isfinite(shape.Volume) and shape.Volume>0, ('invalid manufactured leaf',index)\n        solid=shape.Solids[0]\n        center=solid.CenterOfMass\n        box=solid.optimalBoundingBox(False,False)\n        row={'sourceHash':key,'volumeMm3':shape.Volume,'centerMm':[center.x,center.y,center.z],'boundsMm':[box.XLength,box.YLength,box.ZLength],'elapsedSeconds':time.time()-started}\n        assert all(math.isfinite(x) for x in row['centerMm']+row['boundsMm'])\n    rows.append(row)\n    save(False)\n    if index%20==0: print(json.dumps({'completed':index+1,'planned':len(manifest['cases']),'reused':reused}),flush=True)\nsave(True)\nprint(json.dumps({'passed':True,'sourceCases':len(rows),'reused':reused}),flush=True)\n`;
const runnerPath = resolve(output, 'frame-volume-native.py');
writeFileSync(runnerPath, runner);
const execution = spawnSync(nativePython, [runnerPath], {
  encoding: 'utf8',
  env: { ...process.env, PYTHONPATH: nativeLib },
  timeout: 600000,
});
if (execution.stdout) process.stdout.write(execution.stdout);
if (execution.status !== 0)
  throw new Error(execution.stderr || 'Native volume measurement did not complete.');
const report: NativeReport = JSON.parse(readFileSync(nativeReport, 'utf8'));
if (
  !report.passed ||
  report.nativeMethod !== nativeMethod ||
  report.runtimeSignature !== runtimeSignature ||
  report.sourceCases.length !== cases.size
)
  throw new Error('Incomplete native volume proof.');
const table = new Map(report.sourceCases.map((row) => [row.sourceHash, row]));
const rows = occurrences.map((c) => {
  const measurement = table.get(c.sourceHash);
  if (!measurement) throw new Error('Missing native source hash: ' + c.id);
  const densityKgPerM3 = c.material === 'steel' ? 7850 : 2700;
  const center = new Vector3(...measurement.centerMm)
    .applyEuler(
      new Euler(
        ...(c.placement.rotation.map((a) => (a * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      ),
    )
    .add(new Vector3(...c.placement.translation));
  return {
    ...c,
    ...measurement,
    densityKgPerM3,
    estimatedMassKg: measurement.volumeMm3 * densityKgPerM3 * 1e-9,
    worldCenterMm: center.toArray(),
  };
});
const groups = Object.fromEntries(
  ['fixed', 'gantry', 'x', 'z'].map((motion) => {
    const members = rows.filter((r) => r.motion === motion),
      mass = members.reduce((n, r) => n + r.estimatedMassKg, 0);
    const center = mass
      ? [0, 1, 2].map(
          (i) => members.reduce((n, r) => n + r.worldCenterMm[i] * r.estimatedMassKg, 0) / mass,
        )
      : null;
    return [motion, { leafCount: members.length, estimatedMassKg: mass, worldCenterMm: center }];
  }),
);
writeFileSync(
  resolve(output, 'frame-installed-mass.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      passed: true,
      nativeMethod,
      runtimeSignature,
      manifestSha256: sha(readFileSync(manifestPath, 'utf8')),
      runnerSha256: sha(runner),
      rootConfiguration: machine.defaults,
      freecadVersion: report.freecadVersion,
      scope: manifest.scope,
      assumptions:
        'Native Simple volume times assumed steel7850/aluminium2700kg/m3. Source stock/grade/certificate density and physical mass are unverified. Excludes all other library families, cables, liquids, fixtures and tool.',
      groups,
      rows,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ occurrences: rows.length, uniqueNativeMacros: cases.size, groups }));
