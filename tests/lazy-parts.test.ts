import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartLoader, type PartModuleImport } from '../src/core/lazy-parts';
import bolt from '../src/parts/bolt-screw/index';
import washer from '../src/parts/washer/index';
import type { PartModule } from '../src/core/part-modules';

test('workers import only requested modules and deduplicate their dependency closure', async () => {
  const calls: string[] = [];
  const tracked =
    (id: string, module: PartModule): PartModuleImport =>
    async () => {
      calls.push(id);
      return { default: module };
    };
  const load = createPartLoader({
    'bolt-screw': tracked('bolt-screw', { ...bolt, dependencies: ['washer'] }),
    washer: tracked('washer', washer),
    unused: async () => {
      throw new Error('Unrelated catalog data must not be loaded.');
    },
  });
  const first = await load(['bolt-screw', 'washer', 'bolt-screw']);
  assert.deepEqual(
    first.map((part) => part.id),
    ['bolt-screw', 'washer'],
  );
  assert.deepEqual(calls.sort(), ['bolt-screw', 'washer']);
  assert.equal(first[0], bolt.part);
  assert.equal(first[1], washer.part);
  await load(['bolt-screw']);
  assert.equal(calls.length, 2);
});

test('lazy imports preserve module validation and fail on missing, mismatched or cyclic dependencies', async () => {
  await assert.rejects(createPartLoader({})(['missing']), /Unknown library product/);
  await assert.rejects(
    createPartLoader({ 'bolt-screw': async () => ({ default: washer }) })(['bolt-screw']),
    /does not match/,
  );
  await assert.rejects(
    createPartLoader({
      'bolt-screw': async () => ({ default: { ...bolt, apiVersion: 1 } as unknown as PartModule }),
    })(['bolt-screw']),
    /Unsupported part module API/,
  );
  await assert.rejects(
    createPartLoader({
      'bolt-screw': async () => ({ default: { ...bolt, dependencies: ['washer'] } }),
      washer: async () => ({ default: { ...washer, dependencies: ['bolt-screw'] } }),
    })(['bolt-screw']),
    /Cyclic part dependency/,
  );
});

test('a failed module import can be retried without caching its rejection', async () => {
  let attempts = 0;
  const load = createPartLoader({
    'bolt-screw': async () => {
      if (++attempts === 1) throw new Error('Interrupted module download.');
      return { default: bolt };
    },
  });
  await assert.rejects(load(['bolt-screw']), /Interrupted module download/);
  assert.equal((await load(['bolt-screw']))[0], bolt.part);
  assert.equal(attempts, 2);
});
