import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changePresetBrowserScope,
  presetBrowserPage,
  presetBrowserScope,
  presetBrowserSelection,
} from '../src/core/preset-browser';
import { buildPresetIndex, emptyPresetFilters, fieldId } from '../src/core/preset-search';
import type { ParameterDefinition, PartDefinition, Preset } from '../src/core/types';

function numeric(key: string, label = key, unit = 'mm'): ParameterDefinition {
  return { key, label, unit, type: 'number', group: 'Dimensions' };
}

function fixture(
  id: string,
  parameters: ParameterDefinition[],
  changes: Partial<PartDefinition> = {},
): PartDefinition {
  return {
    id,
    name: id,
    category: 'FASTENERS & THREADS',
    subgroup: 'SPACERS & STANDOFFS',
    description: '',
    keywords: [],
    icon: 'bolt',
    complexity: 'Simple',
    product: {
      kind: 'detail',
      supply: 'manufactured',
      description: '',
      processes: [],
      releaseRequirements: [],
    },
    parameters,
    defaults: { diameter: 6, length: 10 },
    presets: [],
    validate: () => [],
    buildGeometry: () => {
      throw new Error('Browser data tests do not build geometry.');
    },
    python: () => '',
    dimensions: () => [1, 1, 1],
    ...changes,
  };
}

const length = numeric('length', 'Overall length');
const diameter = numeric('diameter', 'Body diameter');
const bodyLength = { ...numeric('catalogBodyLength', 'Body length'), catalogSummary: true };
const fixturePreset: Preset = {
  id: 'six-by-ten',
  name: 'M3 spacer',
  description: '',
  parameters: { diameter: 6, length: 10, pose: 'closed' },
  catalog: {
    designation: 'M3-10',
    sourceName: 'Supplier One',
    sourceUrl: 'https://example.com/m3-10',
    manufacturer: 'Maker One',
    verifiedParameters: ['diameter', 'length'],
    attributes: { catalogBodyLength: 10, rating: 'Published' },
  },
};
const family = { id: 'spacers', label: 'Spacers' };
const spacer = fixture('plain-spacer', [diameter, length], {
  browseFamily: family,
  presets: [fixturePreset],
  presetMatchKeys: ['diameter', 'length'],
});
const standoff = fixture('standoff', [diameter, bodyLength, numeric('pilotDepth')], {
  browseFamily: family,
  presetMatchKeys: ['diameter'],
});

test('a family separates source body lengths from sleeve lengths and promotes catalog summaries', () => {
  const scope = presetBrowserScope([spacer, standoff], spacer.category, family.id);
  assert.deepEqual(scope.scopeParts, [spacer, standoff]);
  assert.equal(scope.broadScope, false);
  assert.equal(
    scope.fields.find((field) => field.key === 'length')?.label,
    'Plain spacer / sleeve length',
  );
  assert.equal(
    scope.fields.find((field) => field.key === 'catalogBodyLength')?.label,
    'Catalog body length',
  );
  assert.deepEqual(
    scope.primaryFields.map((field) => field.key),
    ['diameter', 'length', 'catalogBodyLength'],
  );
  assert.deepEqual(
    scope.additionalFields.map((field) => field.key),
    ['pilotDepth'],
  );
  assert.equal(length.label, 'Overall length', 'scope-specific labels do not mutate definitions');
});

test('broad bearing browsing uses shared bore, outside and width fields; physical scopes retain labels', () => {
  const bearingFields = [
    numeric('bore', 'Shaft bore'),
    numeric('outer', 'Race OD'),
    numeric('width'),
    diameter,
  ];
  const first = fixture('bearing-one', bearingFields, { category: 'BEARINGS & SEALS' });
  const second = fixture('bearing-two', bearingFields, { category: first.category });
  const broad = presetBrowserScope([first, second], first.category, '');
  assert.equal(broad.broadScope, true);
  assert.deepEqual(
    broad.primaryFields.map((field) => field.key),
    ['bore', 'outer', 'width'],
  );
  assert.equal(broad.fields.find((field) => field.key === 'outer')?.label, 'Outside diameter');
  assert.equal(broad.fields.find((field) => field.key === 'diameter')?.label, 'Nominal diameter');
  assert.deepEqual(
    presetBrowserScope([first, second], '', '').primaryFields.map((field) => field.key),
    ['bore', 'width', 'diameter'],
  );
  const physical = presetBrowserScope([first, second], first.category, first.id);
  assert.deepEqual(physical.scopeParts, [first]);
  assert.equal(physical.fields.find((field) => field.key === 'outer')?.label, 'Race OD');
});

