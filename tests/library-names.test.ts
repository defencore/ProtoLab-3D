import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';

// These reviewed machine-component choices add installation details or use a
// requested cut length in the preset title. Both labels must retain the full SKU.
const executionLabelModels = new Set([
  'cnc-guide-rail:hgr20',
  'cnc-screw-support:bk12',
  'cnc-screw-support:bf12',
  'cnc-feed-servo:ecm-a3h-c20807rs1',
  'cnc-feed-servo:ecm-a3h-c20807ss1',
  'cnc-precision-nut:r25-10t3-fdi',
  'cnc-precision-nut:r20-5t3-fdi',
  'cnc-precision-support:bk20-c3',
  'cnc-precision-support:bf20-c3',
  'cnc-precision-support:bk15-c3',
  'cnc-precision-support:bf15-c3',
  'cnc-precision-screw:r20-5t3-fdi',
  'cnc-precision-axis:r20-5t3-fdi',
  'cnc-servo-drive:asd-a3-0721-m',
]);
const normalizedIdentifier = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

test('library and catalog names are readable and model selector labels agree', () => {
  for (const part of parts) {
    assert.equal(part.name, part.name.trim());
    assert.doesNotMatch(part.name, /\blayout model\b|\benvelope\b|\bCAD\b/i);
    for (const p of part.presets) {
      assert.ok(p.name.length > 0);
      assert.equal(p.name, p.name.trim());
      assert.doesNotMatch(p.name, /\s{2,}|Beearings/);
    }
    for (const option of part.parameters.find((p) => p.key === 'model')?.options ?? []) {
      const matches = part.presets.filter((p) => p.parameters.model === option.value);
      if (matches.length === 1) {
        const context = `${part.id}/${option.value}`;
        if (executionLabelModels.has(`${part.id}:${option.value}`)) {
          const identity = normalizedIdentifier(option.value);
          assert.ok(identity.length >= 4 && /\d/.test(identity), `${context}: complete model SKU`);
          assert.ok(
            normalizedIdentifier(option.label).includes(identity),
            `${context}: selector SKU`,
          );
          assert.ok(
            normalizedIdentifier(matches[0].name).includes(identity),
            `${context}: preset SKU`,
          );
        } else assert.equal(option.label, matches[0].name, context);
      }
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
    'AIRFRAME STRUCTURE',
    'WINGS & CONTROL SURFACES',
    'PROPELLERS & ROTORS',
    'DUCTS & LANDING GEAR',
    'VEHICLE MOUNTS',
  ]);
  assert.deepEqual(
    sortLibraryParts([...parts].reverse()).map((p) => p.id),
    sortLibraryParts(parts).map((p) => p.id),
  );
});
