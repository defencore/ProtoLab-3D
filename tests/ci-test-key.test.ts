import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

// The production helper is also invoked directly by GitHub Actions without tsx.
// @ts-expect-error The dependency-free Node helper has no declaration file.
import { computeTestKey } from '../scripts/ci-test-key.mjs';

const execute = promisify(execFile);
const helper = fileURLToPath(new URL('../scripts/ci-test-key.mjs', import.meta.url));
const runtime = { version: 'v22.14.0', platform: 'linux', arch: 'x64' };

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'protolab-ci-key-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await execute('git', ['init', '--quiet'], { cwd: root });
  const write = async (name: string, content = name) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  };
  const stage = () => execute('git', ['add', '--all'], { cwd: root });
  await write('src/core/example.ts', 'export const example = 1;');
  await stage();
  return { root, write, stage, key: () => computeTestKey(root, runtime) as Promise<string> };
}

test('the full-test key tracks contents, additions, removals and path changes', async (context) => {
  const { root, write, stage, key } = await fixture(context);
  const original = await key();
  assert.match(original, /^protolab-full-tests-v1-[a-f0-9]{64}$/);
  assert.equal(await key(), original);
  await write('src/core/example.ts', 'export const example = 2;');
  const changed = await key();
  assert.notEqual(changed, original);
  await write('src/core/extra.ts', 'export const extra = true;');
  assert.equal(await key(), changed, 'Only tracked files are published and fingerprinted.');
  await stage();
  const added = await key();
  assert.notEqual(added, changed);
  await rename(path.join(root, 'src/core/extra.ts'), path.join(root, 'src/core/renamed.ts'));
  await stage();
  assert.notEqual(
    await key(),
    added,
    'A rename changes the input identity, even with identical bytes.',
  );
  await rm(path.join(root, 'src/core/renamed.ts'));
  await stage();
  assert.equal(await key(), changed, 'Removing the extra input restores the prior content key.');
});

test('all test input roots and exact runtime versions invalidate the key', async (context) => {
  const { root, write, stage, key } = await fixture(context);
  for (const name of [
    'src/parts/example/presets.json',
    'tests/example.test.ts',
    'scripts/part-modules/example.ts',
    'data/promtehimport-inventory.json',
    'public/references/dimensions.png',
    '.github/workflows/pages.yml',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.tests.json',
  ]) {
    const before = await key();
    await write(name);
    await stage();
    assert.notEqual(await key(), before, name);
  }
  const original = await key();
  for (const patch of [{ version: 'v22.14.1' }, { platform: 'darwin' }, { arch: 'arm64' }])
    assert.notEqual(await computeTestKey(root, { ...runtime, ...patch }), original);
  await assert.rejects(computeTestKey(root, { ...runtime, version: '' }), /runtime version/);
});

test('documentation and deployment-only entry points do not rerun unchanged tests', async (context) => {
  const { write, stage, key } = await fixture(context);
  const original = await key();
  for (const name of ['README.md', 'docs/deployment.md', 'vite.config.ts', 'index.html', 'CNAME'])
    await write(name, 'Changed deployment settings or documentation.');
  await stage();
  assert.equal(await key(), original);
});

test('missing inputs, symlinks, empty repositories and nested working directories fail closed', async (context) => {
  const { root, key, stage } = await fixture(context);
  const input = path.join(root, 'src/core/example.ts');
  await assert.rejects(computeTestKey(path.join(root, 'src'), runtime), /repository root/);
  await rm(input);
  await assert.rejects(key(), /ENOENT/);
  await symlink('missing.ts', input);
  await assert.rejects(key(), /regular files/);
  await rm(input);
  await stage();
  await assert.rejects(key(), /No tracked full-test inputs/);
});

test('CLI emits a reusable GitHub output and rejects unsupported arguments', async (context) => {
  const { root } = await fixture(context);
  const output = path.join(root, 'github-output');
  const expected = await computeTestKey(root);
  const result = await execute(process.execPath, [helper, '--github-output'], {
    cwd: root,
    env: { ...process.env, GITHUB_OUTPUT: output },
  });
  assert.equal(result.stdout, `${expected}\n`);
  assert.equal(await readFile(output, 'utf8'), `key=${expected}\n`);
  const plain = await execute(process.execPath, [helper], { cwd: root });
  assert.equal(plain.stdout, `${expected}\n`);
  await assert.rejects(execute(process.execPath, [helper, '--unknown'], { cwd: root }), /Usage:/);
  await assert.rejects(
    execute(process.execPath, [helper, '--github-output'], {
      cwd: root,
      env: { ...process.env, GITHUB_OUTPUT: '' },
    }),
    /requires GITHUB_OUTPUT/,
  );
});
