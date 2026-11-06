import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import actuator, { actuatorPieces } from '../src/parts/sfk-disc-actuator/part';
import { libraries } from '../src/parts/sfk-disc-actuator/lib/components';
import {
  actuatorExternalThreads,
} from '../src/parts/sfk-disc-actuator/lib/mating';
import { componentPython, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

function selectedPieces(ids: string[]): ConfiguredPiece[] {
  const pieces = actuatorPieces(actuator.defaults);
  return ids.map((id) => {
    const piece = pieces.find((candidate) => candidate.component.id === id);
    assert.ok(piece, `Missing actual actuator occurrence: ${id}`);
    return piece;
  });
}

test(
  'disc actuator catalog column threads and retained drive threads mate with positive controls',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const pairIds = [
      ['output-front-clamp-bolt', 'output-front-clamp-nut'],
      ['output-rear-clamp-bolt', 'output-rear-clamp-nut'],
      ['nut-flange-60', 'nut-yoke'],
      ['nut-flange-120', 'nut-yoke'],
      ['nut-flange-240', 'nut-yoke'],
      ['nut-flange-300', 'nut-yoke'],
      ...[1, 2, 3].flatMap((n) => [
        [`column-motor-bolt-${n}`, `column-front-${n}`],
        [`column-rear-${n}`, `column-front-${n}`],
        [`column-end-bolt-${n}`, `column-rear-${n}`],
      ]),
      ['output-shaft', 'output-end-cap'],
    ];
    const ids = [...new Set(pairIds.flat())];
    const pieces = selectedPieces(ids);
    const pairs = pairIds.map(([first, second]) => ({
      first: ids.indexOf(first),
      second: ids.indexOf(second),
      overlapBudgetMm3: 0.001,
    }));
    const externalThreads = actuatorExternalThreads(pieces);
    const controlSpecs = [
      ['output-front-clamp-bolt', 'output-front-clamp-nut', 2, 30],
      // Native inspection confirms the authored M3 tap allowance admits 60°; 90° intersects.
      ['nut-flange-60', 'nut-yoke', 3, 90],
      ['nut-flange-120', 'nut-yoke', 3, 90],
      ['nut-flange-240', 'nut-yoke', 3, 90],
      ['nut-flange-300', 'nut-yoke', 3, 90],
      ['output-shaft', 'output-end-cap', 6, 90],
      ['column-rear-1', 'column-front-1', 3, 90],
      ['column-end-bolt-1', 'column-rear-1', 3, 90],
    ].map(([occurrence, mateId, diameter, angleDegrees]) => {
      const thread = externalThreads.find(
        (candidate) => candidate.componentId === occurrence && candidate.diameter === diameter,
      );
      assert.ok(thread, `Missing physical control thread: ${occurrence} M${diameter}`);
      return { occurrence, mateId, origin: thread.origin, axis: thread.axis, angleDegrees };
    });
    const source = withGeometryMode('full', () => componentPython(libraries, pieces));
    const script = `import FreeCAD as App, Part, math, json
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
pairs=json.loads(${JSON.stringify(JSON.stringify(pairs))})
control_specs=json.loads(${JSON.stringify(JSON.stringify(controlSpecs))})
results=[]
for pair in pairs:
 a,b=components[pair['first']],components[pair['second']]
 for shape in [a,b]:
  assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1
  assert math.isfinite(shape.Volume) and shape.Volume>0
 volume=a.common(b).Volume
 assert math.isfinite(volume) and abs(volume)<=pair['overlapBudgetMm3'],(pair,volume)
 results.append(dict(occurrenceIds=[ids[pair['first']],ids[pair['second']]],overlapMm3=volume,overlapBudgetMm3=pair['overlapBudgetMm3']))
controls=[]
for control in control_specs:
 occurrence,mateId=control['occurrence'],control['mateId']
 misphased=components[ids.index(occurrence)].copy()
 misphased.rotate(App.Vector(*control['origin']),App.Vector(*control['axis']),control['angleDegrees'])
 positive=misphased.common(components[ids.index(mateId)]).Volume
 assert positive>.001,('The deliberate phase error must intersect.',occurrence,control['angleDegrees'],positive)
 controls.append(dict(occurrenceIds=[occurrence,mateId],angleDegrees=control['angleDegrees'],overlapMm3=positive))
print('SFK_THREAD_MATING '+json.dumps(dict(matedPairs=results,positiveControls=controls)),flush=True)
`;
    const path = '/tmp/protolab-sfk-disc-thread-mating.py';
    writeFileSync(path, script);
    const run = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 280_000,
      maxBuffer: 4_000_000,
    });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    const line = run.stdout.split('\n').find((value) => value.startsWith('SFK_THREAD_MATING '));
    assert.ok(line);
    if (process.env.SFK_THREAD_MATING_PROOF) {
      mkdirSync(dirname(process.env.SFK_THREAD_MATING_PROOF), { recursive: true });
      writeFileSync(
        process.env.SFK_THREAD_MATING_PROOF,
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceSha256: createHash('sha256').update(script).digest('hex'),
            runtimeSha256: createHash('sha256')
              .update(readFileSync(process.env.FREECAD_PYTHON!))
              .digest('hex'),
            // This numerical budget applies only to the declared helical mating pairs.
            // It does not exempt nominal M6 shaft/nut interference or unrelated component collisions.
            ...JSON.parse(line.slice('SFK_THREAD_MATING '.length)),
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
