import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogFilterErrors,
  matchesCatalogFilters,
  presetMatchesConfiguration,
  type CatalogModelFilters,
} from '../src/core/catalog-models';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
  seedCurrentFilters,
} from '../src/core/preset-search';
import { matchingPresetId } from '../src/core/part-selection';
import { registerPartModules } from '../src/core/part-modules';
import servoModule from '../src/parts/servo-motor';

const servo = servoModule.part;
const fields = servo.catalogFilterFields!;

test('catalog intervals validate input and combine inclusive characteristics without changing a model', () => {
  const before = JSON.stringify(servo.presets);
  for (const preset of servo.presets)
    assert.equal(matchesCatalogFilters(preset, fields, { caseWidth: { min: ' ', max: '' } }), true);
  const filters = { caseWidth: { max: '20' }, stallTorque: { min: '20' } };
  assert.deepEqual(
    servo.presets
      .filter((preset) => matchesCatalogFilters(preset, fields, filters))
      .map((p) => p.parameters.model),
    ['power-hd-tds-2'],
  );
  assert.deepEqual(catalogFilterErrors(fields, filters), []);
  const invalidFilters: CatalogModelFilters[] = [
    { caseWidth: { min: '21', max: '20' } },
    { caseWidth: { max: 'Infinity' } },
    { missing: { value: 'yes' } },
  ];
  for (const invalid of invalidFilters) {
    assert.ok(catalogFilterErrors(fields, invalid).length);
    assert.ok(servo.presets.every((preset) => !matchesCatalogFilters(preset, fields, invalid)));
  }
  assert.equal(JSON.stringify(servo.presets), before);
});

test('advanced preset search filters published attributes while retaining fixed model identity', () => {
  const index = buildPresetIndex([servo]);
  const available = getFilterFields([servo]);
  assert.ok(available.some((field) => field.key === 'stallTorque'));
  assert.ok(!available.some((field) => field.key === 'outputAngle'));
  const maxWidth = fields.find((field) => field.key === 'caseWidth')!;
  const minTorque = fields.find((field) => field.key === 'stallTorque')!;
  const result = filterPresets(index, {
    ...emptyPresetFilters(servo),
    parameters: {
      [fieldId(maxWidth)]: { max: '20' },
      [fieldId(minTorque)]: { min: '20' },
    },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.items.map((item) => item.preset.parameters.model),
    ['power-hd-tds-2'],
  );
  const preset = result.items[0].preset;
  const pose = { ...preset.parameters, outputAngle: 45, showHorn: true };
  assert.equal(matchingPresetId(servo, pose), preset.id);
  assert.ok(presetMatchesConfiguration(servo, preset, pose));
  assert.equal(filterPresets(index, seedCurrentFilters(servo, pose)).items[0].preset.id, preset.id);
});

test('published operating conditions remain explicit when filtering current or voltage', () => {
  const current = servo.presets.filter((preset) =>
    matchesCatalogFilters(preset, fields, { stallCurrent: { max: '2.45' } }),
  );
  assert.deepEqual(
    current.map((p) => p.parameters.model),
    ['waveshare-st3215-hs'],
  );
  assert.match(
    current[0].catalog!.attributeConditions!.stallCurrent,
    /test voltage not (stated|specified)/i,
  );
  const measured = servo.presets.filter((preset) =>
    matchesCatalogFilters(preset, fields, {
      referenceVoltage: { min: '7.4', max: '7.4' },
      stallCurrent: { max: '3' },
    }),
  );
  assert.deepEqual(
    measured.map((p) => p.parameters.model),
    ['power-hd-t60-bhv'],
  );
});

test('package validation rejects malformed or conflicting catalog characteristics', () => {
  const preset = servo.presets[0];
  for (const attributes of [
    { ...preset.catalog!.attributes, caseWidth: NaN },
    { ...preset.catalog!.attributes, unknownMetric: 2 },
  ]) {
    const changed = {
      ...servoModule,
      part: { ...servo, presets: [{ ...preset, catalog: { ...preset.catalog!, attributes } }] },
    };
    assert.throws(() => registerPartModules([changed]));
  }
  assert.throws(() =>
    registerPartModules([
      {
        ...servoModule,
        part: { ...servo, catalogFilterFields: [...fields, { ...fields[0], key: 'model' }] },
      },
    ]),
  );
});

test('fixed catalog identity must refer to a valid, present model parameter', () => {
  const preset = servo.presets[0];
  const withoutModel = { ...preset.parameters };
  delete withoutModel.model;
  for (const invalid of [
    { ...preset, catalog: { ...preset.catalog!, verifiedParameters: ['notAParameter'] } },
    { ...preset, catalog: { ...preset.catalog!, verifiedParameters: [] } },
    { ...preset, parameters: withoutModel },
    { ...preset, parameters: { ...preset.parameters, model: 'unknown-model' } },
  ]) {
    assert.throws(
      () => registerPartModules([{ ...servoModule, part: { ...servo, presets: [invalid] } }]),
      /identity/i,
    );
  }
});
