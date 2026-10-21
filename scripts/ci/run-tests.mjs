import { spawn } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePlan(plan) {
  if (!plan || !['affected', 'full'].includes(plan.mode)) throw new Error('Invalid test-plan mode.');
  for (const field of ['tests', 'pythonTests', 'affectedParts', 'packageIds']) {
    if (!Array.isArray(plan[field]) || plan[field].some((value) => typeof value !== 'string') ||
        new Set(plan[field]).size !== plan[field].length)
      throw new Error(`Invalid test-plan ${field}.`);
  }
  for (const file of plan.tests)
    if (!/^tests\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.test\.ts$/.test(file))
      throw new Error(`Invalid test path: ${file}`);
  for (const file of plan.pythonTests)
    if (!/^tests\/[a-zA-Z0-9_.-]+\.py$/.test(file)) throw new Error(`Invalid Python test: ${file}`);
  for (const id of [...plan.affectedParts, ...plan.packageIds])
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid part ID: ${id}`);
  return plan;
}

export function partitionTests(files, shard, count) {
  if (!Number.isInteger(shard) || !Number.isInteger(count) || count < 1 || shard < 1 || shard > count)
    throw new Error('Invalid test shard.');
  return [...files].sort().filter((_, index) => index % count === shard - 1);
}

export function testEnvironment(plan, environment = process.env) {
  const result = { ...environment };
  delete result.PROTOLAB_TEST_PARTS;
  if (plan.mode === 'affected') result.PROTOLAB_TEST_PARTS = JSON.stringify(plan.affectedParts);
  result.PYTHONDONTWRITEBYTECODE = '1';
  return result;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? code}).`));
    });
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    if (!['--plan', '--shard', '--shards'].includes(args[index]) || !args[index + 1] || options.has(args[index]))
      throw new Error('Usage: run-tests.mjs matrix|run|packages|python --plan <file> [--shard N --shards N]');
    options.set(args[index], args[index + 1]);
  }
  if (!['matrix', 'run', 'packages', 'python'].includes(command) || !options.has('--plan'))
    throw new Error('A command and test plan are required.');
  const plan = validatePlan(JSON.parse(await readFile(options.get('--plan'), 'utf8')));
  const env = testEnvironment(plan);
  if (command === 'matrix') {
    const count = Math.max(1, Math.min(8, plan.tests.length));
    if (!process.env.GITHUB_OUTPUT) throw new Error('matrix requires GITHUB_OUTPUT.');
    await appendFile(process.env.GITHUB_OUTPUT, [
      `matrix=${JSON.stringify({ shard: Array.from({ length: count }, (_, index) => index + 1) })}`,
      `shards=${count}`, `has-tests=${plan.tests.length > 0}`, '',
    ].join('\n'));
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, [
        '### Test scope', '', `Mode: **${plan.mode}**. ${plan.reason}`, '',
        `${plan.tests.length} TypeScript test files, ${plan.pythonTests.length} Python test files.`,
        `Affected parts: ${plan.mode === 'full' ? 'complete library' : (plan.affectedParts.join(', ') || 'none')}.`,
        '', 'The complete plan is attached as the test-plan artifact.', '',
      ].join('\n'));
    return;
  }
  if (command === 'run') {
    const files = partitionTests(plan.tests, Number(options.get('--shard')), Number(options.get('--shards')));
    if (!files.length) { process.stdout.write('No affected test files in this shard.\n'); return; }
    await run(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=2', '--test-reporter=tap', ...files], env);
  } else if (command === 'packages') {
    if (plan.mode === 'full') await run(process.execPath, ['--import', 'tsx', 'scripts/parts.ts', 'check'], env);
    else for (const id of plan.packageIds)
      await run(process.execPath, ['--import', 'tsx', 'scripts/parts.ts', 'check', id], env);
    if (plan.mode === 'affected' && !plan.packageIds.length)
      process.stdout.write('No changed part packages to validate.\n');
  } else {
    for (const file of plan.pythonTests) await run('python3', [file], env);
    if (!plan.pythonTests.length) process.stdout.write('No affected Python importer tests.\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
