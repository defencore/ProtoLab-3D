import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { familyMembers, groupBrowseFamilies } from '../src/core/browse-families';
import { configurationLink, parseConfigurationLink } from '../src/core/configuration-link';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { availableModelState } from '../src/core/part-selection';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';

const definition = (id: string) => {
  const part = parts.find((candidate) => candidate.id === id);
  assert.ok(part, id);
  return part;
};
const catalogs = [
  ['t-slot-profiles', 'aluminium-profile', 'slot-profile'],
  ['wheels', 'wheel', 'robot-wheel'],
  ['lifting-eyes', 'lifting-eye-bolt', 'lifting-eye-nut'],
  ['gears', 'spur-gear', 'helical-gear', 'bevel-gear'],
  ['gearboxes', 'gearbox', 'bevel-gearbox-42', 'faulhaber-planetary'],
  ['profile-linear-guides', 'hiwin-profile-guide', 'linear-guide'],
  ['ball-screw-sets', 'ball-screw', 'tbi-ball-screw', 'cnc-precision-axis'],
  ['ball-screw-shafts', 'cnc-drive-screw', 'cnc-precision-screw'],
  ['ball-screw-nuts', 'ball-nut', 'cnc-precision-nut'],
  ['shaft-screw-supports', 'shaft-support', 'cnc-screw-support', 'cnc-precision-support'],
  ['servo-horns', 'servo-arm', 'metal-servo-horn'],
  [
    'fluid-cylinders',
    'fluid-cylinder',
    'compact-pneumatic-cylinder',
    'round-pneumatic-cylinder',
    'profile-pneumatic-cylinder',
  ],
  ['recovery-buzzers', 'recovery-buzzer', 'jhe42b-finder'],
];

test('functional catalogs retain separately selectable physical products and exact model links', () => {
  for (const [id, ...members] of catalogs) {
    const definitions = familyMembers(parts, definition(members[0]));
    assert.deepEqual(definitions.map((part) => part.id).sort(), [...members].sort(), id);
    const entries = groupBrowseFamilies(definitions);
    assert.equal(entries.length, 1, id);
    assert.equal(entries[0].id, id);
    const navigation = buildLibrarySearchIndex(entries);
    const presets = buildPresetIndex(definitions);
    for (const part of definitions) {
      for (const preset of [part.presets[0], part.presets.at(-1)!]) {
        const reference = libraryEntryId(part.id, preset.id);
        const matches = searchLibrary(navigation, reference);
        assert.equal(matches.length, 1, reference);
        assert.equal(matches[0].family.id, id);
        assert.strictEqual(
          resolveLibraryEntry(matches[0].family.members, reference)?.preset,
          preset,
        );
        assert.deepEqual(
          filterPresets(presets, { ...emptyPresetFilters(), query: reference }).items.map(
            (entry) => entry.id,
          ),
          [reference],
        );
        const parameters = { ...preset.parameters };
        const state = availableModelState(part, parameters, part.states?.[0]?.id ?? 'default');
        const restored = parseConfigurationLink(
          configurationLink({
            id: 'installed-component',
            libraryId: part.id,
            presetId: preset.id,
            name: preset.name,
            parameters,
            state,
            supply: part.product.supply,
            quantity: 1,
            placement: { translation: [0, 0, 0], rotation: [0, 0, 0] },
          }),
          parts,
        );
        assert.strictEqual(restored?.part, part, reference);
        assert.equal(restored?.presetId, preset.id, reference);
        assert.deepEqual(restored?.parameters, parameters, reference);
      }
    }
  }
});

test('gear construction searches select the matching type inside one catalog', () => {
  const members = familyMembers(parts, definition('spur-gear'));
  const index = buildPresetIndex(members);
  for (const [query, partId] of [
    ['spur gear', 'spur-gear'],
    ['helical gear', 'helical-gear'],
    ['herringbone gear', 'helical-gear'],
    ['bevel gear', 'bevel-gear'],
  ]) {
    const matches = filterPresets(index, { ...emptyPresetFilters(), query }).items;
    assert.ok(matches.length, query);
    assert.ok(
      matches.every((entry) => entry.part.id === partId),
      query,
    );
  }
  for (const id of ['bevel-gear-pair', 'worm-drive', 'gear-rack'])
    assert.ok(
      !members.includes(definition(id)),
      `${id}: mating assemblies and racks stay separate`,
    );
});

test('common localized component words reach their functional catalogs', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  for (const [query, family] of [
    ['\u0448\u0435\u0441\u0442\u0435\u0440\u043d\u044f', 'gears'],
    ['\u043a\u0430\u043c\u0435\u0440\u0430', 'camera-models'],
    ['\u0433\u0430\u0439\u043a\u0430', 'nuts'],
    ['\u0448\u0430\u0439\u0431\u0430', 'washers'],
    ['\u043a\u043e\u043b\u0435\u0441\u043e', 'wheels'],
    ['\u043d\u0430\u043f\u0440\u044f\u043c\u043d\u0430', 'profile-linear-guides'],
    ['\u0446\u0438\u043b\u0456\u043d\u0434\u0440', 'fluid-cylinders'],
  ])
    assert.ok(
      searchLibrary(index, query).some((entry) => entry.family.id === family),
      query,
    );
});

test('indexed drilling fixtures use the drilling path and navigation titles remain unambiguous', () => {
  assert.equal(definition('indexing-disc-jig').subgroup, 'DRILLING JIGS');
  const families = groupBrowseFamilies(parts);
  assert.equal(new Set(families.map((family) => family.label)).size, families.length);
  assert.equal(definition('surpass-2838').browseFamily?.id, 'brushless-motors');
  assert.equal(definition('surpass-2845').browseFamily?.id, 'brushless-motors');
});
