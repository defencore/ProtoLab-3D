import { spawn, execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const tsxLoader = import.meta.resolve('tsx');
const catalogFile = /^tests\/parts-catalog-([1-9]\d*)\.test\.ts$/;
export const catalogContractsPerFamily = 5;

export async function discoverTestFiles(root = projectRoot) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && file.endsWith('.test.ts')) files.push(file);
    }
  }
  await visit('tests');
  return files.sort();
}

export function testChildEnvironment(environment = process.env) {
  const result = { ...environment };
  // This internal Node flag belongs to the caller's test worker, never its new runner.
  delete result.NODE_TEST_CONTEXT;
  return result;
}

export async function loadTestInventory(root = projectRoot, environment = process.env) {
  const { stdout } = await execute(
    process.execPath,
    ['--import', tsxLoader, fileURLToPath(new URL('./test-runner-inventory.ts', import.meta.url))],
    { cwd: root, env: testChildEnvironment(environment), maxBuffer: 1024 * 1024 },
  );
  const inventory = { ...JSON.parse(stdout), files: await discoverTestFiles(root) };
  const wrappers = inventory.files.filter((file) => catalogFile.test(file));
  if (wrappers.length !== inventory.catalogShardCount)
    throw new Error('Catalog wrapper count does not match the contract shard count.');
  for (const file of wrappers) {
    const shard = Number(catalogFile.exec(file)[1]) - 1;
    const source = await readFile(path.join(root, file), 'utf8');
    const registrations = [...source.matchAll(/registerPartContractTests\(\s*(\d+)\s*\)/g)];
    if (registrations.length !== 1 || Number(registrations[0][1]) !== shard)
      throw new Error(`Unexpected catalog shard registration: ${file}`);
  }
  return inventory;
}

export function createExecutionPlan({
  files,
  partIds,
  catalogShardCount,
  mode = 'full',
  affectedParts = [],
}) {
  if (!['full', 'affected'].includes(mode)) throw new Error('Invalid execution mode.');
  for (const [name, values] of Object.entries({ files, partIds, affectedParts })) {
    if (
      !Array.isArray(values) ||
      values.some((value) => typeof value !== 'string') ||
      new Set(values).size !== values.length
    )
      throw new Error(`Invalid execution ${name}.`);
  }
  if (!Number.isInteger(catalogShardCount) || catalogShardCount < 1)
    throw new Error('Invalid catalog shard count.');
  if (!partIds.length || partIds.some((id) => !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)))
    throw new Error('Invalid catalog registry.');
  if (affectedParts.some((id) => !partIds.includes(id)))
    throw new Error('Affected execution scope contains an unknown family.');
  for (const file of files) {
    if (!/^tests\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.test\.ts$/.test(file))
      throw new Error(`Invalid execution test path: ${file}`);
    const match = catalogFile.exec(file);
    if (match && Number(match[1]) > catalogShardCount)
      throw new Error(`Unknown catalog wrapper: ${file}`);
  }
  const selectedFiles = [...files].sort();
  const ordinaryFiles = selectedFiles.filter((file) => !catalogFile.test(file));
  const catalogFiles = selectedFiles.filter((file) => catalogFile.test(file));
  const scope = mode === 'full' ? new Set(partIds) : new Set(affectedParts);
  const catalogFamilies = partIds.flatMap((id, index) => {
    const shard = index % catalogShardCount;
    const file = `tests/parts-catalog-${shard + 1}.test.ts`;
    return scope.has(id) && catalogFiles.includes(file) ? [{ id, shard, file }] : [];
  });
  const jobs = [
    ...(ordinaryFiles.length ? [{ id: 'ordinary', kind: 'ordinary', files: ordinaryFiles }] : []),
    ...catalogFamilies.map((family) => ({
      id: `catalog-${family.id}`,
      kind: 'catalog',
      files: [family.file],
      familyId: family.id,
      shard: family.shard,
      expectedTests: catalogContractsPerFamily,
    })),
  ];
  return {
    mode,
    affectedParts: [...affectedParts],
    registryPartIds: [...partIds],
    catalogShardCount,
    selectedFiles,
    ordinaryFiles,
    catalogFamilies,
    emptyCatalogFiles: catalogFiles.filter(
      (file) => !catalogFamilies.some((family) => family.file === file),
    ),
    expectedCatalogContracts: catalogFamilies.length * catalogContractsPerFamily,
    jobs,
  };
}

