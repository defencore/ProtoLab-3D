import assert from 'node:assert/strict';
import test from 'node:test';
import spacer from '../src/parts/spacer/part';
import detail from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import sleeve from '../src/parts/dremec-spacer-sleeve/part';
import { kosmodromPresets } from '../src/catalog/kosmodrom-presets';
import { matchingPresetId } from '../src/core/part-selection';
import {
  buildStandoffCatalog,
  filterStandoffs,
  isStandoffPart,
  standoffFacetCounts,
  standoffBodyLengthOptions,
  standoffFacetLabel,
  standoffFilterFields,
  suggestedStandoffParameters,
  rememberStandoffBodyLength,
  changeStandoffBodyLengthMode,
  standoffConfigurationMatches,
  captureStandoffTemplate,
  resolveStandoffPreviewEntry,
  type StandoffFilters,
} from '../src/core/standoff-catalog';

const parts = [spacer, detail, insert, sleeve];
const entries = buildStandoffCatalog(parts);
const entry = (id: string) => {
  const result = entries.find((row) => row.preset.id === id);
  assert.ok(result, id);
  return result;
};
const ids = (filters: StandoffFilters) =>
  filterStandoffs(entries, filters)
    .items.map((row) => row.id)
    .sort();

test('the unified family view preserves all fixed identities, custom-order records and editable examples', () => {
  assert.equal(entries.length, 4_451);
  assert.equal(new Set(entries.map((row) => row.id)).size, entries.length);
  assert.deepEqual(filterStandoffs(entries).items, entries);
  for (const row of entries) {
    assert.strictEqual(
      row.part,
      parts.find((part) => part.id === row.part.id),
    );
    assert.strictEqual(
      row.preset,
      row.part.presets.find((preset) => preset.id === row.preset.id),
    );
    assert.equal(
      row.preset.parameters.catalogItem,
      row.part.catalogSelectionOnly ? row.preset.id : undefined,
    );
  }
  assert.equal(entries.filter((row) => row.construction === 'single-piece').length, 3_441);
  assert.equal(entries.filter((row) => row.construction === 'metal-insert').length, 1_003);
  assert.equal(entries.filter((row) => row.construction === 'custom-sleeve').length, 4);
  assert.equal(entries.filter((row) => row.construction === 'plain-spacer').length, 3);
  assert.equal(isStandoffPart(detail), true);
  assert.equal(isStandoffPart({ id: 'bolt-screw' }), false);
  assert.deepEqual(buildStandoffCatalog([{ ...spacer, id: 'unrelated' }]), []);
  assert.equal(entry('pcb').supplier, 'unspecified');
  assert.equal(entry('pcb').evidence.bodyLength, 'design');
  assert.match(entry('pcb').notes.join(' '), /no supplier/);
});

test('either-end and ordered endpoint selectors retain mixed metric, UNC and self-tapping identities', () => {
  const mixed = entry('dremec-2103x5-4');
  assert.deepEqual(mixed.threads, ['UNC4-40', 'M3']);
  assert.equal(mixed.threadA, 'UNC4-40');
  assert.equal(mixed.threadB, 'M3');
  const reverse = entry('dremec-2130x6-8');
  assert.equal(reverse.threadA, 'M3');
  assert.equal(reverse.threadB, 'UNC4-40');
  const m3 = filterStandoffs(entries, { values: { thread: 'M3' } }).items;
  assert.equal(m3.length, 1_177);
  assert.ok(m3.includes(mixed) && m3.includes(reverse));
  assert.ok(!m3.some((row) => row.connection === 'plain'));
  const exactPair = filterStandoffs(entries, {
    values: { threadA: 'M3', threadB: 'UNC4-40' },
  }).items;
  assert.equal(exactPair.length, 8);
  assert.ok(exactPair.includes(reverse) && !exactPair.includes(mixed));
  const same = filterStandoffs(entries, { values: { threadA: 'M3', threadB: 'M3' } }).items;
  assert.equal(same.length, 1_131);
  assert.equal(standoffFacetLabel('thread', 'UNC4-40'), '#4-40 UNC');
  assert.equal(standoffFacetLabel('material', 'polyamide-brass'), 'Polyamide + brass inserts');
  assert.ok(
    filterStandoffs(entries, { values: { thread: 'ST2.9' } }).items.includes(
      entry('dremec-214ST2.9x8'),
    ),
  );
});

