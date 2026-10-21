import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseTestPartScope } from './helpers/part-scope';

test('part scope distinguishes a full run from an explicitly empty affected set', () => {
  assert.equal(parseTestPartScope(undefined, ['a', 'b']), undefined);
  assert.deepEqual([...parseTestPartScope('[]', ['a', 'b'])!], []);
  assert.deepEqual([...parseTestPartScope('["b","a"]', ['a', 'b'])!], ['b', 'a']);
});

test('malformed, duplicate and unknown part scopes fail clearly', () => {
  for (const value of ['', 'a,b', 'null', '{}', 'true', '[1]', '[null]', '[["a"]]'])
    assert.throws(() => parseTestPartScope(value, ['a']), /PROTOLAB_TEST_PARTS.*JSON array/);
  assert.throws(
    () => parseTestPartScope('["removed"]', ['a']),
    /unknown current part IDs: removed/,
  );
  assert.throws(() => parseTestPartScope('["a","a"]', ['a']), /duplicate part IDs/);
});

function contractProbe(scope: string | undefined, shards: number[]) {
  const script = `
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { parts } from './src/parts/index.ts';
import washer from './src/parts/washer/index.ts';
import { registerPartModules } from './src/core/part-modules.ts';
import { registerPartContractTests } from './tests/helpers/part-contract.ts';
const selected = process.env.PROTOLAB_TEST_PARTS === undefined ? ['washer', 'enclosure'] : JSON.parse(process.env.PROTOLAB_TEST_PARTS);
const calls = [];
const definitions = ['washer', 'enclosure'].map(id => {
  const actual = parts.find(part => part.id === id);
  return {...actual, buildGeometry(...args) {
    assert.ok(selected.includes(id), 'Unchanged geometry must not be built: '+id);
    calls.push(id);
    return actual.buildGeometry(...args);
  }};
});
for (const shard of ${JSON.stringify(shards)}) registerPartContractTests(shard, definitions);
test('global registry invariants remain unfiltered', () => {
  assert.ok(parts.length > 200);
  assert.ok(parts.some(part => part.id === 'washer'));
  assert.throws(() => registerPartModules([washer, washer]), /Duplicate part module ID/);
});
after(() => {
  assert.deepEqual([...new Set(calls)].sort(), [...selected].sort());
  console.log('BUILT_PARTS='+JSON.stringify([...new Set(calls)].sort()));
});
`;
  const env = { ...process.env };
  // This is a separate runner, not a child worker using Node's binary test protocol.
  delete env.NODE_TEST_CONTEXT;
  if (scope === undefined) delete env.PROTOLAB_TEST_PARTS;
  else env.PROTOLAB_TEST_PARTS = scope;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test-reporter=tap', '--input-type=module', '-'],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env,
      input: script,
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, String(result.error ?? '') + result.stdout + result.stderr);
  return result.stdout;
}

test('affected geometry keeps its original shard and excludes all unchanged geometry', () => {
  const output = contractProbe('["enclosure"]', [1]);
  assert.match(output, /BUILT_PARTS=\["enclosure"\]/);
  assert.match(output, /# tests 6\b/);
});

test('empty part scope preserves global checks while registering no per-part contracts', () => {
  const output = contractProbe('[]', [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(output, /BUILT_PARTS=\[\]/);
  assert.match(output, /# tests 1\b/);
});

test('an omitted scope still runs every contract once across the original shards', () => {
  const output = contractProbe(undefined, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(output, /BUILT_PARTS=\["enclosure","washer"\]/);
  assert.match(output, /# tests 11\b/);
});
