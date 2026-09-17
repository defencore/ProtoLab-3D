import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';

test('library and catalog names are readable and model selector labels agree', () => {
  for (const part of parts) {
    assert.equal(part.name, part.name.trim());
    assert.doesNotMatch(part.name, /layout|envelope|\bCAD\b/i);
    for (const p of part.presets) {
      assert.ok(p.name.length > 0);
      assert.equal(p.name, p.name.trim());
      assert.doesNotMatch(p.name, /\s{2,}|Beearings/);
    }
    for (const option of part.parameters.find((p) => p.key === 'model')?.options ?? []) {
      const matches = part.presets.filter((p) => p.parameters.model === option.value);
      if (matches.length === 1)
        assert.equal(option.label, matches[0].name, `${part.id}/${option.value}`);
    }
  }
});
test('unthreaded pins and retaining rings do not display metric thread prefixes', () => {
  for (const id of ['spring-pin', 'retaining-ring']) {
    for (const p of parts.find((p) => p.id === id)!.presets.filter((p) => p.catalog)) {
      assert.match(p.name, /^Ø/);
      assert.match(p.name, /mm/);
    }
  }
});

test('each built-in part has a unique name and one registered, populated library group', async () => {
  const { librarySections, libraryCategories, librarySubgroups, sortLibraryParts } =
    await import('../src/core/library');
  assert.equal(new Set(parts.map((p) => p.name)).size, parts.length);
  assert.equal(new Set(librarySections.map((s) => s.name)).size, librarySections.length);
  for (const part of parts) {
    const section = librarySections.find((s) => s.name === part.category);
    assert.ok(section?.groups.includes(part.subgroup), `${part.id}: registered taxonomy`);
    assert.equal(
      new Set(part.presets.map((p) => p.name)).size,
      part.presets.length,
      `${part.id}: unambiguous variant names`,
    );
  }
  for (const section of librarySections) {
    assert.equal(new Set(section.groups).size, section.groups.length);
    for (const group of section.groups)
      assert.ok(
        parts.some((p) => p.category === section.name && p.subgroup === group),
        `${section.name}/${group}: populated`,
      );
  }
  assert.deepEqual(
    libraryCategories(parts),
    librarySections.map((s) => s.name),
  );
  assert.deepEqual(librarySubgroups(parts, 'VEHICLE STRUCTURES'), [
    'AIRCRAFT',
    'MULTICOPTERS',
    'MODEL ROCKETS',
    'BOAT HULLS',
    'GROUND VEHICLES',
    'WINGS & CONTROL SURFACES',
    'PROPELLERS & ROTORS',
    'DUCTS & LANDING GEAR',
  ]);
  assert.deepEqual(
    sortLibraryParts([...parts].reverse()).map((p) => p.id),
    sortLibraryParts(parts).map((p) => p.id),
  );
});
