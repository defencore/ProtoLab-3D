import assert from 'node:assert/strict';
import test from 'node:test';
import bolt from '../src/parts/bolt-screw/part';
import { registerPartModules, type PartModule } from '../src/core/part-modules';
import { previewWorkerPartId } from '../src/components/requestWorkerOutput';
import detail from '../src/parts/manufactured-detail/part';
import { buildLibraryOutput } from '../src/core/library-output';

test('part registration retains asynchronous geometry initialization and rejects invalid hooks', () => {
  const initializeGeometry = async () => {};
  const module: PartModule = {
    apiVersion: 2,
    order: 1,
    part: { ...bolt, initializeGeometry },
  };
  assert.equal(registerPartModules([module])[0].initializeGeometry, initializeGeometry);
  assert.throws(
    () =>
      registerPartModules([
        {
          ...module,
          part: { ...module.part, initializeGeometry: true },
        } as unknown as PartModule,
      ]),
    /Geometry initialization must be a function/,
  );
});

test('cold asynchronous details use the initialized worker path for geometry and dimensions', async () => {
  const parameters = {
    ...detail.defaults,
    meshBackend: 'manifold',
    recipe: JSON.stringify({ kind: 'box', size: [12, 8, 4], origin: [0, 0, 0] }),
  };
  assert.equal(detail.preview, undefined);
  assert.equal(previewWorkerPartId(detail), detail.id);
  assert.equal(previewWorkerPartId(bolt), undefined);
  assert.equal(previewWorkerPartId({ ...bolt, preview: 'worker' }), bolt.id);
  assert.throws(() => detail.dimensions(parameters, 'default'), /initializ/i);

  // The worker awaits this hook before building one packed model with its dimensions.
  await detail.initializeGeometry?.(parameters, 'default');
  const output = buildLibraryOutput(detail, {
    kind: 'preview',
    partId: previewWorkerPartId(detail)!,
    parameters,
    state: 'default',
    geometryMode: 'simple',
  });
  assert.equal(output.kind, 'preview');
  if (output.kind !== 'preview') throw new Error('Expected a prepared preview.');
  assert.deepEqual(output.dimensions, [12, 8, 4]);
  assert.ok(output.model.meshes.length > 0);
});