test('search numbers mean body length and cannot match hidden stud spans, widths or illustrative bore depths', () => {
  const result = filterStandoffs(entries, { query: 'M3 10' }).items;
  assert.equal(result.length, 48);
  assert.ok(result.every((row) => row.threads.includes('M3') && row.bodyLength === 10));
  assert.deepEqual(ids({ query: 'M3×10' }), ids({ query: 'M3 10' }));
  assert.deepEqual(ids({ query: 'M3*10' }), ids({ query: 'M3 10' }));
  for (const query of [
    'M3 10 mm',
    'M3 10mm',
    'M3 × 10',
    'M3 ×10',
    'M3× 10',
    'M3 X 10 MM',
    'M3×10mm',
    'M3 10\u043c\u043c',
  ])
    assert.deepEqual(ids({ query }), ids({ query: 'M3 10' }), query);
  assert.deepEqual(ids({ query: 'M2,5 10 mm' }), ids({ query: 'M2.5 10' }));
  assert.deepEqual(ids({ query: 'M2,5×10' }), ids({ query: 'M2.5 10' }));
  const hiddenTen = entry('dremec-2130x5-10');
  assert.equal(hiddenTen.preset.parameters.maleLengthB, 10);
  assert.ok(!result.includes(hiddenTen));
  assert.ok(
    !filterStandoffs(entries, { query: 'M3 2' }).items.includes(entry('kosmodrom-00-00040493')),
  );
  assert.ok(filterStandoffs(entries, { query: 'UNC #4-40' }).items.includes(hiddenTen));
  assert.deepEqual(ids({ query: '113×10' }), ids({ query: '113*10' }));
  const male = filterStandoffs(entries, { query: 'male' }).items;
  assert.ok(male.length > 0 && male.every((row) => row.connection.split('/').includes('male')));
  assert.deepEqual(ids({ query: 'stud' }), ids({ query: 'male' }));
  assert.deepEqual(ids({ query: 'socket' }), ids({ query: 'female' }));
  assert.ok(!male.includes(entry('dremec-113x18')));
});

test('designation-derived forms and disputed body sizes stay searchable with their qualifications intact', () => {
  const disputed = entry('kosmodrom-00-00054578');
  const catalog = disputed.preset.catalog!;
  assert.equal(disputed.bodyLength, 25);
  assert.equal(disputed.evidence.bodyLength, 'qualified');
  assert.equal(disputed.evidence.bodyForm, 'qualified');
  assert.equal(disputed.overallLength, undefined);
  assert.match(disputed.notes.join(' '), /qualified designation envelope/);
  assert.ok(!catalog.verifiedParameters.includes('bodyLength'));
  assert.equal(catalog.attributes!.catalogBodyLength, undefined);
  assert.ok(
    filterStandoffs(entries, {
      bodyLength: { min: 25, max: 25 },
      values: { bodyForm: 'hex' },
    }).items.includes(disputed),
  );
  const inferred = entry('kosmodrom-00-00040502');
  assert.equal(inferred.connection, 'female/female');
  assert.equal(inferred.evidence.connection, 'qualified');
  assert.ok(
    filterStandoffs(entries, { values: { connection: 'female/female' } }).items.includes(inferred),
  );
  assert.equal(inferred.preset.catalog!.attributes!.endForm, undefined);
  assert.ok(!inferred.preset.catalog!.verifiedParameters.includes('endB'));
  const composite = entry('dremec-1182x15');
  assert.equal(composite.material, 'polyamide-brass');
  assert.equal(composite.construction, 'metal-insert');
  assert.ok(
    filterStandoffs(entries, { values: { material: 'polyamide-brass' } }).items.includes(composite),
  );
});

