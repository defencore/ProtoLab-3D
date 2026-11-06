import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import part, { actuatorPieces } from '../src/parts/tr8-compact-actuator/part';
import { libraries } from '../src/parts/tr8-compact-actuator/lib/components';
import { actuatorExternalThreads } from '../src/parts/tr8-compact-actuator/lib/mating';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

test('the installed compact TR8 fasteners and column threads mate with real phase controls',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 }, () => {
    const all = actuatorPieces(part.defaults);
    const flangeIds = all.filter((piece) => piece.component.id.startsWith('nut-flange-')).map((piece) => piece.component.id);
    assert.equal(flangeIds.length, 2);
    const pairs = [
      ['output-front-clamp-bolt', 'output-front-clamp-nut'],
      ['output-rear-clamp-bolt', 'output-rear-clamp-nut'],
      ...flangeIds.map((id) => [id, 'nut-yoke']),
      ...[1, 2, 3].flatMap((index) => [
        [`column-motor-bolt-${index}`, `column-front-${index}`],
        [`column-rear-${index}`, `column-front-${index}`],
        [`column-end-bolt-${index}`, `column-rear-${index}`],
      ]),
      ['output-shaft', 'output-end-cap'],
    ];
    const ids = [...new Set(pairs.flat())];
    const pieces = ids.map((id) => {
      const value = all.find((piece) => piece.component.id === id);
      assert.ok(value, id);
      return value;
    });
    const external = actuatorExternalThreads(pieces);
    const controlPairs = [
      ['output-front-clamp-bolt', 'output-front-clamp-nut', 2, 30],
      ...flangeIds.map((id) => [id, 'nut-yoke', 3, 90]),
      ['output-shaft', 'output-end-cap', 6, 90],
      ['column-rear-1', 'column-front-1', 3, 90],
      ['column-end-bolt-1', 'column-rear-1', 3, 90],
    ].map(([first, second, diameter, angle]) => {
      const thread = external.find((value) => value.componentId === first && value.diameter === diameter);
      assert.ok(thread, String(first));
      return { first, second, origin: thread.origin, axis: thread.axis, angle };
    });
    const source = withGeometryMode('full', () => componentPython(libraries, pieces));
    const script = `import FreeCAD as App, Part, math, json
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
pairs=json.loads(${JSON.stringify(JSON.stringify(pairs))})
control_specs=json.loads(${JSON.stringify(JSON.stringify(controlPairs))})
assert all(shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0 for shape in components)
results=[]
for first,second in pairs:
 volume=components[ids.index(first)].common(components[ids.index(second)]).Volume
 assert abs(volume)<=.001,(first,second,volume)
 results.append(dict(occurrenceIds=[first,second],overlapMm3=volume,overlapBudgetMm3=.001))
controls=[]
for control in control_specs:
 shape=components[ids.index(control['first'])].copy()
 shape.rotate(App.Vector(*control['origin']),App.Vector(*control['axis']),control['angle'])
 volume=shape.common(components[ids.index(control['second'])]).Volume
 assert volume>.001,(control,volume)
 controls.append(dict(occurrenceIds=[control['first'],control['second']],angleDegrees=control['angle'],overlapMm3=volume))
print('TR8_THREAD_MATING '+json.dumps(dict(matedPairs=results,positiveControls=controls)),flush=True)
`;
    const filename = '/tmp/protolab-tr8-thread-mating.py';
    writeFileSync(filename, script);
    const run = spawnSync(process.env.FREECAD_PYTHON!, [filename], {
      encoding: 'utf8', env: process.env, timeout: 280_000, maxBuffer: 4_000_000,
    });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    const result = run.stdout.split('\n').find((line) => line.startsWith('TR8_THREAD_MATING '));
    assert.ok(result);
    if (process.env.TR8_THREAD_PROOF) {
      mkdirSync(dirname(process.env.TR8_THREAD_PROOF), { recursive: true });
      writeFileSync(process.env.TR8_THREAD_PROOF, JSON.stringify({ schemaVersion: 1,
        sourceSha256: createHash('sha256').update(script).digest('hex'),
        runtimeSha256: createHash('sha256').update(readFileSync(process.env.FREECAD_PYTHON!)).digest('hex'),
        ...JSON.parse(result.slice('TR8_THREAD_MATING '.length)),
      }, null, 2)+'\n');
    }
  });
