import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const namespace = 'protolab-full-tests-v1';

// Hash every tracked input used by the full test runner, including source data
// and local reference assets. Deployment-only entry points, Vite's base URL,
// and documentation are excluded; every deployment still builds and typechecks.
const roots = ['src/', 'tests/', 'scripts/', 'data/', 'public/', '.github/workflows/'];
const isTestInput = (file) =>
  roots.some((root) => file.startsWith(root)) ||
  file === 'package.json' ||
  file === 'package-lock.json' ||
  /^tsconfig[^/]*\.json$/.test(file);

/** Fingerprint the full suite's tracked files and the exact Node execution platform. */
export async function computeTestKey(
  root,
  runtime = { version: process.version, platform: process.platform, arch: process.arch },
) {
  for (const field of ['version', 'platform', 'arch']) {
    if (typeof runtime[field] !== 'string' || !runtime[field])
      throw new Error(`A nonempty runtime ${field} is required.`);
  }
  const repository = await realpath(root);
  const { stdout: topLevel } = await execute('git', ['rev-parse', '--show-toplevel'], {
    cwd: repository,
  });
  if ((await realpath(topLevel.trim())) !== repository)
    throw new Error('The test fingerprint must run from the Git repository root.');

  const { stdout } = await execute('git', ['ls-files', '--cached', '-z'], {
    cwd: repository,
    maxBuffer: 16 * 1024 * 1024,
  });
  const files = [...new Set(stdout.split('\0').filter(isTestInput))].sort((a, b) =>
    Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
  if (!files.length) throw new Error('No tracked full-test inputs were found.');

  const hash = createHash('sha256');
  // Length-prefix every entry so file boundaries cannot produce ambiguous hashes.
  function add(value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    hash.update(`${bytes.length}:`);
    hash.update(bytes);
  }
  add(namespace);
  for (const field of ['version', 'platform', 'arch']) add(runtime[field]);
  for (const file of files) {
    const absolute = path.join(repository, file);
    if (!(await lstat(absolute)).isFile())
      throw new Error(`Test inputs must be regular files: ${file}`);
    add(file);
    add(await readFile(absolute));
  }
  return `${namespace}-${hash.digest('hex')}`;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length > 1 || (arguments_.length && arguments_[0] !== '--github-output'))
    throw new Error('Usage: node scripts/ci-test-key.mjs [--github-output]');
  if (arguments_.length && !process.env.GITHUB_OUTPUT)
    throw new Error('--github-output requires GITHUB_OUTPUT.');
  const key = await computeTestKey(process.cwd());
  if (arguments_.length) await appendFile(process.env.GITHUB_OUTPUT, `key=${key}\n`);
  process.stdout.write(`${key}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