test('overall fit dimensions use source totals or known real spans, excluding illustrative unknown studs', () => {
  assert.equal(entry('dremec-213x10').overallLength, 18);
  assert.equal(entry('dremec-213x10k').overallLength, 16);
  assert.equal(entry('dremec-213x10').evidence.overallLength, 'derived');
  const unresolved = entry('dremec-432x5');
  assert.equal(unresolved.preset.parameters.maleEnvelopeLengthA, 6);
  assert.equal(unresolved.overallLength, undefined);
  assert.ok(
    !filterStandoffs(entries, { overallLength: { min: 17, max: 17 } }).items.includes(unresolved),
  );
  assert.match(unresolved.notes.join(' '), /illustrative stud envelopes are excluded/);
  const official = kosmodromPresets().filter(
    (preset) => preset.catalog!.attributes!.catalogOverallLength !== undefined,
  );
  assert.equal(official.length, 5);
  const sourceEntries = buildStandoffCatalog([{ ...detail, presets: official }]);
  for (const row of sourceEntries) {
    assert.equal(row.overallLength, row.preset.catalog!.attributes!.catalogOverallLength);
    assert.equal(row.evidence.overallLength, 'published');
    assert.ok(
      filterStandoffs(sourceEntries, {
        overallLength: { min: row.overallLength, max: row.overallLength },
      }).items.includes(row),
    );
  }
  const inferredBody = sourceEntries.find((row) => row.preset.name === 'TFM-M3X20')!;
  assert.equal(inferredBody.bodyLength, 20);
  assert.equal(inferredBody.evidence.bodyLength, 'qualified');
  assert.equal(inferredBody.overallLength, 26);
  assert.ok(!inferredBody.preset.catalog!.verifiedParameters.includes('bodyLength'));
});

test('facet counts reflect all other selections and retain unavailable selections at zero', () => {
  const filters: StandoffFilters = {
    query: '10',
    values: { connection: 'female/male', thread: 'M3' },
  };
  const counts = standoffFacetCounts(entries, filters);
  for (const key of [
    'thread',
    'connection',
    'material',
    'coating',
    'supplier',
    'threadA',
    'threadB',
  ] as const)
    for (const option of counts[key]) {
      const expected = filterStandoffs(entries, {
        ...filters,
        values: { ...filters.values, [key]: option.value },
      }).items.length;
      assert.equal(option.count, expected, key + '/' + option.value);
    }
  assert.ok(counts.thread.some((row) => row.value === 'M3' && row.count > 0));
  const unavailable = standoffFacetCounts(entries, {
    ...filters,
    values: { ...filters.values, thread: 'M99' },
  });
  assert.deepEqual(
    unavailable.thread.find((row) => row.value === 'M99'),
    { value: 'M99', label: 'M99', count: 0 },
  );
  assert.ok(unavailable.thread.some((row) => row.value === 'M3' && row.count > 0));
  assert.ok(standoffFilterFields.some((field) => field.key === 'threadA'));
  assert.ok(
    standoffFilterFields.some(
      (field) => field.key === 'bodyWidth' && /diameter.*across flats/.test(field.label),
    ),
  );
});

test('body-length options come from fixed source catalogue models, never custom-order ranges or editable examples', () => {
  const options = standoffBodyLengthOptions(entries);
  const fixed = entries.filter((row) => row.part.catalogSelectionOnly);
  assert.deepEqual(
    options.map((option) => option.value),
    [...new Set(fixed.map((row) => row.bodyLength))].sort((a, b) => a - b),
  );
  assert.equal(
    options.reduce((sum, option) => sum + option.count, 0),
    4_444,
  );
  assert.equal(
    options.reduce((sum, option) => sum + option.publishedCount, 0),
    4_440,
  );
  assert.equal(
    options.reduce((sum, option) => sum + option.qualifiedCount, 0),
    4,
  );
  assert.equal(
    options.find((option) => option.value === 10)!.count,
    fixed.filter((row) => row.bodyLength === 10).length,
  );
  assert.deepEqual(
    standoffBodyLengthOptions(entries.filter((row) => row.construction === 'custom-sleeve')),
    [],
  );
  assert.deepEqual(
    standoffBodyLengthOptions(entries.filter((row) => row.construction === 'plain-spacer')),
    [],
  );
  assert.ok(!options.some((option) => option.value === 10.125));
  const customFilter = standoffBodyLengthOptions(entries, {
    values: { construction: 'custom-sleeve' },
    bodyLength: { min: 10.125, max: 10.125 },
  });
  assert.ok(customFilter.every((option) => option.count === 0));
  assert.deepEqual(
    customFilter.map((option) => option.value),
    options.map((option) => option.value),
  );
});

