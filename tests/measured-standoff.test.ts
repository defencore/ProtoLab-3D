import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { refreshedPresets } from '../scripts/sync-package-catalogs';
import { resolveLibraryEntry } from '../src/core/library-identity';
import { modelEvidence } from '../src/core/model-evidence';
import { disposeModel } from '../src/core/mechanical';
import { initializeManifoldGeometry } from '../src/core/assembly/manifold-boundary';
import { validateParameters } from '../src/core/validation';
import part from '../src/parts/pcb-standoff/part';
import { pieces } from '../src/parts/pcb-standoff/lib/model';

const id = 'user-m3x10-af4-7-ac5-2';
const preset = part.presets.find((candidate) => candidate.id === id)!;

test('the measured coupling is a separate fixed reference and does not resize DREMEC', () => {
  assert.ok(preset);
  assert.equal(resolveLibraryEntry([part], `${part.id}:${id}`)?.preset, preset);
  assert.deepEqual(validateParameters(part, preset.parameters, 'default'), []);
  assert.ok(validateParameters(part, { ...preset.parameters, bodyWidth: 5.5 }, 'default').length);
  const dremec = part.presets.find((candidate) => candidate.id === 'dremec-114x10')!;
  assert.equal(dremec.parameters.bodyWidth, 5.5);
  assert.equal(dremec.parameters.cornerDiameter, 0);
  assert.equal(dremec.catalog?.manufacturer, 'DREMEC');
  assert.equal(preset.catalog?.manufacturer, undefined);
  assert.equal(preset.catalog?.productCodes, undefined);
  assert.equal(preset.parameters.threadPitchA, 0);
  assert.equal(preset.parameters.threadPitchB, 0);
  assert.equal(modelEvidence(part, preset.parameters, id).kind, 'envelope');
  assert.ok(!preset.catalog?.verifiedParameters.includes('threadedThrough'));
  assert.match(preset.catalog!.geometryEvidence!.limitations, /installation assumption/);
});

test('the measured body preserves AF and AC independently with native analytic clipping', async () => {
  assert.deepEqual(part.dimensions(preset.parameters, 'default'), [5.2, 4.7, 10]);
  const shape = pieces(preset.parameters)[0].shape;
  assert.ok(shape.kind === 'subtract');
  assert.equal(shape.children[0].kind, 'intersect');
  const native = part.python(preset.parameters, 'default');
  assert.match(native, /makeCylinder\(2\.6,10/);
  assert.match(native, /\.common\(/);
  await initializeManifoldGeometry();
  const model = part.buildGeometry(preset.parameters, 'default');
  try {
    model.updateMatrixWorld(true);
    const size = new Box3().setFromObject(model, true).getSize(new Vector3());
    for (const [actual, expected] of size.toArray().map((v, i) => [v, [5.2, 4.7, 10][i]]))
      assert.ok(Math.abs(actual - expected) < 0.002, `${actual} vs ${expected}`);
  } finally {
    disposeModel(model);
  }
});

test('offline authoritative catalog regeneration retains the measured source and its limits', () => {
  const refreshed = refreshedPresets(part);
  assert.equal(refreshed.filter((candidate) => candidate.id === id).length, 1);
  assert.deepEqual(
    refreshed.find((candidate) => candidate.id === id),
    preset,
  );
});
