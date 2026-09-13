import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { discoverPackages } from '../scripts/part-modules/library';
import { parts } from '../src/parts';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = discoverPackages(repository);

test('every library part is a complete isolated package discovered in display order', async () => {
  const discovered = await packages;
  assert.deepEqual(
    discovered.map((module) => module.id),
    parts.map((part) => part.id),
    'Run parts:sync when changing the package inventory.',
  );
  for (const module of discovered) {
    for (const reference of module.references) {
      const file = path.join(repository, 'public', reference);
      assert.ok((await fs.stat(file)).isFile(), `${module.id}: missing handoff asset ${reference}`);
    }
  }
});

test('package preset files are the complete runtime catalog without external enrichment', async () => {
  for (const part of parts) {
    const file = path.join(repository, 'src/parts', part.id, 'presets.json');
    const presets = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.deepEqual(part.presets, presets, `${part.id}: runtime presets must be owned locally`);
  }
});

test('configurator, defaults and presets share no mutable objects between packages', () => {
  const owners = new WeakMap<object, string>();
  function inspect(value: unknown, owner: string, field: string): void {
    if (value === null || typeof value !== 'object') return;
    const existing = owners.get(value);
    assert.ok(
      !existing || existing === owner,
      `${owner}.${field} shares an object with ${existing}`,
    );
    if (existing) return;
    owners.set(value, owner);
    for (const [key, child] of Object.entries(value)) inspect(child, owner, `${field}.${key}`);
  }
  for (const part of parts) {
    for (const key of ['parameters', 'defaults', 'presets', 'states', 'catalogSelection'] as const)
      inspect(part[key], part.id, key);
  }
});

test('each catalog selector belongs to its own configurator schema', () => {
  for (const part of parts) {
    const keys = new Set<string>();
    for (const selector of part.catalogSelection ?? []) {
      assert.ok(!keys.has(selector.key), `${part.id}: duplicate selector ${selector.key}`);
      keys.add(selector.key);
      const field = part.parameters.find((parameter) => parameter.key === selector.key);
      assert.ok(field, `${part.id}: unknown selector ${selector.key}`);
      assert.notEqual(field.filterable, false, `${part.id}: hidden selector ${selector.key}`);
    }
  }
});
