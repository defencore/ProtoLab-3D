import assert from 'node:assert/strict';
import test from 'node:test';
import screw from '../src/parts/ball-screw/part';
import stepper from '../src/parts/stepper-motor/part';
import type { Preset } from '../src/core/types';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';

test('SFK08025 identifies the 8 mm, 2.5 mm-lead configurations without joining a different model and shaft length', () => {
  const results = filterPresets(buildPresetIndex([screw]), {
    ...emptyPresetFilters(screw),
    query: 'SFK08025',
  });
  assert.deepEqual(results.errors, []);
  assert.equal(results.items.length, 30);
  assert.ok(
    results.items.every(
      ({ preset }) => preset.parameters.shaftDiameter === 8 && preset.parameters.lead === 2.5,
    ),
  );
  assert.ok(!results.items.some(({ preset }) => preset.name.startsWith('SFK0802 ')));
});

test('model queries allow spaces between letters and numbers while preserving numeric runs', () => {
  const names = [
    'SFK0802 · 500 mm',
    'SFK0802 · 550 mm',
    'SFK080250 · 100 mm',
    'SFK 08025 · 100 mm',
    'AB 12 CD 34',
    'AB 1 2 CD 34',
    'AB 12 CD 345',
    '1608 RS',
    '608 RS',
  ];
  const presets: Preset[] = names.map((name, index) => ({
    id: String(index),
    name,
    description: '',
    parameters: { length: 100 },
  }));
  const part = { ...screw, id: 'query-fixture', name: 'Query fixture', keywords: [], presets };
  const index = buildPresetIndex([part]);
  const matched = (query: string) =>
    filterPresets(index, { ...emptyPresetFilters(part), query }).items.map(
      ({ preset }) => preset.name,
    );
  assert.deepEqual(matched('SFK08025'), ['SFK 08025 · 100 mm']);
  assert.deepEqual(matched('AB12CD34'), ['AB 12 CD 34']);
  assert.deepEqual(matched('608RS'), ['608 RS']);
});

test('NEMA17 retains the existing NEMA 17 motor results', () => {
  const index = buildPresetIndex([stepper]);
  const matched = (query: string) =>
    filterPresets(index, { ...emptyPresetFilters(stepper), query }).items.map(
      ({ preset }) => preset.id,
    );
  const expected = stepper.presets
    .filter((preset) => /NEMA 17\b/.test(preset.name))
    .map((preset) => preset.id);
  assert.ok(expected.length > 0);
  assert.deepEqual(matched('NEMA17'), expected);
  assert.deepEqual(matched('NEMA 17'), expected);
});

test('punctuation-free exact supplier codes and designations remain searchable', () => {
  const presets: Preset[] = [
    {
      id: 'code',
      name: 'Catalog execution',
      description: '',
      parameters: {},
      catalog: {
        designation: 'Other reference',
        sourceName: 'Fixture',
        sourceUrl: 'https://example.com/reference',
        verifiedParameters: [],
        productCodes: ['AB-12-CD-34'],
      },
    },
    {
      id: 'designation',
      name: 'Catalog execution',
      description: '',
      parameters: {},
      catalog: {
        designation: '6204-2RS',
        sourceName: 'Fixture',
        sourceUrl: 'https://example.com/reference',
        verifiedParameters: [],
      },
    },
  ];
  const part = { ...screw, id: 'query-fixture', name: 'Query fixture', keywords: [], presets };
  const index = buildPresetIndex([part]);
  const matched = (query: string) =>
    filterPresets(index, { ...emptyPresetFilters(part), query }).items.map(
      ({ preset }) => preset.id,
    );
  assert.deepEqual(matched('AB12CD34'), ['code']);
  assert.deepEqual(matched('AB12CD34 Fixture'), ['code']);
  assert.deepEqual(matched('62042RS'), ['designation']);
  assert.deepEqual(matched('62042RS Fixture'), ['designation']);
});
