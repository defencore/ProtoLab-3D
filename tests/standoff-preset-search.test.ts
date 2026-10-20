import assert from 'node:assert/strict';
import test from 'node:test';
import { dremecPresets } from '../src/catalog/dremec-presets';
import { kosmodromPresets } from '../src/catalog/kosmodrom-presets';
import { searchableFields } from '../src/core/catalog-models';
import {
  buildPresetIndex,
  compilePresetQuery,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
} from '../src/core/preset-search';
import part from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import { catalogFields } from '../src/parts/pcb-standoff/lib/schema';

const source = dremecPresets();
const kosmodrom = kosmodromPresets();
const presets = [...source.detail, ...kosmodrom];
const detail = { ...part, presets, catalogFilterFields: catalogFields(presets) };
const composite = {
  ...insert,
  presets: source.insert,
  catalogFilterFields: catalogFields(source.insert),
};
const index = buildPresetIndex([detail, composite]);

test('prefixed supplier article codes retain their identity instead of becoming an unsupported dimensional claim', () => {
  for (const code of ['TFM-M3X20', 'TFM-M3X25']) {
    assert.equal(compilePresetQuery(code).metricSize, undefined);
    const result = filterPresets(index, { ...emptyPresetFilters(), query: code });
    assert.deepEqual(result.errors, []);
    assert.equal(result.items.length, 1, code);
    assert.equal(result.items[0].preset.catalog?.designation, code);
  }
});

test('fixed supplier search exposes catalog characteristics without hidden identity or manufacturing controls', () => {
  const fields = getFilterFields([detail, composite]);
  assert.deepEqual(
    searchableFields(detail).map((field) => field.key),
    detail.catalogFilterFields.map((field) => field.key),
  );
  for (const key of [
    'catalogItem',
    'profile',
    'bodyLength',
    'endA',
    'femaleDepthA',
    'threadPitchA',
    'maleEnvelopeLengthB',
    'insertOuterDiameter',
  ])
    assert.ok(!fields.some((field) => field.key === key), `${key} is not a product filter`);
  const suppressed = {
    ...detail,
    catalogFilterFields: detail.catalogFilterFields.map((field) =>
      field.key === 'modelFidelity' ? { ...field, filterable: false } : field,
    ),
  };
  assert.ok(!searchableFields(suppressed).some((field) => field.key === 'modelFidelity'));
});

test('a search for M3 10 hex cannot match another body length merely because its hidden female depth is 10 mm', () => {
  const result = filterPresets(index, { ...emptyPresetFilters(), query: 'M3 10 hex' });
  assert.deepEqual(result.errors, []);
  assert.ok(result.items.some((item) => item.preset.name === '113x10'));
  for (const name of ['113x20', '113x30'])
    assert.ok(
      !result.items.some((item) => item.preset.name === name),
      `${name} is not a 10 mm body choice`,
    );
  const code = filterPresets(index, { ...emptyPresetFilters(), query: '00-00056000' });
  assert.deepEqual(
    code.items.map((item) => item.preset.name),
    ['TFF-M3X7'],
  );
});

test('source-end aliases find mixed UNC and metric products independently of geometry visibility', () => {
  const aliases = {
    ...detail,
    catalogFilterFields: detail.catalogFilterFields.map((field) => ({
      ...field,
      visibleWhen: () => false,
    })),
  };
  const fields = getFilterFields([aliases]);
  const result = filterPresets(buildPresetIndex([aliases]), {
    ...emptyPresetFilters(),
    parameters: {
      [fieldId(fields.find((field) => field.key === 'catalogThreadA')!)]: { value: 'UNC4-40' },
      [fieldId(fields.find((field) => field.key === 'catalogThreadB')!)]: { value: 'M3' },
    },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.items.some((item) => item.preset.name === '2103x5/4'));
  assert.ok(
    result.items.every(
      (item) =>
        item.preset.catalog!.attributes!.catalogThreadA === 'UNC4-40' &&
        item.preset.catalog!.attributes!.catalogThreadB === 'M3',
    ),
  );
  const inferred = kosmodrom.find((preset) => preset.name === 'TFM-B-M3X12')!;
  assert.equal(inferred.catalog!.attributes!.catalogThreadB, undefined);
  assert.ok(!inferred.catalog!.verifiedParameters.includes('threadDesignationB'));
});

test('five exact supplier overall lengths remain searchable without promoting nominal body lengths or projected studs to verified dimensions', () => {
  const published = kosmodrom.filter(
    (preset) => preset.catalog!.attributes!.catalogOverallLength !== undefined,
  );
  assert.deepEqual(
    published
      .map((preset) => [preset.name, preset.catalog!.attributes!.catalogOverallLength])
      .sort(),
    [
      ['TFM-M3X6', 12],
      ['TFM-M3X15', 21],
      ['TFM-M3X20', 26],
      ['TFM-M3X40', 46],
      ['TFM-M3X50', 56],
    ].sort(),
  );
  const field = getFilterFields([detail]).find(
    (candidate) => candidate.key === 'catalogOverallLength',
  )!;
  const result = filterPresets(index, {
    ...emptyPresetFilters(),
    parameters: { [fieldId(field)]: { min: '26', max: '26' } },
  });
  assert.deepEqual(
    result.items.map((item) => item.preset.name),
    ['TFM-M3X20'],
  );
  const nominal = result.items[0].preset;
  assert.equal(nominal.catalog!.attributes!.catalogBodyLength, undefined);
  assert.ok(!nominal.catalog!.verifiedParameters.includes('bodyLength'));
  assert.ok(!nominal.catalog!.verifiedParameters.includes('maleLengthB'));
  assert.match(nominal.catalog!.attributeConditions!.catalogOverallLength, /product table/);
  assert.equal(
    kosmodrom.find((preset) => preset.name === 'TFM-M3X25')!.catalog!.attributes!
      .catalogOverallLength,
    undefined,
  );
});