test('scope changes retain compatible filters and provenance without mutating the controlled value', () => {
  const filters = {
    ...emptyPresetFilters(),
    query: 'M3',
    kind: 'catalog' as const,
    sourceName: 'Supplier One',
    manufacturer: 'Maker One',
    parameters: {
      [fieldId(length)]: { min: '10', max: '5' },
      [fieldId(bodyLength)]: { min: '10' },
      [fieldId(numeric('length', 'Length in inches', 'in'))]: { min: '1' },
    },
  };
  const original = structuredClone(filters);
  const changed = changePresetBrowserScope([spacer, standoff], filters, spacer.category, spacer.id);
  assert.equal(changed.query, 'M3');
  assert.equal(changed.kind, 'catalog');
  assert.equal(changed.sourceName, 'Supplier One');
  assert.equal(changed.manufacturer, 'Maker One');
  assert.deepEqual(changed.parameters, { [fieldId(length)]: { min: '10', max: '5' } });
  assert.deepEqual(filters, original);

  const unavailable = changePresetBrowserScope(
    [spacer, standoff],
    filters,
    standoff.category,
    standoff.id,
  );
  assert.equal(unavailable.sourceName, '');
  assert.equal(unavailable.manufacturer, '');
  assert.deepEqual(unavailable.parameters, { [fieldId(bodyLength)]: { min: '10' } });
});

test('selection remains tied to the preview when excluded from results, with catalog attributes in review', () => {
  const purchased = { ...spacer, catalogSelectionOnly: true };
  const index = buildPresetIndex([purchased]);
  const current = { ...fixturePreset.parameters, pose: 'open', rating: 'Prototype' };
  const selection = presetBrowserSelection(index, [], purchased, current, fixturePreset.id);
  assert.equal(selection.selected, index[0]);
  assert.equal(selection.selectedId, `${purchased.id}:${fixturePreset.id}`);
  assert.equal(selection.selectedOutsideResults, true);
  assert.equal(selection.reviewParameters, current);
  assert.equal(selection.reviewValues.pose, 'open');
  assert.equal(selection.reviewValues.rating, 'Published');
  assert.equal(current.rating, 'Prototype');

  const included = presetBrowserSelection(index, index, purchased, current, fixturePreset.id);
  assert.equal(included.selectedOutsideResults, false);
  const mismatched = presetBrowserSelection(
    index,
    index,
    purchased,
    { ...current, diameter: 8 },
    fixturePreset.id,
  );
  assert.equal(mismatched.selected, undefined);
  assert.equal(mismatched.selectedId, '');
  assert.deepEqual(mismatched.reviewValues, {});
});

test('editable examples use their exact preset configuration and original review values', () => {
  const example = fixture('example', [diameter, length], {
    defaults: { ...fixturePreset.parameters },
    presets: [{ ...fixturePreset, catalog: undefined }],
  });
  const index = buildPresetIndex([example]);
  const selection = presetBrowserSelection(
    index,
    index,
    example,
    fixturePreset.parameters,
    fixturePreset.id,
  );
  assert.equal(selection.reviewParameters, example.presets[0].parameters);
  assert.equal(selection.selected, index[0]);
  assert.equal(
    presetBrowserSelection(
      index,
      index,
      example,
      { ...fixturePreset.parameters, pose: 'open' },
      fixturePreset.id,
    ).selected,
    undefined,
  );
});

test('pagination retains twelve results per page and clamps a page after filtering', () => {
  const [entry] = buildPresetIndex([spacer]);
  const items = Array.from({ length: 25 }, (_, i) => ({ ...entry, id: String(i) }));
  const second = presetBrowserPage(items, 1);
  assert.equal(second.pageCount, 3);
  assert.equal(second.displayedPage, 1);
  assert.deepEqual(
    second.visibleItems.map((item) => item.id),
    Array.from({ length: 12 }, (_, i) => String(i + 12)),
  );
  assert.equal(second.hasPages, true);
  const clamped = presetBrowserPage(items.slice(0, 12), 2);
  assert.equal(clamped.pageCount, 1);
  assert.equal(clamped.displayedPage, 0);
  assert.equal(clamped.visibleItems.length, 12);
  assert.equal(clamped.hasPages, false);
  assert.deepEqual(presetBrowserPage([], 2), {
    pageCount: 1,
    displayedPage: 0,
    visibleItems: [],
    hasPages: false,
  });
});
