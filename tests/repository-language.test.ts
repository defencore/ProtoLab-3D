import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PACKAGE_README, starterFiles } from '../scripts/part-modules/templates';
// @ts-expect-error The dependency-free CI helper has no declaration file.
import { textIssues } from '../scripts/check-repository-language.mjs';

const root = new URL('..', import.meta.url);

test('repository policy rejects literal Cyrillic paths and text, and escaped documentation', () => {
  const letter = String.fromCodePoint(0x416);
  assert.equal(textIssues('docs/guide.md', 'English instructions.').length, 0);
  assert.equal(textIssues('docs/guide.md', `Title\n${letter}`).length, 1);
  assert.equal(textIssues(`docs/${letter}.md`, 'English instructions.').length, 1);
  assert.equal(textIssues('docs/guide.md', '\\u0416').length, 1);
  assert.equal(textIssues('data/source.json', '{"sourceTitle":"\\u0416"}').length, 0);
});

test('all package READMEs use the same workflow as newly scaffolded packages', () => {
  for (const folder of readdirSync(new URL('src/parts/', root), { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const base = new URL(`src/parts/${folder.name}/`, root);
    assert.equal(readFileSync(new URL('README.md', base), 'utf8'), PACKAGE_README, folder.name);
    assert.ok(readFileSync(new URL('GUIDE.md', base), 'utf8').startsWith('# '), folder.name);
  }
  const starter = starterFiles('example-part', 'Example part', 1);
  assert.equal(starter['README.md'], PACKAGE_README);
  assert.match(starter['GUIDE.md'], /^# Example part/);
  assert.doesNotMatch(starter['README.md'], /example-part|Example part/);
});
