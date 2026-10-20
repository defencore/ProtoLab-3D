import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import machine, {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

const directory = resolve('test-results/cnc-milling/engineering');
mkdirSync(directory, { recursive: true });
const pieces = millingComponents(machine.defaults).filter(
  (piece) =>
    piece.section === 'equipment' &&
    piece.motion === 'fixed' &&
    !['cnc-process-accessory'].includes(piece.component.libraryId),
);
const reports = [];
for (const mode of ['simple', 'full'] as const) {
  const geometry = withGeometryMode(mode, () => componentPython(millingLibraries, pieces));
  const source =
    `import FreeCAD as App, Part, math, json\n${geometry}\n` +
    String.raw`
records=[]
for label, item in zip(component_labels,components):
    assert not item.isNull() and item.isValid() and len(item.Solids)>0, label
    assert all(s.isClosed() and s.isValid() and math.isfinite(s.Volume) and s.Volume>0 for s in item.Solids), label
    records.append({"id":label,"solids":len(item.Solids),"volume":item.Volume})
checked=0
collisions=[]
for i,a in enumerate(components):
    for j in range(i+1,len(components)):
        b=components[j]; aa=a.BoundBox; bb=b.BoundBox
        if min(aa.XMax,bb.XMax)-max(aa.XMin,bb.XMin)<=1e-6 or min(aa.YMax,bb.YMax)-max(aa.YMin,bb.YMin)<=1e-6 or min(aa.ZMax,bb.ZMax)-max(aa.ZMin,bb.ZMin)<=1e-6: continue
        checked+=1
        c=a.common(b)
        assert c.isNull() or (c.isValid() and math.isfinite(c.Volume)), (component_labels[i],component_labels[j])
        if abs(c.Volume)>0.001: collisions.append({"a":component_labels[i],"b":component_labels[j],"volume":c.Volume})
print("PROTOLAB_CONTROLS:"+json.dumps({"records":records,"checkedPairs":checked,"collisions":collisions}),flush=True)
assert not collisions, collisions
`;
  const path = resolve(directory, 'control-rack-' + mode + '.py');
  writeFileSync(path, source);
  const result = await new Promise<any>((done) => {
    const child = spawn(
      process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python',
      [path],
      {
        env: {
          ...process.env,
          PYTHONPATH: process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib',
        },
      },
    );
    let stdout = '',
      stderr = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 600000);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      done({ error: String(error) });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const line = stdout.split('\n').find((line) => line.startsWith('PROTOLAB_CONTROLS:'));
      done({ code, ...(line ? JSON.parse(line.slice(18)) : { stdout, stderr }) });
    });
  });
  reports.push({ mode, sourceHash: createHash('sha256').update(source).digest('hex'), ...result });
  writeFileSync(
    resolve(directory, 'control-rack-native.json'),
    JSON.stringify(
      {
        scope:
          'Actual installed rack, servo drives, all its fasteners and device reservations. Geometry only; not electrical commissioning.',
        componentCount: pieces.length,
        reports,
      },
      null,
      2,
    ),
  );
  console.log(
    mode,
    result.code,
    result.checkedPairs,
    result.collisions ?? result.error ?? result.stderr,
  );
}
if (reports.some((report) => report.code !== 0)) process.exitCode = 1;
