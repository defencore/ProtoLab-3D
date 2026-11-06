import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import actuator, { actuatorPieces } from '../src/parts/sfk-rotary-actuator/part';
import { libraries } from '../src/parts/sfk-rotary-actuator/lib/components';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

test(
  'native closed-fork faces capture the pin-free nut-cover body at all five poses',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180_000 },
  () => {
    const cases = [-20, -10, 0, 10, 20].map((outputAngle) => {
      const all = actuatorPieces({ ...actuator.defaults, outputAngle });
      const moving = all.filter((piece) => piece.component.id === 'nut-yoke');
      const fixed = all.filter((piece) =>
        ['output-front-crank', 'output-rear-crank'].includes(piece.component.id),
      );
      assert.equal(moving.length, 1);
      assert.equal(fixed.length, 2);
      const pieces = [...moving, ...fixed];
      const metadata = pieces.map((piece) => ({ AssemblyOccurrenceId: piece.component.id }));
      const source =
        withGeometryMode('simple', () => componentPython(libraries, pieces)) +
        `\ncomponent_metadata=json.loads(${JSON.stringify(JSON.stringify(metadata))})\n`;
      return { parameters: { outputAngle }, mode: 'simple', source };
    });
    const path = '/tmp/protolab-sfk-closed-fork-antiroll-cases.json';
    const reportPath = '/tmp/protolab-sfk-closed-fork-antiroll-report.json';
    writeFileSync(path, JSON.stringify(cases));
    const verifier = resolve('scripts/verify-sfk-antiroll.py');
    const run = spawnSync(process.env.FREECAD_PYTHON!, [verifier, path, reportPath], {
      encoding: 'utf8',
      env: process.env,
      timeout: 170_000,
      maxBuffer: 2_000_000,
    });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    const line = run.stdout.split('\n').find((value) => value.startsWith('SFK_ANTI_ROTATION '));
    assert.ok(line);
    const report = JSON.parse(line.slice('SFK_ANTI_ROTATION '.length));
    assert.equal(report.poses.length, 5);
    assert.ok(report.passed);
    if (process.env.SFK_ANTI_ROTATION_PROOF) {
      mkdirSync(dirname(process.env.SFK_ANTI_ROTATION_PROOF), { recursive: true });
      writeFileSync(
        process.env.SFK_ANTI_ROTATION_PROOF,
        JSON.stringify(
          {
            schemaVersion: 2,
            sourceSha256: createHash('sha256')
              .update(readFileSync(verifier))
              .update(JSON.stringify(cases))
              .digest('hex'),
            runtimeSha256: createHash('sha256')
              .update(readFileSync(process.env.FREECAD_PYTHON!))
              .digest('hex'),
            ...report,
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