test('catalogue size counts use other active filters and the unchanged numeric query, excluding only their own interval', () => {
  const filters: StandoffFilters = {
    query: 'M3 × 10mm',
    values: { connection: 'female/male', material: 'brass' },
    bodyLength: { min: 18, max: 18 },
    bodyWidth: { min: '5', max: '5,5' },
  };
  const original = structuredClone(filters);
  Object.freeze(filters);
  Object.freeze(filters.values);
  Object.freeze(filters.bodyLength);
  const options = standoffBodyLengthOptions(entries, filters);
  const expected = filterStandoffs(
    entries.filter((row) => row.part.catalogSelectionOnly),
    { ...filters, bodyLength: undefined },
  ).items;
  assert.ok(expected.length > 0);
  assert.equal(options.find((option) => option.value === 10)!.count, expected.length);
  assert.ok(options.filter((option) => option.value !== 10).every((option) => option.count === 0));
  assert.deepEqual(filters, original);
  const byOtherFilters = standoffBodyLengthOptions(entries, {
    ...filters,
    query: 'M3',
    bodyLength: { min: 'not-a-number' },
  });
  assert.ok(byOtherFilters.filter((option) => option.count > 0).length > 1);
  for (const option of byOtherFilters) {
    const matches = filterStandoffs(
      entries.filter((row) => row.part.catalogSelectionOnly),
      { ...filters, query: 'M3', bodyLength: { min: option.value, max: option.value } },
    ).items;
    assert.equal(option.count, matches.length, String(option.value));
  }
  const differentDefaults = entries.map((row) => ({
    ...row,
    part: { ...row.part, defaults: { ...row.part.defaults, bodyLength: 777, length: 777 } },
  }));
  assert.deepEqual(standoffBodyLengthOptions(differentDefaults, filters), options);
});

test('qualified source-designation lengths stay explicitly labelled and do not change source evidence', () => {
  const disputed = entry('kosmodrom-00-00054578');
  const source = disputed.preset.catalog!;
  const before = structuredClone(source);
  const onlyQualified = standoffBodyLengthOptions([disputed]);
  assert.deepEqual(onlyQualified, [
    {
      value: 25,
      label: '25 mm (designation; verify)',
      count: 1,
      publishedCount: 0,
      qualifiedCount: 1,
      evidence: 'qualified',
    },
  ]);
  const unavailable = standoffBodyLengthOptions([disputed], { values: { material: 'steel' } });
  assert.equal(unavailable[0].count, 0);
  assert.equal(unavailable[0].evidence, 'qualified');
  assert.match(unavailable[0].label, /verify/);
  const published = entry('dremec-113x25');
  const combined = standoffBodyLengthOptions([disputed, published]);
  assert.deepEqual(combined, [
    {
      value: 25,
      label: '25 mm (includes qualified designations)',
      count: 2,
      publishedCount: 1,
      qualifiedCount: 1,
      evidence: 'published',
    },
  ]);
  assert.deepEqual(source, before);
  assert.ok(!source.verifiedParameters.includes('bodyLength'));
});

test('catalogue and range editors preserve separate manual values and never replace a range with the first model size', () => {
  const options = standoffBodyLengthOptions(entries);
  let state = rememberStandoffBodyLength({ mode: 'catalog' }, { min: '10', max: '10' });
  state = changeStandoffBodyLengthMode(state, 'range', options);
  assert.deepEqual(state.range, { min: '10', max: '10' });
  state = rememberStandoffBodyLength(state, { min: '20', max: '25' });
  state = changeStandoffBodyLengthMode(state, 'catalog', options);
  assert.deepEqual(state.catalog, { min: '10', max: '10' });
  state = changeStandoffBodyLengthMode(state, 'range', options);
  assert.deepEqual(state.range, { min: '20', max: '25' });
  const custom = changeStandoffBodyLengthMode(
    { mode: 'range', range: { min: '10,125', max: '10,125' } },
    'catalog',
    options,
  );
  assert.equal(custom.catalog, undefined);
  assert.deepEqual(custom.range, { min: '10,125', max: '10,125' });
  const invalid = changeStandoffBodyLengthMode(
    { mode: 'range', range: { min: 'bad', max: '2' } },
    'catalog',
    options,
  );
  assert.equal(invalid.catalog, undefined);
  assert.deepEqual(changeStandoffBodyLengthMode(invalid, 'range', options).range, {
    min: 'bad',
    max: '2',
  });
  const exact = changeStandoffBodyLengthMode(
    { mode: 'range', range: { min: '10,0', max: '10' } },
    'catalog',
    options,
  );
  assert.deepEqual(exact.catalog, { min: 10, max: 10 });
});

