import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogFacetOptions, matchesCatalogFilters } from '../src/core/catalog-models';
import { registerPartModules } from '../src/core/part-modules';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
  presetFacetOptions,
} from '../src/core/preset-search';
import servoModule from '../src/parts/servo-motor';
import type { ParameterDefinition, Preset } from '../src/core/types';

const field: ParameterDefinition = {
  key: 'familyMaterial',
  label: 'Material options',
  type: 'select',
  group: 'Construction',
  options: ['ABS', 'PC'].map((value) => ({ value, label: value })),
};
const base = servoModule.part.presets[0];
const variant = (id: string, alternatives?: string[]): Preset => ({
  ...base,
  id,
  name: id,
  catalog: {
    ...base.catalog!,
    attributes: alternatives ? { familyMaterial: alternatives.join(' / ') } : {},
    ...(alternatives ? { attributeOptions: { familyMaterial: alternatives } } : {}),
  },
});
const presets = [
  variant('Family with ABS and PC', ['ABS', 'PC']),
  variant('ABS only', ['ABS']),
  variant('Unknown material'),
];
const definition = { ...servoModule.part, catalogFilterFields: [field], presets };

test('family options match each offered material and count each family once per option', () => {
  assert.deepEqual(
    presets
      .filter((preset) =>
        matchesCatalogFilters(preset, [field], { familyMaterial: { value: 'ABS' } }),
      )
      .map((preset) => preset.id),
    ['Family with ABS and PC', 'ABS only'],
  );
  assert.deepEqual(catalogFacetOptions(presets, [field], {}, field.key), [
    { value: 'ABS', label: 'ABS', count: 2 },
    { value: 'PC', label: 'PC', count: 1 },
  ]);
  const index = buildPresetIndex([definition]);
  const filters = {
    ...emptyPresetFilters(definition),
    parameters: { [fieldId(field)]: { value: 'PC' } },
  };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.preset.id),
    ['Family with ABS and PC'],
  );
  assert.deepEqual(presetFacetOptions(index, filters, getFilterFields([definition])[0]), [
    { value: 'ABS', label: 'ABS', count: 2 },
    { value: 'PC', label: 'PC', count: 1 },
  ]);
});

test('unpublished material cannot be inferred from a preview parameter', () => {
  const unknown = { ...presets[2], parameters: { ...presets[2].parameters, familyMaterial: 'PC' } };
  assert.equal(matchesCatalogFilters(unknown, [field], { familyMaterial: { value: 'PC' } }), false);
  assert.deepEqual(catalogFacetOptions([unknown], [field], {}, field.key), []);
});

test('package validation accepts distinct published alternatives and rejects unknown or duplicate choices', () => {
  assert.doesNotThrow(() => registerPartModules([{ ...servoModule, part: definition }]));
  for (const alternatives of [['ABS', 'ABS'], ['Imagined plastic'], [], [false]]) {
    const changed = {
      ...presets[0],
      catalog: {
        ...presets[0].catalog!,
        attributeOptions: { familyMaterial: alternatives as string[] },
      },
    };
    assert.throws(
      () => registerPartModules([{ ...servoModule, part: { ...definition, presets: [changed] } }]),
      /alternatives/i,
    );
  }
});
