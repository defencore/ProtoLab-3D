import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
// @ts-expect-error Dependency-free Node CLI is shared with GitHub Actions.
import { partitionTests, testEnvironment, validatePlan } from '../scripts/ci/run-tests.mjs';
// @ts-expect-error Dependency-free Node CLI is shared with GitHub Actions.
import { findSuccessfulBase } from '../scripts/ci/successful-base.mjs';

const execute = promisify(execFile);
const runner = fileURLToPath(new URL('../scripts/ci/run-tests.mjs', import.meta.url));
const fixturePlan = () => ({
  mode: 'affected', reason: 'Part changed.', tests: ['tests/example.test.ts'],
  pythonTests: [], affectedParts: ['example'], packageIds: ['example'],
});

test('test groups cover exactly the selected files with no duplicate execution', () => {
  const files = Array.from({ length: 19 }, (_, index) => `tests/test-${index}.test.ts`);
  const groups = Array.from({ length: 8 }, (_, index) => partitionTests(files, index + 1, 8));
  assert.deepEqual(groups.flat().sort(), files.sort());
  assert.equal(new Set(groups.flat()).size, files.length);
  assert.deepEqual(partitionTests([], 1, 1), []);
  assert.throws(() => partitionTests(files, 0, 8), /Invalid test shard/);
  assert.throws(() => partitionTests(files, 1, 0), /Invalid test shard/);
});

test('scope is explicit, empty means none and full mode clears inherited filters', () => {
  const plan = fixturePlan();
  assert.equal(testEnvironment(plan, {}).PROTOLAB_TEST_PARTS, '["example"]');
  assert.equal(testEnvironment({ ...plan, affectedParts: [] }, {}).PROTOLAB_TEST_PARTS, '[]');
  assert.equal(testEnvironment({ ...plan, mode: 'full' }, {
    PROTOLAB_TEST_PARTS: '["obsolete"]',
  }).PROTOLAB_TEST_PARTS, undefined);
});

test('invalid or ambiguous test plans cannot turn into a shell command or a full-suite run', () => {
  assert.equal(validatePlan(fixturePlan()).tests.length, 1);
  for (const patch of [
    { mode: 'unknown' }, { tests: undefined }, { tests: ['tests/../private.test.ts'] },
    { tests: ['--test'] }, { tests: ['tests/a.test.ts', 'tests/a.test.ts'] },
    { pythonTests: ['tests/a.py;exit'] }, { affectedParts: ['../example'] },
  ]) assert.throws(() => validatePlan({ ...fixturePlan(), ...patch }));
});

test('empty selection skips the runner and emits a safe disabled matrix', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'protolab-ci-runner-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const planPath = path.join(directory, 'plan.json');
  const output = path.join(directory, 'github-output');
  await writeFile(planPath, JSON.stringify({ ...fixturePlan(), tests: [], affectedParts: [], packageIds: [] }));
  const result = await execute(process.execPath, [runner, 'run', '--plan', planPath, '--shard', '1', '--shards', '1']);
  assert.match(result.stdout, /No affected test files/);
  assert.doesNotMatch(result.stdout, /TAP version/);
  await execute(process.execPath, [runner, 'matrix', '--plan', planPath], {
    env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: '' },
  });
  assert.equal(await readFile(output, 'utf8'), 'matrix={"shard":[1]}\nshards=1\nhas-tests=false\n');
  await assert.rejects(execute(process.execPath, [runner, 'unknown', '--plan', planPath]));
});

test('only a successful ancestor push on the target branch can become the baseline', async () => {
  const sha = (character: string) => character.repeat(40);
  const accepted: string[] = [];
  const result = await findSuccessfulBase({
    repository: 'owner/repo', branch: 'main', currentRunId: '8', token: 'test-token',
    fetchImpl: async (url: URL, options: RequestInit) => {
      assert.equal(url.searchParams.get('status'), 'success');
      assert.equal(url.searchParams.get('event'), 'push');
      assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer test-token');
      return { ok: true, json: async () => ({ workflow_runs: [
        { id: 8, event: 'push', conclusion: 'success', head_branch: 'main', head_sha: sha('a') },
        { id: 7, event: 'push', conclusion: 'failure', head_branch: 'main', head_sha: sha('b') },
        { id: 6, event: 'pull_request', conclusion: 'success', head_branch: 'main', head_sha: sha('c') },
        { id: 5, event: 'push', conclusion: 'success', head_branch: 'other', head_sha: sha('d') },
        { id: 4, event: 'push', conclusion: 'success', head_branch: 'main', head_sha: sha('e') },
        { id: 3, event: 'push', conclusion: 'success', head_branch: 'main', head_sha: sha('f') },
      ] }) };
    },
    isAncestor: async (value: string) => { accepted.push(value); return value === sha('f'); },
  });
  assert.equal(result, sha('f'));
  assert.deepEqual(accepted, [sha('e'), sha('f')]);
});

test('missing baseline requires complete verification and API errors never imply success', async () => {
  const options = {
    repository: 'owner/repo', branch: 'main', currentRunId: '8', token: 'test-token',
    isAncestor: async () => true,
  };
  assert.equal(await findSuccessfulBase({ ...options,
    fetchImpl: async () => ({ ok: true, json: async () => ({ workflow_runs: [] }) }),
  }), undefined);
  await assert.rejects(findSuccessfulBase({ ...options,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), /HTTP 403/);
  await assert.rejects(findSuccessfulBase({ ...options,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  }), /Invalid workflow-run response/);
});
