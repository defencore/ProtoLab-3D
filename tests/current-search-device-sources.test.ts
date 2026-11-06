import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import tracker, { gpsTrackerInterface } from '../src/parts/gps-tracker/part';
import finder, {
  jhe42bInterface,
  jhe42bModelInterface,
  jhe42bProjectReferenceInterface,
} from '../src/parts/jhe42b-finder/part';
import recoveryBuzzer from '../src/parts/recovery-buzzer/part';
import gpsSource from '../src/parts/gps-tracker/lib/source-provenance.json';
import finderSource from '../src/parts/jhe42b-finder/lib/project-source-provenance.json';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { configureProduct } from '../src/core/design-project';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

test('current GPS reuses ZX908 identity and preserves its analytic reconstruction scope', () => {
  assert.deepEqual(
    tracker.presets.map((preset) => preset.id),
    ['zx908'],
  );
  assert.equal(gpsSource.sourceComponentId, 233);
  assert.deepEqual(gpsTrackerInterface.dimensions, [35, 20, 4.5]);
  const sourceRecord = gpsSource.sourceFiles.find((source) =>
    source.path.endsWith('current_world/world_233.brep'),
  )!;
  assert.equal(
    sourceRecord.sha256,
    'df9b78cb0d49ec36433de9ee0ea2baf9ab9355bf375f43016ac492374610715d',
  );
  assert.equal(
    tracker.presets[0].catalog?.geometryEvidence?.sourceSha256,
    gpsSource.rigidEquivalenceFromPlatform.latestComponentSha256,
  );
  assert.deepEqual(
    gpsTrackerInterface.latestAssemblyFrame.translation,
    [-8.419035512031975, 20.325349715248308, 158],
  );
  assert.equal(gpsSource.rigidEquivalenceFromPlatform.symmetricDifferenceMm3, 0);
  const analyticDifference =
    (Math.PI * 4 - 64 * Math.sin(Math.PI / 16)) * 0.8 +
    (Math.PI - 16 * Math.sin(Math.PI / 16)) * 0.5;
  assert.ok(Math.abs(analyticDifference - gpsSource.comparison.libraryMinusSourceVolumeMm3) < 1e-8);
  assert.equal(gpsSource.comparison.sourceSolids, gpsSource.comparison.librarySolids);
  assert.ok(gpsSource.comparison.cornerSagittaBoundMm < 0.01);
});

test('current project JHE42B has its own fixed reference selection and does not resize the standard finder', () => {
  const reference = finder.presets.find(
    (preset) => preset.id === 'jhe42b-project-reference-26x17x15',
  )!;
  const standard = finder.presets.find((preset) => preset.id === 'jhe42b')!;
  assert.deepEqual(jhe42bInterface.dimensions, [23, 17, 17]);
  assert.deepEqual(jhe42bProjectReferenceInterface.dimensions, [26, 17, 15]);
  assert.equal(jhe42bModelInterface(reference.parameters).model, reference.id);
  assert.equal(jhe42bProjectReferenceInterface.serviceGeometryVerified, false);
  assert.deepEqual(jhe42bProjectReferenceInterface.serviceFaces, []);
  assert.equal(
    reference.catalog?.attributes,
    undefined,
    'manufacturer ratings are not copied to a project reference',
  );
  for (const [preset, dimensions, supply] of [
    [standard, [23, 17, 17], 'purchased'],
    [reference, [26, 17, 15], 'reference'],
  ] as const) {
    assert.deepEqual(validateParameters(finder, preset.parameters, 'default'), []);
    const configured = configureProduct({
      part: finder,
      parameters: preset.parameters,
      state: 'default',
      presetId: preset.id,
    });
    assert.equal(configured.supply, supply);
    assert.equal(configured.presetId, preset.id);
    const model = finder.buildGeometry(preset.parameters, 'default');
    try {
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      assert.ok(actual.every((size, index) => Math.abs(size - dimensions[index]) < 0.001));
      assert.deepEqual(finder.dimensions(preset.parameters, 'default'), dimensions);
      if (preset.id === 'jhe42b') assert.ok(model.children.length > 1);
      else assert.equal(model.children.length, 1);
    } finally {
      disposeModel(model);
    }
  }
  const query = `jhe42b-finder:${reference.id}`;
  assert.deepEqual(
    filterPresets(buildPresetIndex([finder]), { ...emptyPresetFilters(), query }).items.map(
      (entry) => entry.id,
    ),
    [query],
  );
});

test('stale JHE20B source property remains a conflict and does not select the old buzzer', () => {
  assert.equal(finderSource.sourceComponentId, 234);
  assert.match(finderSource.sourceIdentityConflict.currentLabel, /JHE42B/);
  assert.match(finderSource.sourceIdentityConflict.stalePartNumber, /JHE20B/);
  assert.deepEqual(finderSource.localDimensions, [26, 17, 15]);
  assert.deepEqual(
    jhe42bProjectReferenceInterface.latestAssemblyFrame.translation,
    [-21, -12, 158],
  );
  assert.equal(finderSource.rigidEquivalenceFromPlatform.symmetricDifferenceMm3, 0);
  assert.deepEqual(recoveryBuzzer.defaults, { model: 'jhe20b' });
  assert.deepEqual(recoveryBuzzer.dimensions(recoveryBuzzer.defaults, 'assembled'), [20, 10, 8]);
  assert.ok(validateParameters(finder, { model: 'jhe20b' }, 'default').length > 0);
});
