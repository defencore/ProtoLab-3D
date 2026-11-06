import assert from 'node:assert/strict';
import test from 'node:test';
import part from '../src/parts/handheld-lora-controller/part';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  getFilterFields,
  presetFacetOptions,
} from '../src/core/preset-search';
import { validateParameters } from '../src/core/validation';
import { defaultPartSelection } from '../src/core/part-selection';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';

const index = buildPresetIndex([part]);
const fields = getFilterFields([part]);
function filters(values: Record<string, string>) {
  const result = emptyPresetFilters(part);
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find((field) => field.key === key);
    assert.ok(field, `${key} must be a library filter`);
    result.parameters[field.id] = { value };
  }
  return result;
}

test('handheld names identify platform, body and antenna while retaining every physical configuration', () => {
  assert.equal(part.name, 'Heltec V4 handheld controller');
  assert.equal(part.category, 'ENCLOSURES & DEVICES');
  assert.equal(part.subgroup, 'HANDHELD CONTROLLERS');
  assert.deepEqual(part.parameters.find((field) => field.key === 'bodyModel')?.options, [
    { value: 'original', label: 'Straight' },
    { value: 'contoured', label: 'Palm' },
    { value: 'web-grip', label: 'Palm Lock' },
  ]);
  const unchanged = {
    safetyPosition: 'locked',
    batteryLength: 43,
    batteryWidth: 25,
    batteryHeight: 10,
    batteryTapeThickness: 0.5,
    guardProjection: 5.5,
    buttonA: 'first',
    buttonB: 'first',
    powerButton: 'first',
  };
  const expected = [
    [
      'heltec-v4-two-ds225',
      'Heltec V4 · Straight · External SMA · Bottom',
      'original',
      'external',
      'bottom',
    ],
    [
      'heltec-v4-original-internal-fpc',
      'Heltec V4 · Straight · Internal FPC',
      'original',
      'internal',
      'bottom',
    ],
    [
      'heltec-v4-contoured-top-sma',
      'Heltec V4 · Palm · External SMA · Top',
      'contoured',
      'external',
      'top',
    ],
    [
      'heltec-v4-contoured-internal-fpc',
      'Heltec V4 · Palm · Internal FPC',
      'contoured',
      'internal',
      'top',
    ],
    [
      'heltec-v4-contoured-compact-sma',
      'Heltec V4 · Palm · External SMA · Compact top',
      'contoured',
      'external',
      'compact-top',
    ],
    [
      'heltec-v4-web-grip-external',
      'Heltec V4 · Palm Lock · External SMA · Compact top',
      'web-grip',
      'external',
      'compact-top',
    ],
    [
      'heltec-v4-web-grip-internal-fpc',
      'Heltec V4 · Palm Lock · Internal FPC',
      'web-grip',
      'internal',
      'compact-top',
    ],
  ];
  assert.deepEqual(
    part.presets.map((preset) => preset.id),
    expected.map(([id]) => id),
  );
  for (const [id, name, bodyModel, antennaType, externalMount] of expected) {
    const preset = part.presets.find((preset) => preset.id === id)!;
    assert.equal(preset.name, name, id);
    assert.deepEqual(
      preset.parameters,
      { ...unchanged, bodyModel, antennaType, externalMount },
      id,
    );
  }
});

test('named handheld models are searchable and antenna filters remain independent of the device family', () => {
  const library = buildLibrarySearchIndex(groupBrowseFamilies([part]));
  for (const query of ['Heltec V4', 'Straight', 'Palm', 'Palm Lock']) {
    const matches = searchLibrary(library, query);
    assert.deepEqual(
      matches.map((match) => match.family.id),
      ['handheld-lora-controller'],
      query,
    );
    assert.equal(
      matches[0].articleQuery,
      query,
      'the chooser retains the searched model terminology',
    );
  }
  for (const [bodyModel, label, externalCount] of [
    ['original', 'Straight', 1],
    ['contoured', 'Palm', 2],
    ['web-grip', 'Palm Lock', 1],
  ] as const) {
    for (const antennaType of ['internal', 'external']) {
      const result = filterPresets(index, {
        ...filters({ bodyModel, antennaType }),
        query: `Heltec V4 ${label}`,
      });
      assert.deepEqual(result.errors, []);
      assert.equal(result.items.length, antennaType === 'internal' ? 1 : externalCount);
      for (const { preset } of result.items) {
        assert.ok(preset.name.startsWith(`Heltec V4 · ${label} · `));
        assert.equal(preset.parameters.antennaType, antennaType);
      }
    }
  }
});

