import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import before from './fixtures/tr8-geared-rocker-before-c4-sha256.json';
import { preservedStudySource } from './helpers/study-source-baselines';
import reviewedSourceRevisions from './fixtures/tr8-reviewed-source-revisions.json';
import { PACKAGE_README } from '../scripts/part-modules/templates';
import motor from '../src/parts/surpass-2845/part';
import { defaults, parameters, catalogFilterFields } from '../src/parts/surpass-2845/configurator';
import { validateParameters } from '../src/core/validation';

test('the independent quad preserves approved sources and records reviewed metadata and README revisions', () => {
  const families = new Set(Object.keys(before).map((file) => file.split('/')[2]));
  assert.deepEqual([...families].sort(), [
    'surpass-2838',
    'surpass-2845',
    'tr8-geared-rocker-actuator',
  ]);
  for (const [file, expected] of Object.entries(before)) {
    const content = readFileSync(new URL('../' + file, import.meta.url));
    const actual = createHash('sha256')
      .update(preservedStudySource(file.replace(/^src\/parts\//, ''), content))
      .digest('hex');
    const revision = (
      reviewedSourceRevisions as Record<
        string,
        { historicalSha256: string; reviewedSha256: string }
      >
    )[file];
    if (revision) {
      assert.equal(
        revision.historicalSha256,
        expected,
        'The original source checkpoint is retained.',
      );
      assert.equal(actual, revision.reviewedSha256, file);
    } else assert.equal(actual, expected, file);
  }
});

test('the reviewed 2845 configurator keeps fixed source selection and a pose-only shaft control', () => {
  assert.deepEqual(Object.keys(reviewedSourceRevisions), [
    'src/parts/surpass-2845/configurator.ts',
    'src/parts/tr8-geared-rocker-actuator/README.md',
  ]);
  assert.equal(
    readFileSync(
      new URL('../src/parts/tr8-geared-rocker-actuator/README.md', import.meta.url),
      'utf8',
    ),
    PACKAGE_README,
  );
  assert.deepEqual(defaults, { model: 'surpass-2845-3100kv' });
  assert.deepEqual(
    parameters.map((field) => field.key),
    ['model', 'shaftAngle'],
  );
  assert.deepEqual(
    parameters[0].options?.map((option) => option.value),
    motor.presets.map((preset) => preset.parameters.model),
  );
  const pose = parameters[1];
  assert.equal(pose.type, 'number');
  assert.equal(pose.unit, '°');
  assert.equal(pose.min, -1000000);
  assert.equal(pose.max, 1000000);
  assert.equal(pose.step, 1);
  assert.equal(pose.optionalWhenHidden, true);
  assert.equal(pose.visibleWhen!({ ...defaults }, 'cross-drilled'), false);
  assert.equal(pose.visibleWhen!({ ...defaults, shaftAngle: 45 }, 'cross-drilled'), true);
  assert.equal(pose.visibleWhen!({ ...defaults, shaftAngle: 45 }, 'assembled'), false);
  assert.deepEqual(
    catalogFilterFields.map((field) => field.key),
    ['bodyDiameter', 'bodyLength', 'shaftDiameter', 'shaftProjection', 'kv'],
  );
  assert.deepEqual(motor.identityParameters!({ ...defaults, shaftAngle: 45 }), defaults);
  assert.deepEqual(validateParameters(motor, defaults, 'assembled'), []);
  assert.deepEqual(validateParameters(motor, { ...defaults, shaftAngle: 45 }, 'cross-drilled'), []);
});