test('surface finish remains a source-qualified selection independent of base material and appearance', () => {
  const blackened = entry('kosmodrom-00-00070562');
  const nickel = entry('kosmodrom-00-00060018');
  const brass = entry('kosmodrom-00-00040493');
  assert.equal(blackened.material, 'steel');
  assert.equal(blackened.coating, 'blackened');
  assert.equal(blackened.evidence.coating, 'published');
  assert.equal(nickel.material, 'brass');
  assert.equal(nickel.coating, 'nickel-plated');
  assert.equal(brass.material, 'brass');
  assert.equal(brass.coating, 'unspecified');
  assert.equal(brass.evidence.coating, 'unpublished');
  assert.equal(brass.preset.catalog!.attributes!.coating, undefined);
  const filtered = filterStandoffs(entries, {
    values: { supplier: 'Kosmodrom', coating: 'blackened' },
  }).items;
  assert.ok(
    filtered.includes(blackened) && !filtered.includes(nickel) && !filtered.includes(brass),
  );
  assert.ok(filtered.every((row) => row.coating === 'blackened'));
  assert.equal(entry('dremec-113x5').coating, 'nickel-plated');
  assert.equal(entry('dremec-dh-steel').coating, 'zinc-plated');
  assert.equal(entry('dremec-dh-brass').coating, 'nickel-plated');
  assert.equal(entry('dremec-dh-aluminium').coating, 'self-finish');
  assert.equal(entry('dremec-dh-steel').evidence.coating, 'published');
  assert.equal(entry('pcb').coating, 'unspecified');
  assert.equal(standoffFacetLabel('coating', 'blackened'), 'Blackened');
  assert.ok(standoffFilterFields.some((field) => field.key === 'coating'));
});

test('numeric filters parse comma decimals strictly and reject malformed, nonfinite or reversed intervals', () => {
  assert.deepEqual(
    ids({ bodyWidth: { min: '5,5', max: '5,5' } }),
    ids({ bodyWidth: { min: 5.5, max: 5.5 } }),
  );
  assert.ok(ids({ bodyWidth: { min: '5,5', max: '5,5' } }).length > 0);
  assert.deepEqual(
    ids({ bodyLength: { min: '1e2', max: '1e2' } }),
    ids({ bodyLength: { min: 100, max: 100 } }),
  );
  for (const invalid of ['Infinity', 'NaN', '0x10', '1,2,3', '-1']) {
    const result = filterStandoffs(entries, { bodyLength: { min: invalid } });
    assert.equal(result.items.length, 0, invalid);
    assert.equal(result.errors.length, 1, invalid);
    assert.equal(result.errors[0].field, 'bodyLength');
  }
  assert.equal(filterStandoffs(entries, { bodyLength: { min: '11', max: '10' } }).errors.length, 1);
  assert.equal(
    filterStandoffs(entries, { bodyLength: { min: Number.POSITIVE_INFINITY } }).errors.length,
    1,
  );
  assert.equal(
    filterStandoffs(entries, { bodyLength: { min: ' ', max: '' } }).items.length,
    entries.length,
  );
});

