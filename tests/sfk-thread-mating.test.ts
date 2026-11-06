import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Euler, Matrix4, Vector3 } from 'three';
import actuator, { actuatorPieces } from '../src/parts/sfk-rotary-actuator/part';
import { libraries } from '../src/parts/sfk-rotary-actuator/lib/components';
import {
  alignActuatorThreads,
  actuatorMatingThreads,
  actuatorExternalThreads,
} from '../src/parts/sfk-rotary-actuator/lib/mating';
import { componentPython, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';

const rotation = (piece: ConfiguredPiece) =>
  new Matrix4().makeRotationFromEuler(
    new Euler(
      ...(piece.component.placement.rotation.map((value) => (value * Math.PI) / 180) as Vec),
      'ZYX',
    ),
  );
function rolled(piece: ConfiguredPiece, angle: number): ConfiguredPiece {
  const frame = rotation(piece).multiply(new Matrix4().makeRotationZ(angle));
  const euler = new Euler().setFromRotationMatrix(frame, 'ZYX');
  return {
    ...piece,
    component: {
      ...piece.component,
      placement: {
        ...piece.component.placement,
        rotation: [euler.x, euler.y, euler.z].map((value) => (value * 180) / Math.PI) as Vec,
      },
    },
  };
}
const sameRotation = (a: ConfiguredPiece, b: ConfiguredPiece) =>
  rotation(a).elements.every(
    (value, index) => Math.abs(value - rotation(b).elements[index]) < 1e-7,
  );

function selectedPieces(ids: string[]): ConfiguredPiece[] {
  const pieces = actuatorPieces(actuator.defaults);
  return ids.map((id) => {
    const piece = pieces.find((candidate) => candidate.component.id === id);
    assert.ok(piece, `Missing actual actuator occurrence: ${id}`);
    return piece;
  });
}

test('actuator thread phase follows authored tapped features and keeps every axial datum', () => {
  const housingPair = selectedPieces(['base', 'floating-base-36-0']);
  const female = actuatorMatingThreads(housingPair).filter((thread) => thread.fixed);
  assert.ok(female.length >= 1);
  assert.ok(female.every((thread) => thread.diameter === 3 && thread.pitch === 0.5));
  const incorrect = [housingPair[0], rolled(housingPair[1], Math.PI / 6)];
  assert.equal(sameRotation(housingPair[1], incorrect[1]), false);
  const restored = alignActuatorThreads(incorrect);
  assert.ok(sameRotation(restored[1], housingPair[1]));
  assert.deepEqual(
    restored[1].component.placement.translation,
    housingPair[1].component.placement.translation,
  );

  const nutPair = selectedPieces(['output-front-clamp-bolt', 'output-front-clamp-nut']);
  const misphasedNut = [nutPair[0], rolled(nutPair[1], Math.PI / 7)];
  const alignedNut = alignActuatorThreads(misphasedNut);
  assert.ok(sameRotation(alignedNut[0], nutPair[0]));
  assert.ok(sameRotation(alignedNut[1], nutPair[1]));
  assert.deepEqual(
    alignedNut[1].component.placement.translation,
    nutPair[1].component.placement.translation,
  );

  for (const [femaleId, maleId, diameter] of [
    ['nut-yoke', 'nut-flange-60', 3],
    ['nut-yoke', 'nut-flange-120', 3],
    ['nut-yoke', 'nut-flange-240', 3],
    ['nut-yoke', 'nut-flange-300', 3],
    ['output-end-cap', 'output-shaft', 6],
  ]) {
    const studPair = selectedPieces([String(femaleId), String(maleId)]);
    const originalThreads = actuatorExternalThreads([studPair[1]]);
    assert.equal(originalThreads.length, 1);
    const base = originalThreads.find((thread) => thread.diameter === diameter)!;
    assert.ok(base, `${maleId} must expose its authored M${diameter} thread`);
    const line = new Vector3(...base.origin);
    const changedFrame = new Matrix4()
      .makeTranslation(...base.origin)
      .multiply(new Matrix4().makeRotationAxis(new Vector3(...base.axis), Math.PI / 5))
      .multiply(new Matrix4().makeTranslation(...(line.multiplyScalar(-1).toArray() as Vec)))
      .multiply(rotation(studPair[1]).setPosition(...studPair[1].component.placement.translation));
    const changedEuler = new Euler().setFromRotationMatrix(changedFrame, 'ZYX');
    const changedStud: ConfiguredPiece = {
      ...studPair[1],
      component: {
        ...studPair[1].component,
        placement: {
          translation: new Vector3().setFromMatrixPosition(changedFrame).toArray() as Vec,
          rotation: [changedEuler.x, changedEuler.y, changedEuler.z].map(
            (value) => (value * 180) / Math.PI,
          ) as Vec,
        },
      },
    };
    const restoredStud = alignActuatorThreads([studPair[0], changedStud])[1];
    const restoredThreads = actuatorExternalThreads([restoredStud]);
    originalThreads.forEach((thread, index) => {
      for (const key of ['origin', 'axis', 'radialReference'] as const)
        thread[key].forEach((value, coordinate) =>
          assert.ok(
            Math.abs(value - restoredThreads[index][key][coordinate]) < 1e-7,
            `${maleId} ${key}[${coordinate}]: ${value} -> ${restoredThreads[index][key][coordinate]}`,
          ),
        );
    });
  }

  for (const outputAngle of [-20, 0, 20]) {
    const input = actuatorPieces({ ...actuator.defaults, outputAngle });
    const once = alignActuatorThreads(input);
    const twice = alignActuatorThreads(once);
    once.forEach((piece, index) => {
      assert.deepEqual(
        piece.component.placement.translation,
        input[index].component.placement.translation,
      );
      assert.ok(sameRotation(piece, twice[index]));
      // The supplied M6 end journal is a nominal cylinder, with no male helix datum.
      if (piece.component.id.startsWith('fixed-locknut-'))
        assert.deepEqual(piece.component.placement, input[index].component.placement);
    });
  }
});

test(
  'native cover taps, clamps and end cap mate; deliberate phase errors intersect',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const pairIds = [
      ['output-front-clamp-bolt', 'output-front-clamp-nut'],
      ['output-rear-clamp-bolt', 'output-rear-clamp-nut'],
      ['nut-flange-60', 'nut-yoke'],
      ['nut-flange-120', 'nut-yoke'],
      ['nut-flange-240', 'nut-yoke'],
      ['nut-flange-300', 'nut-yoke'],
      ['base', 'floating-base-36-0'],
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
    const path = '/tmp/protolab-sfk-thread-mating.py';
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
