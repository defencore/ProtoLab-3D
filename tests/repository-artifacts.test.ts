import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
// @ts-expect-error The dependency-free repository helper has no declaration file.
import { artifactIssues, checkRepositoryArtifacts } from '../scripts/check-repository-artifacts.mjs';
// @ts-expect-error The dependency-free repository helper has no declaration file.
import { checkRepository as checkRepositoryLanguage } from '../scripts/check-repository-language.mjs';

test('artifact policy rejects CAD exports, reference attachments and legacy output folders', () => {
  for (const file of [
    'data/export.STEP',
    'src/parts/example/test.FCStd',
    'public/references/print-kit.zip',
    'public/references',
    'docs/illustration.SVG',
    'docs/vendor-drawing.PDF',
    'src/parts/example/lib/reference-images/drawing.png',
    'data/promtehimport-inventory.json',
    'data/promtehimport-import-report.json',
    'src/catalog/data/gvyntok-fasteners.json',
    'docs/sample.stl',
    'sample.GCODE.3MF',
    '.catalog-snapshot-backup-example/presets.json',
    '.part-module-staging-example/part.ts',
    '.part-module-backups/old/part.ts',
    'screenshots/example.png',
    'result.json',
    'tsconfig.tsbuildinfo',
    '.cache/hidden-export.step',
    'src/.DS_Store',
  ])
    assert.ok(artifactIssues(file).length, file);
});

test('artifact policy preserves required source assets and authored recovery utilities', () => {
  for (const file of [
    'src/parts/example/lib/native/model.json',
    'src/catalog/data/source.json',
    'data/library-expansion.json',
    'docs/recovery/FixTechDrawLines.FCMacro',
    'docs/recovery/SelectedPartDrawing.FCMacro',
    'scripts/audit-model.ts',
    'test-results/assembly.step',
    'test-results/preview.png',
  ])
    assert.deepEqual(artifactIssues(file), [], file);
});

test('filesystem inspection detects ignored outputs while excluding build and dependency trees', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-artifact-guard-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = [
    '.gitignore',
    'data/hidden-export.step',
    'result.json',
    'docs/ignored-image.jpg',
    '.catalog-snapshot-backup-example/presets.json',
    'src/parts/example/lib/native/model.json',
    'test-results/valid-output.step',
    'node_modules/dependency/model.step',
    'dist/model.step',
  ];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), file === '.gitignore' ? '*' : 'fixture');
  }
  const { issues } = checkRepositoryArtifacts(root, { trackedFiles: [] });
  assert.equal(issues.length, 4, issues.join('\n'));
  assert.ok(issues.some((issue: string) => issue.startsWith('data/')));
  assert.ok(issues.some((issue: string) => issue.startsWith('result.json:')));
  assert.ok(issues.some((issue: string) => issue.startsWith('docs/ignored-image.jpg:')));
  assert.ok(issues.some((issue: string) => issue.startsWith('.catalog-snapshot-backup-')));
});

test('force-tracked output files are rejected even inside an ignored output directory', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-tracked-artifacts-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const { issues } = checkRepositoryArtifacts(root, {
    trackedFiles: ['test-results/sample.step', 'node_modules/accidental-package.json'],
  });
  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue: string) => issue.includes('must remain untracked')));
});

test('the Git index rejects a reference attachment even when the working copy is absent', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-tracked-references-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const { issues } = checkRepositoryArtifacts(root, { trackedFiles: ['docs/drawing.PDF'] });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /keep reference attachments/);
});

test('generated output is excluded from prose scans while the artifact check rejects force-tracking', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-artifact-language-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'test-results'));
  await fs.writeFile(path.join(root, 'src/example.ts'), 'export const source = true;\n');
  await fs.writeFile(path.join(root, 'test-results/report.json'), String.fromCodePoint(0x416));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['add', '-f', 'src/example.ts', 'test-results/report.json'], { cwd: root });
  assert.deepEqual(checkRepositoryLanguage(root), { count: 1, issues: [] });
  assert.ok(
    checkRepositoryArtifacts(root).issues.some((issue: string) =>
      issue.includes('must remain untracked'),
    ),
  );
});

test('the current repository keeps generated artifacts out of source directories', () => {
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const result = checkRepositoryArtifacts(root);
  assert.deepEqual(result.issues, []);
  assert.ok(result.count > 100);
});