test('custom sleeves match source intervals and produce valid requested dimensions without stock identity claims', () => {
  const filters: StandoffFilters = {
    values: { construction: 'custom-sleeve' },
    bodyLength: { min: 55, max: 55 },
    bodyWidth: { min: 8, max: 8 },
    bore: { min: 3, max: 3 },
  };
  const result = filterStandoffs(entries, filters);
  assert.equal(result.items.length, 4);
  for (const row of result.items) {
    assert.deepEqual(row.ranges.bodyLength, { min: 1, max: 60 });
    assert.deepEqual(row.ranges.bodyWidth, { min: 4, max: 36 });
    const suggestion = suggestedStandoffParameters(row, filters);
    assert.deepEqual(suggestion.errors, []);
    assert.equal(suggestion.parameters.length, 55);
    assert.equal(suggestion.parameters.outerDiameter, 8);
    assert.equal(suggestion.parameters.bore, 3);
    assert.equal(row.preset.parameters.length, 10);
    assert.equal(suggestion.parameters.material, row.preset.parameters.material);
    assert.match(row.notes.join(' '), /no stock SKU/);
  }
  const custom = result.items[0];
  assert.equal(custom.evidence.bodyLength, 'design');
  const interval = suggestedStandoffParameters(custom, {
    bodyLength: { min: 7, max: 15 },
    bodyWidth: { min: 6, max: 10 },
  });
  assert.equal(interval.parameters.length, 10);
  assert.equal(interval.parameters.outerDiameter, 6);
  assert.deepEqual(interval.errors, []);
  const invalid = suggestedStandoffParameters(custom, {
    bodyWidth: { min: 4, max: 4 },
    bore: { min: 5, max: 5 },
  });
  assert.ok(invalid.errors.length > 0);
  assert.equal(
    filterStandoffs(entries, { ...filters, bodyLength: { min: 61, max: 61 } }).items.length,
    0,
  );
  assert.equal(
    filterStandoffs(entries, {
      values: { construction: 'custom-sleeve' },
      query: '10',
      bodyLength: { min: 20, max: 20 },
    }).items.length,
    0,
  );
  assert.equal(
    filterStandoffs(entries, { values: { construction: 'custom-sleeve' }, query: '55' }).items
      .length,
    4,
  );
  assert.equal(suggestedStandoffParameters(custom, { query: '55' }).parameters.length, 55);
});

test('plain design examples stay fixed in normal browse and become editable only through explicit design selection', () => {
  const plain = entry('pcb');
  assert.ok(!filterStandoffs(entries, { bodyLength: { min: 17, max: 17 } }).items.includes(plain));
  assert.equal(
    suggestedStandoffParameters(plain, { bodyLength: { min: 17, max: 17 } }).parameters.length,
    10,
  );
  const request: StandoffFilters = {
    values: { construction: 'plain-spacer' },
    bodyLength: { min: 17, max: 17 },
    bodyWidth: { min: 8, max: 8 },
    bore: { min: 3, max: 3 },
  };
  assert.equal(filterStandoffs(entries, request).items.length, 3);
  assert.deepEqual(suggestedStandoffParameters(plain, request), {
    parameters: { outerDiameter: 8, bore: 3, length: 17 },
    errors: [],
  });
  assert.deepEqual(plain.ranges, {});
  const fixed = entry('dremec-113x18');
  const original = { ...fixed.preset.parameters };
  assert.deepEqual(suggestedStandoffParameters(fixed, request).parameters, original);
  assert.deepEqual(fixed.preset.parameters, original);
});

test('changing a custom size filter creates a prospective configuration without claiming the preview already changed', () => {
  const custom = entry('dremec-dh-brass');
  const preview = { ...custom.preset.parameters };
  const candidate = suggestedStandoffParameters(custom, {
    bodyLength: { min: 55, max: 55 },
  }).parameters;
  assert.equal(preview.length, 10);
  assert.equal(candidate.length, 55);
  assert.equal(standoffConfigurationMatches(custom, candidate, preview), false);
  assert.equal(standoffConfigurationMatches(custom, candidate, { ...preview, length: 55 }), true);
  assert.equal(
    standoffConfigurationMatches(custom, candidate, { ...candidate, material: 'steel' }),
    false,
  );
  assert.deepEqual(preview, custom.preset.parameters);
  const fixed = entry('dremec-113x18');
  assert.equal(
    standoffConfigurationMatches(fixed, fixed.preset.parameters, {
      ...fixed.preset.parameters,
      outputAngle: 45,
    }),
    true,
  );
  assert.equal(
    standoffConfigurationMatches(fixed, fixed.preset.parameters, {
      ...fixed.preset.parameters,
      bodyLength: 17,
    }),
    false,
  );
});

