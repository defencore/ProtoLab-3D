import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
// @ts-expect-error The shared Node CLI is also imported by GitHub Actions.
import * as runner from '../scripts/test-runner.mjs';

const { createExecutionPlan, loadTestInventory, parseTapSummary, runExecutionPlan } = runner;

const catalogFiles = (count: number) =>
  Array.from({ length: count }, (_, i) => `tests/parts-catalog-${i + 1}.test.ts`);

test('full execution assigns every registry family exactly once to its original contract shard', () => {
  const partIds = Array.from({ length: 298 }, (_, i) => `family-${297 - i}`);
  const files = ['tests/z.test.ts', ...catalogFiles(8), 'tests/a.test.ts'];
  const plan = createExecutionPlan({ files, partIds, catalogShardCount: 8 });
  assert.equal(plan.catalogFamilies.length, 298);
  assert.equal(plan.expectedCatalogContracts, 1490);
  assert.deepEqual(
    plan.catalogFamilies.map((family: { id: string }) => family.id),
    partIds,
  );
  assert.equal(
    new Set(plan.catalogFamilies.map((family: { id: string }) => family.id)).size,
    partIds.length,
  );
  for (const [index, family] of plan.catalogFamilies.entries()) {
    assert.equal(family.shard, index % 8);
    assert.equal(family.file, catalogFiles(8)[index % 8]);
  }
  assert.deepEqual(plan.jobs[0].files, ['tests/a.test.ts', 'tests/z.test.ts']);
  assert.deepEqual(plan.emptyCatalogFiles, []);
  assert.equal(plan.jobs.length, 299);
});

test('affected execution intersects family ownership with selected files without broadening scope', () => {
  const plan = createExecutionPlan({
    files: ['tests/ordinary.test.ts', ...catalogFiles(3)],
    partIds: ['first', 'second', 'third', 'fourth'],
    catalogShardCount: 3,
    mode: 'affected',
    affectedParts: ['fourth', 'second'],
  });
  assert.deepEqual(plan.catalogFamilies, [
    { id: 'second', shard: 1, file: 'tests/parts-catalog-2.test.ts' },
    { id: 'fourth', shard: 0, file: 'tests/parts-catalog-1.test.ts' },
  ]);
  assert.deepEqual(plan.emptyCatalogFiles, ['tests/parts-catalog-3.test.ts']);
  const partition = createExecutionPlan({
    files: ['tests/parts-catalog-1.test.ts'],
    partIds: ['first', 'second'],
    catalogShardCount: 2,
    mode: 'affected',
    affectedParts: ['second'],
  });
  assert.deepEqual(partition.jobs, []);
  for (const patch of [
    { partIds: ['same', 'same'] },
    { affectedParts: ['unknown'] },
    { files: ['tests/parts-catalog-9.test.ts'] },
    { files: ['tests/../outside.test.ts'] },
  ])
    assert.throws(() =>
      createExecutionPlan({
        files: catalogFiles(2),
        partIds: ['first', 'second'],
        catalogShardCount: 2,
        ...patch,
      }),
    );
});

test('the live inventory and all catalog wrappers cover the complete registry', async () => {
  const inventory = await loadTestInventory();
  const plan = createExecutionPlan(inventory);
  assert.equal(plan.selectedFiles.length, inventory.files.length);
  assert.equal(plan.catalogFamilies.length, inventory.partIds.length);
  assert.equal(plan.expectedCatalogContracts, inventory.partIds.length * 5);
  assert.equal(
    new Set(
      plan.jobs.flatMap((job: { kind: string; files: string[] }) =>
        job.kind === 'ordinary' ? job.files : [],
      ),
    ).size,
    inventory.files.length - inventory.catalogShardCount,
  );
});

test('TAP summaries reject missing and ambiguous completion counters', () => {
  const summary =
    '# tests 5\n# suites 0\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(parseTapSummary(summary).pass, 5);
  assert.throws(() => parseTapSummary('TAP version 13\n'), /TAP tests/);
  assert.throws(() => parseTapSummary(`${summary}# pass 5\n`), /TAP pass/);
});

async function fixture(context: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'protolab-test-runner-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'tests'));
  const catalogSource = `
import test from 'node:test';
import assert from 'node:assert/strict';
const scope = JSON.parse(process.env.PROTOLAB_TEST_PARTS);
assert.equal(scope.length, 1);
assert.equal(globalThis.previousFamily, undefined);
globalThis.previousFamily = scope[0];
if (scope[0] !== 'empty') for (let index = 0; index < 5; index++)
  test(scope[0] + ' contract ' + index, () => {
    assert.ok(scope[0] !== 'bad' || index !== 2, 'fixture child failure');
  });
`;
  for (const file of catalogFiles(2)) await writeFile(path.join(root, file), catalogSource);
  await writeFile(
    path.join(root, 'tests/ordinary.test.ts'),
    `
import test from 'node:test';
import assert from 'node:assert/strict';
test('ordinary scope', () => assert.equal(process.env.PROTOLAB_TEST_PARTS, process.env.EXPECTED_SCOPE));
`,
  );
  return root;
}