test('handheld body and antenna facets filter independently without exposing mount or inspection poses', () => {
  const body = fields.find((field) => field.key === 'bodyModel');
  const antenna = fields.find((field) => field.key === 'antennaType');
  assert.ok(body);
  assert.ok(antenna);
  assert.deepEqual(
    new Set(fields.map((field) => field.key)),
    new Set(['bodyModel', 'antennaType']),
  );
  for (const key of ['externalMount', 'safetyPosition', 'buttonA', 'buttonB', 'powerButton'])
    assert.ok(!fields.some((field) => field.key === key), key);

  const internal = filters({ antennaType: 'internal' });
  const external = filters({ antennaType: 'external' });
  assert.deepEqual(
    new Map(presetFacetOptions(index, internal, body).map(({ value, count }) => [value, count])),
    new Map([
      ['original', 1],
      ['contoured', 1],
      ['web-grip', 1],
    ]),
  );
  assert.deepEqual(
    new Map(presetFacetOptions(index, external, body).map(({ value, count }) => [value, count])),
    new Map([
      ['original', 1],
      ['contoured', 2],
      ['web-grip', 1],
    ]),
  );
  for (const bodyModel of ['original', 'contoured', 'web-grip'])
    for (const antennaType of ['internal', 'external']) {
      const result = filterPresets(index, filters({ bodyModel, antennaType }));
      assert.deepEqual(result.errors, []);
      assert.ok(result.items.length > 0, `${bodyModel}/${antennaType}`);
      assert.ok(
        result.items.every(
          ({ preset }) =>
            preset.parameters.bodyModel === bodyModel &&
            preset.parameters.antennaType === antennaType,
        ),
      );
    }
  assert.deepEqual(
    new Set(
      presetFacetOptions(index, filters({ bodyModel: 'web-grip' }), antenna).map(
        ({ value }) => value,
      ),
    ),
    new Set(['internal', 'external']),
  );
});

test('handheld catalog retains earlier configurations and adds prototype choices without supplier claims', () => {
  assert.equal(part.presets.length, 7);
  assert.notEqual(part.catalogSelectionOnly, true);
  assert.ok(part.presets.every((preset) => !preset.catalog));
  assert.equal(
    filterPresets(index, { ...emptyPresetFilters(part), kind: 'examples' }).items.length,
    7,
  );
  assert.equal(
    filterPresets(index, { ...emptyPresetFilters(part), kind: 'catalog' }).items.length,
    0,
  );
  for (const [id, bodyModel, antennaType, externalMount] of [
    ['heltec-v4-two-ds225', 'original', 'external', 'bottom'],
    ['heltec-v4-contoured-top-sma', 'contoured', 'external', 'top'],
    ['heltec-v4-contoured-internal-fpc', 'contoured', 'internal', 'top'],
  ]) {
    const preset = part.presets.find((preset) => preset.id === id);
    assert.ok(preset, id);
    assert.equal(preset.parameters.bodyModel, bodyModel);
    assert.equal(preset.parameters.antennaType, antennaType);
    assert.equal(preset.parameters.externalMount, externalMount);
  }
  assert.equal(part.defaults.bodyModel, 'contoured');
  assert.equal(part.defaults.antennaType, 'external');
  assert.equal(part.defaults.externalMount, 'compact-top');
  assert.equal(defaultPartSelection(part).presetId, 'heltec-v4-contoured-compact-sma');
  for (const preset of part.presets)
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
});

test('handheld external position and mechanical blocker appear only in their relevant configurations', () => {
  const mount = part.parameters.find((field) => field.key === 'externalMount');
  const blocker = part.parameters.find((field) => field.key === 'safetyPosition');
  const second = part.parameters.find((field) => field.key === 'buttonA');
  assert.ok(mount?.visibleWhen);
  assert.ok(blocker?.visibleWhen);
  assert.equal(mount.visibleWhen({ ...part.defaults, antennaType: 'internal' }), false);
  assert.equal(mount.visibleWhen({ ...part.defaults, antennaType: 'external' }), true);
  assert.equal(blocker.visibleWhen({ ...part.defaults, bodyModel: 'original' }), false);
  assert.equal(blocker.visibleWhen({ ...part.defaults, bodyModel: 'contoured' }), false);
  assert.equal(blocker.visibleWhen({ ...part.defaults, bodyModel: 'web-grip' }), true);
  assert.equal(second?.label, 'Second button');
  assert.equal(part.defaults.safetyPosition, 'locked');
});

test('web second-button inspection requires unlocking and rejects retired configuration keys', () => {
  const web = { ...part.defaults, bodyModel: 'web-grip', buttonA: 'last' };
  assert.deepEqual(validateParameters(part, web, 'assembled'), [
    'Unlock the mechanical safety before pressing the web button',
  ]);
  assert.deepEqual(
    validateParameters(part, { ...web, safetyPosition: 'unlocked' }, 'assembled'),
    [],
  );
  assert.deepEqual(
    validateParameters(part, { ...part.defaults, buttonA: 'last' }, 'assembled'),
    [],
  );
  for (const key of ['gripStyle', 'antennaMount'])
    assert.ok(
      validateParameters(part, { ...part.defaults, [key]: 'original' }, 'assembled').some(
        (error) => error === `Unsupported enclosure setting: ${key}.`,
      ),
    );
});
