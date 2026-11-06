import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { librarySections } from '../src/core/library';
import {
  filterLibraryLocation,
  libraryArea,
  libraryLocationPath,
} from '../src/core/library-navigation';
import { familyLabel, libraryLabel } from '../src/core/library-labels';
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

const ids = [
  'printed-dovetail-joint',
  'printed-tongue-groove-joint',
  'printed-snap-joint',
  'printed-pin-joint',
];

function printedJoints() {
  return ids.map((id) => {
    const part = parts.find((candidate) => candidate.id === id);
    assert.ok(part, `Missing printable joint ${id}.`);
    return part;
  });
}

test('printed joints have one functional location and retain separate physical family identities', () => {
  const joints = printedJoints();
  const location = {
    level: 'subgroup' as const,
    category: 'FASTENERS & THREADS',
    subgroup: 'PRINTED JOINTS',
  };
  const families = groupBrowseFamilies(parts);
  assert.deepEqual(
    filterLibraryLocation(families, location)
      .map((family) => family.id)
      .sort(),
    [...ids].sort(),
  );
  assert.ok(
    librarySections
      .find((section) => section.name === location.category)
      ?.groups.includes(location.subgroup),
  );
  assert.equal(libraryLabel(location.subgroup), 'Printed joints');
  assert.deepEqual(
    libraryLocationPath(location).map((item) => item.label),
    ['Library', 'Fasteners & threads', 'Printed joints'],
  );
  for (const joint of joints) {
    assert.equal(libraryArea(joint.category), 'hardware');
    assert.equal(joint.subgroup, location.subgroup);
    assert.equal(joint.product.kind, 'assembly');
    assert.equal(joint.product.supply, 'manufactured');
    assert.ok(joint.product.processes.includes('printing'));
    assert.ok(joint.product.processes.includes('assembly'));
    assert.equal(familyLabel(joint), joint.browseLabel ?? joint.name);
  }
});

test('exact printed joint IDs select their family and authored model without supplier claims', () => {
  const joints = printedJoints();
  const search = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  const presets = buildPresetIndex(parts);
  for (const joint of joints) {
    assert.strictEqual(resolveLibraryEntry(parts, joint.id)?.part, joint);
    assert.equal(searchLibrary(search, joint.id)[0]?.family.id, joint.id);
    assert.ok(joint.presets.length);
    for (const preset of joint.presets) {
      const id = libraryEntryId(joint.id, preset.id);
      assert.equal(preset.catalog, undefined, id);
      assert.strictEqual(resolveLibraryEntry(parts, id)?.preset, preset);
      const matches = searchLibrary(search, id);
      assert.equal(matches.length, 1, id);
      assert.equal(matches[0].family.id, joint.id, id);
      assert.equal(matches[0].articleQuery, id, id);
      assert.deepEqual(
        filterPresets(presets, { ...emptyPresetFilters(), query: id }).items.map((item) => item.id),
        [id],
      );
    }
  }
});

test('inspection and print states retain installed product identity and two physical details through project JSON', () => {
  for (const joint of printedJoints()) {
    assert.deepEqual(
      joint.states?.map((state) => state.id),
      ['assembled', 'exploded', 'print'],
    );
    assert.equal(joint.physicalStates, undefined);
    for (const preset of joint.presets) {
      const composition = joint.composition!(preset.parameters);
      assert.equal(composition.components.length, 2, joint.id);
      assert.equal(new Set(composition.components.map((component) => component.id)).size, 2);
      for (const component of composition.components) {
        assert.equal(component.libraryId, 'manufactured-detail');
        assert.equal(component.quantity, 1);
        const detail = resolveLibraryEntry(parts, component.libraryId)!.part;
        assert.deepEqual(validateParameters(detail, component.parameters, component.state), []);
      }
      const project = createProject(`${joint.name} identity check`);
      let assembled = project;
      for (const state of ['assembled', 'exploded', 'print']) {
        assert.deepEqual(
          validateParameters(joint, preset.parameters, state),
          [],
          `${joint.id}/${state}`,
        );
        const result = addProduct(project, parts, {
          part: joint,
          parameters: preset.parameters,
          presetId: preset.id,
          state,
        });
        const restored = parseProject(serializeProject(result.project, parts), parts);
        assert.deepEqual(restored, JSON.parse(JSON.stringify(result.project)));
        const physical = restored.configurations.find(
          (configuration) => configuration.libraryId === joint.id,
        )!;
        assert.equal(physical.state, 'assembled');
        assert.equal(physical.presetId, preset.id);
        const root = restored.occurrences.find(
          (occurrence) => occurrence.id === result.occurrenceId,
        )!;
        const children = restored.occurrences.filter(
          (occurrence) => occurrence.parentId === root.id,
        );
        assert.equal(children.length, 2);
        assert.deepEqual(
          children.map((occurrence) => occurrence.placement),
          JSON.parse(
            JSON.stringify(composition.components.map((component) => component.placement)),
          ),
        );
        if (state === 'assembled') assembled = restored;
        else
          assert.deepEqual(
            restored.configurations.map(({ id: _id, ...configuration }) => configuration),
            assembled.configurations.map(({ id: _id, ...configuration }) => configuration),
            `${joint.id}/${state}`,
          );
      }
    }
  }
});
