import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import {
  buildDiscoveryIndex,
  emptyDiscoveryFilters,
  filterDiscoveryCandidates,
} from '../src/core/library-discovery';
import { buildStandoffCatalog, filterStandoffs } from '../src/core/standoff-catalog';
import { emptyMechanismFilters, matchingMechanismPreset } from '../src/core/mechanism-catalog';

test('every registered physical family and model has an unambiguous unique library reference', () => {
  const ids = parts.flatMap((part) => [
    part.id,
    ...part.presets.map((preset) => libraryEntryId(part.id, preset.id)),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  for (const part of parts) {
    assert.strictEqual(resolveLibraryEntry(parts, part.id)?.part, part);
    for (const preset of [part.presets[0], part.presets.at(-1)]) {
      if (!preset) continue;
      const resolved = resolveLibraryEntry(parts, libraryEntryId(part.id, preset.id));
      assert.strictEqual(resolved?.part, part);
      assert.strictEqual(resolved?.preset, preset);
    }
  }
  assert.equal(resolveLibraryEntry(parts, 'unknown-library-element'), undefined);
  assert.equal(resolveLibraryEntry(parts, `${parts[0].id}:unknown-preset`), undefined);
  assert.equal(resolveLibraryEntry(parts, `${parts[0].id}:custom`), undefined);
});

const physical = (id: string) => parts.find((part) => part.id === id)!;
const examples = [
  physical('bolt-screw'),
  physical('pcb-standoff'),
  physical('tr8-quad-actuator'),
].map((part) => ({ ...part, presets: part.presets.slice(0, 2) }));
const navigation = buildLibrarySearchIndex(groupBrowseFamilies(examples));
const discovery = buildDiscoveryIndex(navigation);
const presets = buildPresetIndex(examples);

test('exact model IDs find the physical model through ordinary, standoff and mechanism catalogs', () => {
  for (const part of examples) {
    assert.ok(part.presets.length > 1);
    const preset = part.presets[1];
    const id = libraryEntryId(part.id, preset.id);
    const found = searchLibrary(navigation, id);
    assert.equal(found.length, 1);
    assert.ok(found[0].family.members.some((member) => member.id === part.id));
    assert.equal(found[0].articleQuery, id);
    assert.deepEqual(
      filterPresets(presets, { ...emptyPresetFilters(), query: id }).items.map((entry) => entry.id),
      [id],
    );
    assert.deepEqual(
      filterDiscoveryCandidates(discovery, id, emptyDiscoveryFilters()).map((entry) => entry.id),
      [id],
    );
    assert.strictEqual(resolveLibraryEntry(found[0].family.members, id)?.preset, preset);
    assert.deepEqual(searchLibrary(navigation, `${id}-unknown`), []);
    assert.deepEqual(
      filterDiscoveryCandidates(discovery, `${id}-unknown`, emptyDiscoveryFilters()),
      [],
    );
  }
  const standoff = examples[1];
  const standoffId = libraryEntryId(standoff.id, standoff.presets[1].id);
  assert.deepEqual(
    filterStandoffs(buildStandoffCatalog([standoff]), { query: standoffId }).items.map(
      (entry) => entry.id,
    ),
    [standoffId],
  );
  const mechanism = examples[2];
  assert.equal(
    matchingMechanismPreset(mechanism, {
      ...emptyMechanismFilters(),
      query: libraryEntryId(mechanism.id, mechanism.presets[1].id),
    })?.id,
    mechanism.presets[1].id,
  );
});

test('a family ID finds all its models and survives display-name and navigation changes', () => {
  for (const part of examples) {
    assert.equal(searchLibrary(navigation, part.id).length, 1);
    assert.deepEqual(
      filterDiscoveryCandidates(discovery, part.id, emptyDiscoveryFilters()).map(
        (entry) => entry.id,
      ),
      part.presets.map((preset) => libraryEntryId(part.id, preset.id)),
    );
  }
  const renamed = { ...examples[1], name: 'Different display name', browseFamily: undefined };
  const id = libraryEntryId(renamed.id, renamed.presets[1].id);
  const moved = buildLibrarySearchIndex(groupBrowseFamilies([renamed]));
  assert.equal(searchLibrary(moved, id)[0].family.id, renamed.id);
  const withoutModels = { ...renamed, presets: [] };
  assert.equal(
    searchLibrary(buildLibrarySearchIndex(groupBrowseFamilies([withoutModels])), renamed.id).length,
    1,
  );
});

test('supplier spelling and spaces in model IDs remain literal rather than fuzzy matches', () => {
  const base = examples[0];
  const local = {
    ...base,
    presets: ['SFK602 / SFK0602 · unverified listing', 'supplier-model', 'supplier model'].map(
      (id) => ({
        ...base.presets[0],
        id,
      }),
    ),
  };
  const index = buildPresetIndex([local]);
  for (const preset of local.presets) {
    const id = libraryEntryId(local.id, preset.id);
    assert.strictEqual(resolveLibraryEntry([local], `  ${id}  `)?.preset, preset);
    assert.deepEqual(
      filterPresets(index, { ...emptyPresetFilters(), query: id }).items.map((entry) => entry.id),
      [id],
    );
  }
  assert.equal(resolveLibraryEntry([local], `${local.id}:SUPPLIER-MODEL`), undefined);
});

test('exact lookup preserves explicit characteristic filters and existing colon dimension queries', () => {
  const part = examples[0];
  const id = libraryEntryId(part.id, part.presets[0].id);
  assert.deepEqual(
    filterDiscoveryCandidates(discovery, id, { ...emptyDiscoveryFilters(), power: '999 V' }),
    [],
  );
  assert.deepEqual(
    filterDiscoveryCandidates(discovery, 'width:60', emptyDiscoveryFilters()),
    filterDiscoveryCandidates(discovery, 'width 60', emptyDiscoveryFilters()),
  );
});
