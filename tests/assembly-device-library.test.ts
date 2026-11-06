import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
  supplyRows,
  validateProject,
} from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';

// Named supplier units used by authored devices must also have independent catalog selections.
const devices = [
  ['flight-controller', 'speedybee-f405-wing-mini', 'F405 Wing Mini'],
  ['servo-motor', 'towerpro-mg996r', 'MG996R'],
  ['servo-motor', 'towerpro-mg90s', 'MG90S'],
  ['lipo-battery', 'tattu-3s-650-75c', 'Tattu 650 3S'],
  ['adc-module', 'cjmcu-1220', 'CJMCU 1220'],
  ['power-filter', 'iflight-lc-filter-16x6', 'iFlight LC'],
  ['li-ion-pack', 'syla-lr2170la-4s1p-xt60', 'LR2170LA'],
  ['bec', 'bec12s-pro', 'BEC12S'],
  ['pwm-switch', 'user-mosfet-26x16', 'MOSFET 26'],
  ['round-pneumatic-cylinder', 'ma32x50-sca', 'MA32x50-SCA'],
  ['round-pneumatic-cylinder', 'ma32x100-sca', 'MA32x100-SCA'],
  ['machine-measurement', 'e3z-t81-l', 'E3Z-T81-L'],
  ['machine-measurement', 'e3z-t81-d', 'E3Z-T81-D'],
  ['pneumatic-valve', '4v210-08-dc24v', '4V210'],
  ['air-preparation-unit', 'ar2000-g1-4', 'AR2000'],
  ['air-preparation-unit', 'afr2000-g1-4', 'AFR2000'],
  ['profile-pneumatic-cylinder', 'dsbc-63-500-ppsa-n3', 'DSBC-63-500'],
  ['machine-measurement', 'e3z-ll81', 'E3Z-LL81'],
  ['pneumatic-valve', '2vd0102-g1-4', '2VD0102'],
] as const;

test('assembly devices are independently selectable by name and exact library ID', () => {
  const libraries = devices.map(([id]) => parts.find((part) => part.id === id)!);
  assert.ok(libraries.every(Boolean), 'every device family is registered');
  const index = buildLibrarySearchIndex(groupBrowseFamilies([...new Set(libraries)]));
  const presets = buildPresetIndex([...new Set(libraries)]);
  for (const [partId, presetId, query] of devices) {
    const id = libraryEntryId(partId, presetId);
    const selected = resolveLibraryEntry(parts, id);
    assert.ok(selected?.preset, id);
    const { part, preset } = selected;
    const parameters = { ...part.defaults, ...preset.parameters };
    const state =
      part.states?.find((state) => !state.availableWhen || state.availableWhen(parameters))?.id ??
      'default';
    assert.deepEqual(validateParameters(part, parameters, state), [], id);
    assert.ok(
      searchLibrary(index, query).some(({ family }) =>
        family.members.some((member) => member.id === partId),
      ),
      query,
    );
    assert.deepEqual(
      filterPresets(presets, { ...emptyPresetFilters(), query: id }).items.map((entry) => entry.id),
      [id],
    );
  }
});

for (const assemblyId of ['rocket-release', 'rocket-co2-recovery', 'rocket-parachute-recovery'])
  test(`${assemblyId}: WING MINI occurrences retain their standalone identity`, () => {
    const assembly = parts.find((part) => part.id === assemblyId)!;
    let checked = 0;
    for (const preset of assembly.presets) {
      const physical = assembly.composition!({ ...assembly.defaults, ...preset.parameters });
      const kits = physical.components.filter(
        (component) => component.procurement?.manufacturer === 'SpeedyBee',
      );
      if (!kits.length) continue;
      assert.equal(kits.length, 1, preset.id);
      assert.equal(kits[0].quantity, 1);
      assert.equal(kits[0].libraryId, 'flight-controller');
      assert.equal(kits[0].presetId, 'speedybee-f405-wing-mini');
      assert.equal(kits[0].state, 'assembled');
      assert.deepEqual(
        validateParameters(
          parts.find((part) => part.id === kits[0].libraryId)!,
          kits[0].parameters,
          kits[0].state,
        ),
        [],
      );
      checked++;
    }
    assert.ok(checked > 0, `${assemblyId} has a WING MINI configuration`);
  });

test('WING MINI project round trip preserves one purchased model and its fit-reference configuration', () => {
  const assembly = parts.find((part) => part.id === 'rocket-release')!;
  const preset = assembly.presets.find(
    (preset) => preset.id === 'nose-90-86-mg996r-18650-2s-wing-mini',
  )!;
  const project = addProduct(createProject('WING MINI library identity'), parts, {
    part: assembly,
    parameters: {
      ...assembly.defaults,
      ...preset.parameters,
      wingHolePitchX: 17.5,
      wingHolePitchY: 21,
    },
    state: 'assembled',
    presetId: preset.id,
  }).project;
  const restored = parseProject(serializeProject(project, parts), parts);
  assert.deepEqual(validateProject(restored, parts), []);
  const configurations = restored.configurations.filter(
    (configuration) => configuration.libraryId === 'flight-controller',
  );
  assert.equal(configurations.length, 1);
  const [configuration] = configurations;
  assert.equal(configuration.presetId, 'speedybee-f405-wing-mini');
  assert.equal(configuration.parameters.wingHolePitchX, 17.5);
  assert.equal(configuration.parameters.wingHolePitchY, 21);
  assert.equal(configuration.supply, 'purchased');
  const rows = supplyRows(restored, parts, 'purchased').filter(
    (row) => row.configurationId === configuration.id,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 1);
});

test('source catalog references preserve differing inherited fit geometry', () => {
  const assembly = parts.find((part) => part.id === 'rocket-release')!;
  const preset = assembly.presets.find(
    (preset) => preset.id === 'nose-90-86-mg996r-tattu-3s-wing-mini',
  )!;
  const components = assembly.composition!({
    ...assembly.defaults,
    ...preset.parameters,
  }).components;
  for (const id of ['servo-motor:towerpro-mg996r', 'lipo-battery:tattu-3s-650-75c']) {
    const references = components.filter((component) =>
      component.notes?.includes(`SourceLibraryEntry: ${id};`),
    );
    assert.equal(references.length, 1, id);
    assert.equal(references[0].libraryId, 'purchased-recovery-component');
    assert.equal(typeof references[0].parameters.recipe, 'string');
    assert.ok(resolveLibraryEntry(parts, id)?.preset);
  }
});