test('an explicit customer template stays selected without a stock preset identity while new sizes remain prospective', () => {
  const custom = entry('dremec-dh-brass');
  const actual = suggestedStandoffParameters(custom, {
    bodyLength: { min: 55, max: 55 },
  }).parameters;
  const choice = captureStandoffTemplate(custom)!;
  const actualPresetId = matchingPresetId(sleeve, actual);
  assert.equal(actualPresetId, 'custom');
  assert.equal(actual.length, 55);
  assert.equal(
    resolveStandoffPreviewEntry(entries, sleeve.id, actualPresetId, actual),
    undefined,
    'dimensions alone must not guess a template',
  );
  const selected = resolveStandoffPreviewEntry(entries, sleeve.id, actualPresetId, actual, choice);
  assert.strictEqual(selected, custom);
  assert.equal(standoffConfigurationMatches(selected!, actual, actual), true);
  const proposed = suggestedStandoffParameters(custom, {
    bodyLength: { min: 60, max: 60 },
  }).parameters;
  assert.equal(proposed.length, 60);
  assert.strictEqual(
    resolveStandoffPreviewEntry(entries, sleeve.id, actualPresetId, actual, choice),
    custom,
  );
  assert.strictEqual(
    resolveStandoffPreviewEntry(
      entries,
      sleeve.id,
      matchingPresetId(sleeve, proposed),
      proposed,
      choice,
    ),
    custom,
  );
  assert.equal(
    resolveStandoffPreviewEntry(entries, sleeve.id, '', actual, choice),
    undefined,
    'blank is not the app custom-selection contract',
  );
  assert.equal(standoffConfigurationMatches(custom, proposed, actual), false);
  assert.equal(standoffConfigurationMatches(custom, proposed, proposed), true);
  assert.equal(custom.preset.parameters.length, 10);
  assert.equal(
    custom.preset.parameters.catalogItem,
    undefined,
    'no fake catalogue identity is assigned to customer dimensions',
  );
});

test('custom template fallback rejects changed material, family or supplier evidence and real preset selection takes precedence', () => {
  const custom = entry('dremec-dh-brass');
  const choice = captureStandoffTemplate(custom)!;
  const actual = { ...custom.preset.parameters, length: 55 };
  const customId = matchingPresetId(sleeve, actual);
  assert.equal(
    resolveStandoffPreviewEntry(
      entries,
      sleeve.id,
      matchingPresetId(sleeve, { ...actual, material: 'steel' }),
      { ...actual, material: 'steel' },
      choice,
    ),
    undefined,
  );
  assert.equal(
    resolveStandoffPreviewEntry(
      entries,
      spacer.id,
      matchingPresetId(spacer, actual),
      actual,
      choice,
    ),
    undefined,
  );
  assert.equal(
    resolveStandoffPreviewEntry(entries, sleeve.id, 'missing-preset', actual, choice),
    undefined,
  );
  const differentSource = {
    ...custom,
    preset: {
      ...custom.preset,
      catalog: { ...custom.preset.catalog!, sourceUrl: 'https://example.com/different-source' },
    },
  };
  assert.equal(
    resolveStandoffPreviewEntry([differentSource], sleeve.id, customId, actual, choice),
    undefined,
  );
  const differentGrade = {
    ...custom,
    preset: {
      ...custom.preset,
      catalog: {
        ...custom.preset.catalog!,
        specifications: [{ label: 'Material grade', value: 'Different declared grade' }],
      },
    },
  };
  assert.equal(
    resolveStandoffPreviewEntry([differentGrade], sleeve.id, customId, actual, choice),
    undefined,
  );
  const fixed = entry('dremec-113x18');
  assert.equal(captureStandoffTemplate(fixed), undefined);
  assert.strictEqual(
    resolveStandoffPreviewEntry(
      entries,
      fixed.part.id,
      fixed.preset.id,
      fixed.preset.parameters,
      choice,
    ),
    fixed,
  );
  const steel = entry('dremec-dh-steel');
  assert.strictEqual(
    resolveStandoffPreviewEntry(
      entries,
      sleeve.id,
      steel.preset.id,
      steel.preset.parameters,
      choice,
    ),
    steel,
  );
});
