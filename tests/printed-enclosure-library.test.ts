import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { libraryCatalogGroups } from '../src/core/library';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';

const assemblyIds = [
  'printed-rim-enclosure',
  'printed-self-centering-enclosure',
  'printed-screw-enclosure',
  'printed-bayonet-enclosure',
  'printed-threaded-enclosure',
];
const ids = [...assemblyIds, 'printed-threaded-shell'];
const canonicalJson = (value: unknown) => JSON.parse(JSON.stringify(value));

test('printed enclosure variants reuse one established Enclosures navigation catalog', () => {
  const group = libraryCatalogGroups.find((group) => group.id === 'enclosures')!;
  const family = groupBrowseFamilies(parts).find((family) => family.id === 'enclosures')!;
  for (const id of ids) {
    assert.ok((group.members as readonly string[]).includes(id), id);
    const part = resolveLibraryEntry(parts, id)!.part;
    assert.equal(part.category, 'ENCLOSURES & DEVICES');
    assert.equal(part.subgroup, 'GENERAL-PURPOSE ENCLOSURES');
    assert.ok(family.members.some((member) => member.id === id));
    assert.equal(part.product.supply, 'manufactured');
    assert.ok(part.product.processes.includes('printing'));
  }
});

test('grouped enclosure exact IDs resolve authored family members and model configurations', () => {
  const search = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  const presets = buildPresetIndex(parts);
  for (const id of ids) {
    const part = resolveLibraryEntry(parts, id)!.part;
    const result = searchLibrary(search, id);
    assert.equal(result.length, 1, id);
    assert.equal(result[0].family.id, 'enclosures');
    assert.equal(result[0].articleQuery, id);
    for (const preset of part.presets) {
      assert.equal(preset.catalog, undefined, 'authored shell sizes are not supplier articles');
      const qualified = libraryEntryId(id, preset.id);
      assert.strictEqual(resolveLibraryEntry(parts, qualified)!.preset, preset);
      assert.deepEqual(
        filterPresets(presets, { ...emptyPresetFilters(), query: qualified }).items.map(
          (item) => item.id,
        ),
        [qualified],
      );
    }
  }
});

test('enclosure inspection states preserve installed component identities through project JSON', () => {
  for (const id of assemblyIds) {
    const part = resolveLibraryEntry(parts, id)!.part;
    assert.equal(part.product.kind, 'assembly');
    assert.ok(part.product.processes.includes('assembly'));
    assert.equal(part.physicalStates, undefined);
    for (const preset of part.presets) {
      const composition = part.composition!(preset.parameters);
      assert.equal(composition.components.length, id === 'printed-screw-enclosure' ? 10 : 2);
      assert.equal(
        new Set(composition.components.map((c) => c.id)).size,
        composition.components.length,
      );
      const project = createProject('Enclosure state identity');
      let canonical: unknown;
      for (const state of part.states ?? []) {
        if (state.availableWhen && !state.availableWhen(preset.parameters)) continue;
        assert.deepEqual(
          validateParameters(part, preset.parameters, state.id),
          [],
          `${id}/${preset.id}/${state.id}`,
        );
        const result = addProduct(project, parts, {
          part,
          parameters: preset.parameters,
          presetId: preset.id,
          state: state.id,
        });
        const restored = parseProject(serializeProject(result.project, parts), parts);
        assert.deepEqual(canonicalJson(restored), canonicalJson(result.project));
        const configuration = restored.configurations.find((c) => c.libraryId === id)!;
        assert.equal(configuration.state, 'assembled');
        assert.equal(configuration.presetId, preset.id);
        const physical = canonicalJson(restored.configurations.map(({ id: _id, ...c }) => c));
        if (canonical === undefined) canonical = physical;
        else assert.deepEqual(physical, canonical, `${id}/${state.id}`);
      }
    }
  }
});