/** Read Node's final TAP counters; missing, empty and truncated results cannot pass. */
export function parseTapSummary(tap) {
  const summary = {};
  for (const name of ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const values = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)\\r?$`, 'gm'))];
    if (values.length !== 1) throw new Error(`Missing or ambiguous TAP ${name} count.`);
    summary[name] = Number(values[0][1]);
  }
  return summary;
}

async function writeManifest(output, manifest) {
  const temporary = path.join(output, 'manifest.json.tmp');
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, path.join(output, 'manifest.json'));
}

function signalOwnedChild(child, signal) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function runTestJob(job, { root, output, environment, onChild }) {
  const stdoutPath = `${job.id}.tap`;
  const stderrPath = `${job.id}.stderr.log`;
  const stdout = createWriteStream(path.join(output, stdoutPath));
  const stderr = createWriteStream(path.join(output, stderrPath));
  let child;
  let loggingError;
  const logsFinished = Promise.all([finished(stdout), finished(stderr)]).catch((error) => {
    loggingError = error.message;
    // A child without a writable audit log cannot produce a reviewable result.
    signalOwnedChild(child, 'SIGTERM');
  });
  const env = testChildEnvironment(environment);
  if (job.kind === 'catalog') env.PROTOLAB_TEST_PARTS = JSON.stringify([job.familyId]);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const args = [
    '--import',
    tsxLoader,
    '--test',
    '--test-concurrency=1',
    '--test-reporter=tap',
    ...job.files,
  ];
  child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  onChild(child);
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  let spawnError;
  child.once('error', (error) => {
    spawnError = error.message;
  });
  let exitCode, signal;
  try {
    [exitCode, signal] = await new Promise((resolve) =>
      child.once('close', (...values) => resolve(values)),
    );
    await logsFinished;
  } finally {
    onChild(undefined);
  }
  const result = {
    ...job,
    status: 'failed',
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
    exitCode,
    signal,
    childPid: child.pid,
    args,
    partScope: env.PROTOLAB_TEST_PARTS === undefined ? null : JSON.parse(env.PROTOLAB_TEST_PARTS),
    stdoutPath,
    stderrPath,
  };
  try {
    if (spawnError) throw new Error(spawnError);
    if (loggingError) throw new Error(`Cannot save child output: ${loggingError}`);
    result.counts = parseTapSummary(await readFile(path.join(output, stdoutPath), 'utf8'));
    if (exitCode !== 0 || signal) throw new Error(`Child failed (${signal ?? exitCode}).`);
    const counts = result.counts;
    if (counts.tests === 0 || counts.pass === 0 || counts.fail || counts.cancelled || counts.todo)
      throw new Error('Child did not complete a nonempty successful test selection.');
    if (
      job.kind === 'catalog' &&
      (counts.tests !== job.expectedTests || counts.pass !== job.expectedTests || counts.skipped)
    )
      throw new Error(`Expected all ${job.expectedTests} catalog contracts without skips.`);
    result.status = 'passed';
  } catch (error) {
    result.error = error.message;
  }
  return result;
}

export async function runExecutionPlan(
  plan,
  {
    root = projectRoot,
    output = path.join(
      root,
      'test-results/test-runs',
      `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`,
    ),
    environment = process.env,
    report = (message) => process.stdout.write(`${message}\n`),
  } = {},
) {
  await mkdir(path.dirname(output), { recursive: true });
  // Reusing an old output directory could confuse interrupted and complete runs.
  await mkdir(output);
  const env = testChildEnvironment(environment);
  delete env.PROTOLAB_TEST_PARTS;
  if (plan.mode === 'affected') env.PROTOLAB_TEST_PARTS = JSON.stringify(plan.affectedParts);
  const manifest = {
    version: 1,
    status: 'running',
    startedAt: new Date().toISOString(),
    mode: plan.mode,
    selectedFiles: plan.selectedFiles,
    affectedParts: plan.affectedParts,
    registryPartIds: plan.registryPartIds,
    catalogShardCount: plan.catalogShardCount,
    catalogContractsPerFamily,
    selectedFileCount: plan.selectedFiles.length,
    ordinaryFileCount: plan.ordinaryFiles.length,
    catalogFamilies: plan.catalogFamilies,
    catalogFamilyCount: plan.catalogFamilies.length,
    expectedCatalogContracts: plan.expectedCatalogContracts,
    emptyCatalogFiles: plan.emptyCatalogFiles,
    jobs: plan.jobs.map((job) => ({ ...job, status: 'pending' })),
  };
  await writeManifest(output, manifest);
  report(
    `Selected ${manifest.selectedFileCount} files, ${manifest.catalogFamilyCount} catalog families (${manifest.expectedCatalogContracts} contracts).`,
  );
  report(`Test results: ${output}`);
  let activeChild;
  let interrupted;
  const interrupt = (signal) => {
    interrupted = signal;
    signalOwnedChild(activeChild, signal);
  };
  const handlers = new Map(
    ['SIGINT', 'SIGTERM'].map((signal) => [signal, () => interrupt(signal)]),
  );
  for (const [signal, handler] of handlers) process.on(signal, handler);
  try {
    for (const [index, job] of plan.jobs.entries()) {
      if (interrupted) break;
      manifest.jobs[index] = { ...job, status: 'running' };
      await writeManifest(output, manifest);
      if (interrupted) break;
      report(`[${index + 1}/${plan.jobs.length}] ${job.id}`);
      const result = await runTestJob(job, {
        root,
        output,
        environment: env,
        onChild: (child) => {
          activeChild = child;
          if (interrupted) signalOwnedChild(activeChild, interrupted);
        },
      });
      manifest.jobs[index] = result;
      await writeManifest(output, manifest);
      report(
        `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${job.id} (${(result.durationMs / 1000).toFixed(1)}s)${result.error ? `: ${result.error}` : ''}`,
      );
      if (result.status === 'failed') {
        report(await readFile(path.join(output, result.stdoutPath), 'utf8'));
        report(await readFile(path.join(output, result.stderrPath), 'utf8'));
      }
    }
  } catch (error) {
    manifest.error = error.message;
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
  const completed = manifest.jobs.filter(
    (job) => job.status === 'passed' || job.status === 'failed',
  );
  manifest.counts = Object.fromEntries(
    ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((key) => [
      key,
      completed.reduce((total, job) => total + (job.counts?.[key] ?? 0), 0),
    ]),
  );
  manifest.completedJobs = completed.length;
  manifest.failedJobs = completed.filter((job) => job.status === 'failed').length;
  manifest.completedCatalogContracts = completed
    .filter((job) => job.kind === 'catalog' && job.status === 'passed')
    .reduce((total, job) => total + job.counts.pass, 0);
  manifest.finishedAt = new Date().toISOString();
  if (interrupted) manifest.signal = interrupted;
  manifest.status =
    interrupted ||
    manifest.error ||
    manifest.failedJobs ||
    completed.length !== plan.jobs.length ||
    manifest.completedCatalogContracts !== plan.expectedCatalogContracts
      ? 'failed'
      : plan.jobs.length
        ? 'passed'
        : 'skipped';
  await writeManifest(output, manifest);
  report(
    `${manifest.status.toUpperCase()}: ${completed.length}/${plan.jobs.length} jobs; ${manifest.counts.pass} passed, ${manifest.counts.fail} failed, ${manifest.counts.skipped} skipped. Manifest: ${path.join(output, 'manifest.json')}`,
  );
  return manifest;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1]))
    throw new Error('Usage: test-runner.mjs [--output <new-directory>]');
  const inventory = await loadTestInventory();
  const plan = createExecutionPlan(inventory);
  const manifest = await runExecutionPlan(plan, {
    output: args.length ? path.resolve(args[1]) : undefined,
  });
  if (manifest.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