test('actual children receive exact scopes and separate processes, with finalized TAP and manifest', async (context) => {
  const root = await fixture(context);
  const plan = createExecutionPlan({
    files: ['tests/ordinary.test.ts', ...catalogFiles(2)],
    partIds: ['alpha', 'beta'],
    catalogShardCount: 2,
    mode: 'affected',
    affectedParts: ['alpha', 'beta'],
  });
  const result = await runExecutionPlan(plan, {
    root,
    output: path.join(root, 'results'),
    report: () => {},
    environment: {
      ...process.env,
      NODE_TEST_CONTEXT: 'child-v8',
      EXPECTED_SCOPE: '["alpha","beta"]',
    },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.completedJobs, 3);
  assert.equal(result.completedCatalogContracts, 10);
  assert.equal(result.counts.pass, 11);
  assert.equal(new Set(result.jobs.map((job: { childPid: number }) => job.childPid)).size, 3);
  assert.deepEqual(
    result.jobs.map((job: { partScope: string[] }) => job.partScope),
    [['alpha', 'beta'], ['alpha'], ['beta']],
  );
  for (const job of result.jobs) {
    assert.equal(job.exitCode, 0);
    assert.equal(job.signal, null);
    assert.ok(
      (await readFile(path.join(root, 'results', job.stdoutPath), 'utf8')).includes('# tests'),
    );
  }
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, 'results/manifest.json'), 'utf8')),
    result,
  );
  await assert.rejects(
    runExecutionPlan(plan, { root, output: path.join(root, 'results'), report: () => {} }),
    /EEXIST/,
  );
});

test('failed and empty family children cannot pass or prevent remaining contracts from running', async (context) => {
  const root = await fixture(context);
  const plan = createExecutionPlan({
    files: catalogFiles(2),
    partIds: ['bad', 'empty', 'good'],
    catalogShardCount: 2,
  });
  const result = await runExecutionPlan(plan, {
    root,
    output: path.join(root, 'results'),
    report: () => {},
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.completedJobs, 3);
  assert.equal(result.failedJobs, 2);
  assert.deepEqual(
    result.jobs.map((job: { status: string }) => job.status),
    ['failed', 'failed', 'passed'],
  );
  assert.equal(result.jobs[0].counts.fail, 1);
  assert.notEqual(result.jobs[0].exitCode, 0);
  assert.match(result.jobs[1].error, /Expected all 5 catalog contracts/);
  assert.equal(result.completedCatalogContracts, 5);
});

test('an explicitly empty catalog intersection is recorded as skipped and never as passed', async (context) => {
  const root = await fixture(context);
  const plan = createExecutionPlan({
    files: catalogFiles(2),
    partIds: ['alpha', 'beta'],
    catalogShardCount: 2,
    mode: 'affected',
    affectedParts: [],
  });
  const result = await runExecutionPlan(plan, {
    root,
    output: path.join(root, 'results'),
    report: () => {},
  });
  assert.equal(result.status, 'skipped');
  assert.equal(result.completedJobs, 0);
  assert.equal(result.counts.tests, 0);
  assert.deepEqual(result.emptyCatalogFiles, catalogFiles(2));
});

test('cancellation during job startup records failure and starts no later family', async (context) => {
  const root = await fixture(context);
  const plan = createExecutionPlan({
    files: catalogFiles(2),
    partIds: ['alpha', 'beta'],
    catalogShardCount: 2,
  });
  const result = await runExecutionPlan(plan, {
    root,
    output: path.join(root, 'results'),
    report: (message: string) => {
      if (message.startsWith('[1/')) process.emit('SIGTERM');
    },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.signal, 'SIGTERM');
  assert.equal(result.jobs[0].status, 'failed');
  assert.equal(result.jobs[1].status, 'pending');
});

test('an unwritable job log records failure and reaps the owned child', async (context) => {
  const root = await fixture(context);
  const output = path.join(root, 'results');
  const plan = createExecutionPlan({
    files: ['tests/parts-catalog-1.test.ts'],
    partIds: ['alpha'],
    catalogShardCount: 1,
  });
  const result = await runExecutionPlan(plan, {
    root,
    output,
    report: (message: string) => {
      if (message.startsWith('[1/')) {
        // The directory is prepared synchronously before the log stream opens.
        mkdirSync(path.join(output, 'catalog-alpha.tap'));
      }
    },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.jobs[0].status, 'failed');
  assert.match(result.jobs[0].error, /Cannot save child output/);
  assert.equal(result.completedJobs, 1);
});
