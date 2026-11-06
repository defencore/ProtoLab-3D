import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParameterDefinition, Preset } from '../src/core/types';
import {
  catalogFilterErrors,
  matchesCatalogFilters,
  presetMatchesConfiguration,
  catalogFacetOptions,
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
import nut from '../src/parts/hex-nut/part';
import { eskdIdentity } from '../src/core/eskd';

const servo = servoModule.part;
const fields = servo.catalogFilterFields!;

test('declared nut inspection allowances preserve nominal sourcing without merging geometry identities', () => {
  const preset = nut.presets.find((item) => item.catalog)!;
  const nominal = { ...nut.defaults, ...preset.parameters };
  const inspection = { ...nominal, threadAllowance: 0.05 };
  const before = structuredClone(inspection);
  assert.equal(presetMatchesConfiguration(nut, preset, inspection), true);
  const nominalIdentity = eskdIdentity(nut, nominal, 'default', preset.id);
  const inspectionIdentity = eskdIdentity(nut, inspection, 'default', preset.id);
  assert.equal(inspectionIdentity.libraryEntryId, nominalIdentity.libraryEntryId);
  assert.notEqual(inspectionIdentity.configurationKey, nominalIdentity.configurationKey);
  assert.deepEqual(inspection, before);
  for (const threadAllowance of [-0.01, 0.21, NaN])
    assert.equal(presetMatchesConfiguration(nut, preset, { ...nominal, threadAllowance }), false);
  for (const evidence of [
    { verifiedParameters: [...preset.catalog!.verifiedParameters, 'threadAllowance'] },
    { attributes: { threadAllowance: 0 } },
    { attributeOptions: { threadAllowance: ['0'] } },
    { parameterRanges: { threadAllowance: { min: 0, max: 0 } } },
    { parameterChoices: { threadAllowance: [0] } },
  ])
    assert.equal(
      presetMatchesConfiguration(
        nut,
        { ...preset, catalog: { ...preset.catalog!, ...evidence } },
        inspection,
      ),
      false,
      'published dimensions cannot be replaced by an inspection convention',
    );
  assert.equal(
    presetMatchesConfiguration(
      { ...nut, catalogIdentityParameters: undefined },
      preset,
      inspection,
    ),
    false,
    'families without an explicit inspection contract require exact dimensions',
  );
});

test('catalog intervals validate input and combine inclusive characteristics without changing a model', () => {
  const before = JSON.stringify(servo.presets);
  for (const preset of servo.presets)
    assert.equal(matchesCatalogFilters(preset, fields, { caseWidth: { min: ' ', max: '' } }), true);
  const filters = { caseWidth: { max: '20' }, stallTorque: { min: '20' } };
  assert.deepEqual(
    servo.presets
      .filter((preset) => matchesCatalogFilters(preset, fields, filters))
      .map((p) => p.parameters.model),
    ['power-hd-tds-2', 'waveshare-st3025', 'hitec-hsb-9380th', 'chaservo-hv3609', 'hitec-d954sw'],
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
    ['power-hd-tds-2', 'waveshare-st3025', 'hitec-hsb-9380th', 'chaservo-hv3609', 'hitec-d954sw'],
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
    ['waveshare-st3215-hs', 'hitec-hsb-9380th', 'towerpro-mg996r'],
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
    ['power-hd-t60-bhv', 'hitec-hsb-9380th'],
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

test('catalog ranges share decimal-comma, inclusive and missing-scalar source interval semantics', () => {
  const preset = servo.presets.find((item) => item.parameters.model === 'waveshare-st3215-hs')!;
  assert.equal(
    matchesCatalogFilters(preset, fields, { stallCurrent: { min: ' 2,4 ', max: '2.4' } }),
    true,
  );
  const attributes = { ...preset.catalog!.attributes };
  delete attributes.caseWidth;
  const withoutScalar = {
    ...preset,
    catalog: {
      ...preset.catalog!,
      attributes,
      parameterRanges: { caseWidth: { min: 19, max: 21 } },
    },
  };
  assert.equal(
    matchesCatalogFilters(withoutScalar, fields, { caseWidth: { min: '20', max: '20' } }),
    true,
  );
  const malformed = {
    ...withoutScalar,
    catalog: { ...withoutScalar.catalog, parameterRanges: { caseWidth: { min: 21, max: 19 } } },
  };
  assert.equal(
    matchesCatalogFilters(malformed, fields, { caseWidth: { min: '20', max: '20' } }),
    false,
  );
});

test('disabled fields and filters for the wrong control type are explicit errors', () => {
  const disabled = fields.map((field) =>
    field.key === 'caseWidth' ? { ...field, filterable: false } : field,
  );
  for (const filter of [{ caseWidth: { min: '20' } }]) {
    assert.ok(catalogFilterErrors(disabled, filter).length);
    assert.ok(servo.presets.every((preset) => !matchesCatalogFilters(preset, disabled, filter)));
  }
  assert.ok(catalogFilterErrors(fields, { caseWidth: { value: '20' } }).length);
  assert.ok(catalogFilterErrors(fields, { interfaceType: { min: '20' } }).length);
});

test('contextual catalog facets count actual source values and retain an unavailable selection without resetting it', () => {
  const filters = { caseWidth: { max: '20' }, interfaceType: { value: 'retired-interface' } };
  const options = catalogFacetOptions(
    servo.presets,
    fields,
    filters,
    'interfaceType',
    (preset) => preset.catalog!.manufacturer === 'KST',
  );
  assert.equal(options.find((option) => option.value === 'PWM')!.count, 5);
  assert.equal(options.find((option) => option.value === 'TTL serial bus')!.count, 0);
  assert.equal(options.find((option) => option.value === 'retired-interface')!.count, 0);
  assert.deepEqual(filters, {
    caseWidth: { max: '20' },
    interfaceType: { value: 'retired-interface' },
  });
});

test('missing identity keys never create a false exact configuration match', () => {
  const preset = servo.presets[0];
  const parameters = { ...preset.parameters };
  delete parameters.model;
  const absent = {
    ...preset,
    parameters,
    catalog: { ...preset.catalog!, verifiedParameters: ['model'] },
  };
  assert.equal(presetMatchesConfiguration(servo, absent, parameters), false);
});

test('boolean catalog filters agree with facets for verified source parameters and reject unknown values', () => {
  const fields: ParameterDefinition[] = [
    { key: 'sealed', label: 'Sealed', type: 'boolean', group: 'Characteristics' },
  ];
  const source = servo.presets[0].catalog!;
  const preset: Preset = {
    id: 'sealed-model',
    name: 'Sealed model',
    description: 'A source-verified boolean fixture.',
    parameters: { sealed: true },
    catalog: { ...source, verifiedParameters: ['sealed'], attributes: {} },
  };
  assert.equal(matchesCatalogFilters(preset, fields, { sealed: { value: 'true' } }), true);
  assert.equal(matchesCatalogFilters(preset, fields, { sealed: { value: 'false' } }), false);
  assert.deepEqual(catalogFacetOptions([preset], fields, {}, 'sealed'), [
    { value: 'true', label: 'Yes', count: 1 },
  ]);
  const unknown = { ...preset, catalog: { ...preset.catalog!, verifiedParameters: [] } };
  assert.equal(matchesCatalogFilters(unknown, fields, { sealed: { value: 'true' } }), false);
  assert.equal(
    matchesCatalogFilters(
      { ...preset, catalog: { ...preset.catalog!, attributes: { sealed: false } } },
      fields,
      { sealed: { value: 'false' } },
    ),
    true,
  );
});
