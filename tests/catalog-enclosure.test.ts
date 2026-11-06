import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import enclosureModule from '../src/parts/catalog-enclosure';
import { enclosureModels, enclosurePresets } from '../src/parts/catalog-enclosure/lib/catalog';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
  presetFacetOptions,
} from '../src/core/preset-search';
import { sortPresetEntries } from '../src/core/preset-sort';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';
import { parametersForPreset } from '../src/core/part-selection';

const part = enclosureModule.part;
const index = buildPresetIndex([part]);
const grandado = part.presets.find((preset) => preset.id === 'grandado-83-58-35-clear')!;

test('selecting another fixed enclosure article replaces the current model', () => {
  const other = part.presets.find(
    (preset) => preset.parameters.model !== grandado.parameters.model,
  )!;
  const selected = parametersForPreset(part, grandado, other.parameters);
  assert.deepEqual(selected, grandado.parameters);
  assert.deepEqual(validateParameters(part, selected, 'assembled'), []);
  assert.deepEqual(parametersForPreset(part, other, selected), other.parameters);
});

test('catalog covers the supplier enclosure families while preserving source identity and evidence', () => {
  assert.equal(enclosureModels.length, 489);
  assert.equal(enclosureModels.filter((model) => model.manufacturer === 'Altinkaya').length, 488);
  assert.equal(new Set(enclosureModels.map((model) => model.id)).size, enclosureModels.length);
  const loosePartIds = new Set(
    [2523, 2524, 2525, 2342, 7438, 7439, 7441, 12312, 12313, 7926].map((id) => `altinkaya-${id}`),
  );
  assert.ok(
    enclosureModels.every((model) => !loosePartIds.has(model.id)),
    'Loose covers, PCB holders and support pieces are not enclosure choices.',
  );
  assert.deepEqual(part.presets, enclosurePresets);
  assert.deepEqual(
    part.presets,
    JSON.parse(
      readFileSync(new URL('../src/parts/catalog-enclosure/presets.json', import.meta.url), 'utf8'),
    ),
  );
  for (const model of enclosureModels) {
    assert.ok(
      [model.length, model.width, model.height].every(
        (value) => value > 0 && Number.isFinite(value),
      ),
      model.designation,
    );
    assert.match(model.sourceUrl, /^https:\/\//);
    assert.ok(model.categoryLabel.length > 0);
  }
  assert.deepEqual(part.dimensions(grandado.parameters, 'assembled'), [110, 58, 35]);
  assert.equal(grandado.catalog!.attributes!.lidType, 'Opaque white (pictured)');
  assert.equal(grandado.catalog!.attributes!.length, undefined);
  assert.equal(grandado.catalog!.manufacturer, undefined);
  assert.equal(grandado.catalog!.attributes!.ipRating, undefined);
});

test('supplier, size and protection filters narrow actual models without assuming unknown IP', () => {
  assert.equal(
    filterPresets(index, { ...emptyPresetFilters(part), sourceName: grandado.catalog!.sourceName })
      .items.length,
    1,
  );
  const fields = getFilterFields([part]);
  const size = Object.fromEntries(
    ['length', 'width', 'height'].map((key, axis) => [
      fieldId(fields.find((field) => field.key === key)!),
      { min: String([83, 58, 35][axis]), max: String([83, 58, 35][axis]) },
    ]),
  );
  const exact = filterPresets(index, { ...emptyPresetFilters(part), parameters: size });
  assert.ok(
    !exact.items.some((entry) => entry.preset.id === grandado.id),
    'The 83 mm body length must not imply an exact outside length including mounting ears.',
  );
  const protectedModels = filterPresets(index, {
    ...emptyPresetFilters(part),
    parameters: { [fieldId(fields.find((field) => field.key === 'ipRating')!)]: { value: 'IP67' } },
  });
  assert.ok(protectedModels.items.length > 100);
  assert.ok(!protectedModels.items.some((entry) => entry.preset.id === grandado.id));
  const ip = fields.find((field) => field.key === 'ipRating')!;
  assert.equal(
    presetFacetOptions(index, emptyPresetFilters(part), ip).find(
      (option) => option.value === 'IP67',
    )!.count,
    protectedModels.items.length,
  );
});

test('variable-size families retain source intervals and remain last when exact volume is unknown', () => {
  const ranged = enclosureModels.filter((model) => model.dimensionRanges);
  assert.ok(ranged.length >= 40);
  const model =
    ranged.find((model) => model.designation === 'EC-1624' || model.designation === 'EC1624') ??
    ranged[0];
  const preset = part.presets.find((preset) => preset.id === model.id)!;
  for (const [key, range] of Object.entries(model.dimensionRanges!)) {
    assert.equal(preset.catalog!.attributes![key], undefined);
    assert.deepEqual(preset.catalog!.parameterRanges![key], range);
    const field = getFilterFields([part]).find((field) => field.key === key)!;
    const matching = filterPresets(index, {
      ...emptyPresetFilters(part),
      parameters: { [fieldId(field)]: { min: String(range!.max), max: String(range!.max) } },
    });
    assert.ok(matching.items.some((entry) => entry.preset.id === model.id));
  }
  const sorted = sortPresetEntries(index, part.catalogSortOptions![0]);
  assert.deepEqual(
    new Set(sorted.slice(-(ranged.length + 1)).map((entry) => entry.preset.id)),
    new Set([...ranged.map((entry) => entry.id), grandado.id]),
    'Variable families and the Grandado body-only source size cannot claim an exact outside volume.',
  );
});

test('source stock choices reject intermediate dimensions that the supplier does not offer', () => {
  const model = enclosureModels.find((model) => model.designation === 'AL-052')!;
  const preset = part.presets.find((preset) => preset.id === model.id)!;
  assert.deepEqual(preset.catalog!.parameterChoices!.height, [50, 100, 150, 200]);
  const field = getFilterFields([part]).find((field) => field.key === 'height')!;
  for (const value of [50, 75, 100, 125, 150, 200]) {
    const matching = filterPresets(index, {
      ...emptyPresetFilters(part),
      query: 'AL-052',
      parameters: { [fieldId(field)]: { min: String(value), max: String(value) } },
    });
    assert.equal(
      matching.items.some((entry) => entry.preset.id === model.id),
      value !== 75 && value !== 125,
    );
  }
});

test('catalog boxes stay fixed purchased units when saved in a project', () => {
  assert.deepEqual(validateParameters(part, grandado.parameters, 'assembled'), []);
  assert.ok(
    validateParameters(part, { ...grandado.parameters, length: 100 }, 'assembled').length > 0,
  );
  assert.ok(validateParameters(part, { model: 'invented-model' }, 'assembled').length > 0);
  const project = addProduct(createProject('Enclosure selection'), [part], {
    part,
    parameters: grandado.parameters,
    state: 'assembled',
    presetId: grandado.id,
  }).project;
  assert.equal(project.configurations.length, 1);
  assert.equal(project.configurations[0].supply, 'purchased');
  assert.equal(project.configurations[0].procurement!.source, grandado.catalog!.sourceUrl);
  assert.deepEqual(
    parseProject(serializeProject(project, [part]), [part]).configurations,
    project.configurations,
  );
});

register(
  `data:text/javascript,${encodeURIComponent(`export async function load(url, context, nextLoad) { if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true }; return nextLoad(url, context); }`)}`,
  import.meta.url,
);
const { default: CatalogModelPicker } = await import('../src/components/CatalogModelPicker');

test('enclosure picker exposes supplier, A/B/C ranges, family options and volume sorting', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    const html = renderToStaticMarkup(
      React.createElement(CatalogModelPicker, {
        parts: [part],
        part,
        parameters: grandado.parameters,
        presetId: grandado.id,
        onQueryChange() {},
        onSelect() {},
        onSelectPart() {},
      }),
    );
    for (const label of [
      'Filter catalog supplier',
      'Filter enclosure type',
      'Minimum outside a (x)',
      'Minimum outside b (y)',
      'Minimum outside c (z)',
      'Sort catalog models',
    ])
      assert.ok(html.includes(`aria-label="${label}"`), label);
    assert.match(html, /Smallest outside volume/);
    assert.match(html, /489 of 489 models/);
    assert.match(html, /More characteristics/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
