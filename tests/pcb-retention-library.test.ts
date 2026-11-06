import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { libraryArea, libraryLocationPath } from '../src/core/library-navigation';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { validateParameters } from '../src/core/validation';
import { eskdIdentity } from '../src/core/eskd';
import { availableModelState } from '../src/core/part-selection';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import type { PartDefinition, Parameters } from '../src/core/types';

const canonicalJson = (value: unknown) => JSON.parse(JSON.stringify(value));
function mount(): PartDefinition {
  const part = resolveLibraryEntry(parts, 'pcb-retention-mount')?.part;
  assert.ok(part, 'The reusable PCB retention mount must be registered.');
  return part;
}

test('PCB retention mounts reuse the electronics adapter location with a distinct physical family', () => {
  const part = mount();
  assert.equal(part.category, 'ELECTRONICS MOUNTS');
  assert.equal(part.subgroup, 'MODULE ADAPTERS');
  assert.equal(libraryArea(part.category), 'electronics');
  assert.deepEqual(
    libraryLocationPath({
      level: 'subgroup',
      category: part.category,
      subgroup: part.subgroup,
    }).map((item) => item.label),
    ['Library', 'Electronics mounts', 'Module adapters'],
  );
  const family = groupBrowseFamilies(parts).find((family) => family.id === part.id);
  assert.ok(family);
  assert.deepEqual(
    family.members.map((member) => member.id),
    [part.id],
  );
  assert.equal(part.product.kind, 'assembly');
  assert.equal(part.product.supply, 'manufactured');
  assert.ok(part.product.processes.includes('printing'));
  assert.ok(part.product.processes.includes('assembly'));
});

test('exact PCB mount family and model IDs resolve authored configurations', () => {
  const part = mount();
  const search = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  const presets = buildPresetIndex(parts);
  assert.equal(searchLibrary(search, part.id)[0]?.family.id, part.id);
  assert.ok(part.presets.length >= 4);
  for (const preset of part.presets) {
    const id = libraryEntryId(part.id, preset.id);
    assert.equal(preset.catalog, undefined, 'Authored PCB mounts are not supplier products.');
    assert.strictEqual(resolveLibraryEntry(parts, id)?.preset, preset);
    const result = searchLibrary(search, id);
    assert.equal(result.length, 1);
    assert.equal(result[0].family.id, part.id);
    assert.equal(result[0].articleQuery, id);
    assert.deepEqual(
      filterPresets(presets, { ...emptyPresetFilters(), query: id }).items.map((item) => item.id),
      [id],
    );
  }
});

test('PCB mount inspection states preserve physical composition and project identities', () => {
  const part = mount();
  assert.equal(part.states?.[0]?.id, 'assembled');
  assert.equal(part.physicalStates, undefined);
  for (const preset of part.presets) {
    const p = preset.parameters;
    const composition = part.composition!(p);
    const expected = 1 + (p.lockEnabled ? Math.max(1, Number(p.boardCount) - 1) : 0);
    assert.equal(composition.components.length, expected, preset.id);
    assert.equal(new Set(composition.components.map((c) => c.id)).size, expected);
    for (const component of composition.components) {
      assert.equal(component.libraryId, 'manufactured-detail');
      assert.equal(component.supply, 'manufactured');
      assert.equal(component.quantity, 1);
      const definition = resolveLibraryEntry(parts, component.libraryId)!.part;
      assert.deepEqual(validateParameters(definition, component.parameters, component.state), []);
    }
    const project = createProject('PCB mount state identity');
    let canonical: unknown;
    for (const state of part.states ?? []) {
      if (state.availableWhen && !state.availableWhen(p)) continue;
      assert.deepEqual(validateParameters(part, p, state.id), [], `${preset.id}/${state.id}`);
      const result = addProduct(project, parts, {
        part,
        parameters: p,
        presetId: preset.id,
        state: state.id,
      });
      const restored = parseProject(serializeProject(result.project, parts), parts);
      assert.deepEqual(canonicalJson(restored), canonicalJson(result.project));
      const configuration = restored.configurations.find((c) => c.libraryId === part.id)!;
      assert.equal(configuration.state, 'assembled');
      assert.equal(configuration.presetId, preset.id);
      const physical = canonicalJson(restored.configurations.map(({ id: _id, ...c }) => c));
      if (canonical === undefined) canonical = physical;
      else assert.deepEqual(physical, canonical, `${preset.id}/${state.id}`);
      const root = restored.occurrences.find(
        (occurrence) => occurrence.id === result.occurrenceId,
      )!;
      const children = restored.occurrences.filter((occurrence) => occurrence.parentId === root.id);
      assert.deepEqual(
        canonicalJson(children.map((occurrence) => occurrence.placement)),
        canonicalJson(composition.components.map((component) => component.placement)),
      );
    }
    const withReferences = { ...p, showReferences: !p.showReferences };
    assert.equal(
      eskdIdentity(part, p, 'assembled').configurationKey,
      eskdIdentity(part, withReferences, 'assembled').configurationKey,
    );
    assert.deepEqual(part.composition!(withReferences).components, composition.components);
  }
});

test('disabling the lock reconciles service views and exposes only active board controls', () => {
  const part = mount();
  for (const preset of part.presets) {
    const p: Parameters = { ...preset.parameters, lockEnabled: false };
    const reconciled = part.updateParameters?.(p, 'lockEnabled') ?? p;
    assert.equal(availableModelState(part, reconciled, 'service'), 'assembled');
    assert.equal(availableModelState(part, reconciled, 'exploded'), 'assembled');
    assert.deepEqual(validateParameters(part, reconciled, 'assembled'), []);
    assert.equal(part.composition!(reconciled).components.length, 1);
    for (let i = 1; i <= 4; i++) {
      for (const dimension of ['Length', 'Width']) {
        const field = part.parameters.find((field) => field.key === `board${i}${dimension}`);
        assert.ok(field);
        assert.equal(
          field.visibleWhen?.(reconciled) ?? true,
          i <= Number(reconciled.boardCount),
          field.key,
        );
      }
    }
  }
});
