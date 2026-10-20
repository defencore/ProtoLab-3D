import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { parts } from '../src/parts';
import type { ParameterDefinition, PartDefinition, Preset } from '../src/core/types';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  formatPresetRange,
  getPresetParameterRange,
  getFilterFields,
  seedCurrentFilters,
  compilePresetQuery,
  presetFacetOptions,
  matchesPresetPartScope,
} from '../src/core/preset-search';

const bevel = parts.find((part) => part.id === 'bevel-gear-pair')!;

const bore: ParameterDefinition = {
  key: 'bore',
  label: 'Bore diameter',
  type: 'number',
  group: 'Size',
  unit: 'mm',
};
const width: ParameterDefinition = {
  key: 'width',
  label: 'Width',
  type: 'number',
  group: 'Size',
  unit: 'mm',
};
const drive: ParameterDefinition = {
  key: 'drive',
  label: 'Drive',
  type: 'select',
  group: 'Shape',
  options: [
    { value: 'hex', label: 'Hexagonal' },
    { value: 'slot', label: 'Slotted' },
  ],
};
const sealed: ParameterDefinition = {
  key: 'sealed',
  label: 'Sealed',
  type: 'boolean',
  group: 'Shape',
};
const source = {
  designation: '6204-2RS',
  manufacturer: 'SKF',
  standard: 'ISO 15',
  sourceName: 'Supplier One',
  sourceUrl: 'https://example.com/6204',
  verifiedParameters: ['bore', 'width'],
};

function part(id: string, parameters: ParameterDefinition[], presets: Preset[]): PartDefinition {
  return {
    id,
    name: id === 'ball' ? 'Deep groove ball bearing' : id,
    category: 'BEARINGS',
    subgroup: 'BALL BEARINGS',
    description: '',
    product: {
      kind: 'detail',
      supply: 'manufactured',
      description: 'Manufactured test fixture.',
      processes: ['milling'],
      releaseRequirements: ['Review the configured fixture drawing.'],
    },
    keywords: ['radial'],
    icon: 'bearing',
    complexity: 'Simple',
    parameters,
    defaults: { bore: 20, width: 14, drive: 'hex', sealed: true, balls: 7 },
    presets,
    validate: () => [],
    buildGeometry: () => new Group(),
    python: () => '',
    dimensions: () => [1, 1, 1],
  };
}

const ball = part(
  'ball',
  [
    bore,
    width,
    drive,
    sealed,
    { key: 'balls', label: 'Ball count', type: 'number', unit: '', group: 'Internal' },
  ],
  [
    {
      id: 'a',
      name: '6204 2RS',
      description: '20 × 47 × 14 mm',
      parameters: { bore: 20, width: 14, drive: 'hex', sealed: true, balls: 7 },
      catalog: source,
    },
    {
      id: 'b',
      name: 'Zero clearance example',
      description: '',
      parameters: { bore: 0, width: 0.3, drive: 'slot', sealed: false },
    },
    {
      id: 'c',
      name: '6204 decimal example',
      description: '',
      parameters: { bore: 0.1 + 0.2, width: 14, drive: 'hex', sealed: false },
    },
  ],
);
const roller = part(
  'roller',
  [bore, width],
  [
    {
      id: 'a',
      name: 'Roller 20',
      description: '',
      parameters: { bore: 20, width: 16 },
      catalog: { ...source, designation: 'NU204', manufacturer: 'NSK', sourceName: 'Supplier Two' },
    },
  ],
);
const index = buildPresetIndex([ball, roller]);
const boreId = fieldId(bore);
const widthId = fieldId(width);

test('a supplier code cannot match fragments from different SKUs', () => {
  const base = ball.presets[0];
  const indexed = buildPresetIndex([
    part(
      'stock',
      [bore, width],
      [
        { ...base, id: 'exact', catalog: { ...source, productCodes: ['030-370-005'] } },
        {
          ...base,
          id: 'fragments',
          catalog: { ...source, productCodes: ['030-370-006', '040-370-005'] },
        },
      ],
    ),
  ]);
  const filters = { ...emptyPresetFilters(), query: '030-370-005' };
  assert.deepEqual(
    filterPresets(indexed, filters).items.map((entry) => entry.preset.id),
    ['exact'],
  );
  assert.equal(filterPresets(indexed, { ...filters, query: '030-370-999' }).items.length, 0);
});

test('ranges are inclusive, allow either open end and honor zero bounds', () => {
  let filters = emptyPresetFilters();
  filters.parameters[boreId] = { min: '20', max: '20' };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.id),
    ['ball:a', 'roller:a'],
  );
  filters.parameters[boreId] = { max: '0' };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.id),
    ['ball:b'],
  );
  filters.parameters[boreId] = { min: '0', max: '' };
  assert.equal(filterPresets(index, filters).items.length, 4);
  filters.parameters[boreId] = { min: '', max: '   ' };
  assert.equal(filterPresets(index, filters).items.length, 4);
});

test('decimal equality tolerates floating point arithmetic but not materially different dimensions', () => {
  const filters = emptyPresetFilters();
  filters.parameters[boreId] = { min: '0.3', max: '0.3' };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.id),
    ['ball:c'],
  );
  filters.parameters[boreId] = { min: '0.3001', max: '0.3001' };
  assert.equal(filterPresets(index, filters).items.length, 0);
});

test('invalid and reversed ranges produce errors instead of silently ignoring constraints', () => {
  for (const range of [{ min: '30', max: '10' }, { min: 'Infinity' }, { max: 'not a number' }]) {
    const filters = emptyPresetFilters();
    filters.parameters[boreId] = range;
    const result = filterPresets(index, filters);
    assert.equal(result.items.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].fieldId, boreId);
  }
});

test('designation, manufacturer, source, standard and part terminology are searchable together', () => {
  for (const query of [
    '6204-2RS skf',
    '62042rs',
    'ISO 15',
    'supplier one radial',
    'HEXAGONAL SKF',
  ]) {
    const result = filterPresets(index, { ...emptyPresetFilters(), query });
    assert.equal(result.items[0]?.id, 'ball:a');
  }
  assert.equal(
    filterPresets(index, { ...emptyPresetFilters(), query: 'no-such-designation' }).items.length,
    0,
  );
});

test('category, part, catalog kind, manufacturer and source constraints combine', () => {
  const filters = {
    ...emptyPresetFilters(),
    kind: 'catalog' as const,
    manufacturer: 'NSK',
    sourceName: 'Supplier Two',
  };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.id),
    ['roller:a'],
  );
  assert.equal(filterPresets(index, { ...filters, partId: 'ball' }).items.length, 0);
  assert.equal(filterPresets(index, { ...filters, category: 'FASTENERS' }).items.length, 0);
  assert.equal(filterPresets(index, { ...emptyPresetFilters(), kind: 'examples' }).items.length, 2);
});

test('numeric part keywords do not make every preset match a different product designation', () => {
  const withReferenceKeywords = { ...ball, keywords: ['608', '6204', 'radial', 'shaft'] };
  const keywordIndex = buildPresetIndex([withReferenceKeywords]);
  assert.equal(
    filterPresets(keywordIndex, { ...emptyPresetFilters(), query: '608' }).items.length,
    0,
  );
  assert.equal(
    filterPresets(keywordIndex, { ...emptyPresetFilters(), query: '6204' }).items.length,
    2,
  );
  assert.equal(
    filterPresets(keywordIndex, { ...emptyPresetFilters(), query: 'radial shaft' }).items.length,
    3,
  );
});

test('cross-type envelope filters require the same units and a matching schema key', () => {
  const inchPart = part(
    'inch',
    [{ ...bore, unit: 'in' }, width],
    [{ id: 'same-number', name: '', description: '', parameters: { bore: 20, width: 14 } }],
  );
  const otherPart = part(
    'unrelated',
    [{ ...bore, key: 'diameter' }, width],
    [{ id: 'other-key', name: '', description: '', parameters: { diameter: 20, width: 14 } }],
  );
  const filters = emptyPresetFilters();
  filters.parameters[boreId] = { min: '20', max: '20' };
  filters.parameters[widthId] = { min: '14', max: '16' };
  const result = filterPresets(buildPresetIndex([ball, roller, inchPart, otherPart]), filters);
  assert.deepEqual(
    result.items.map((entry) => entry.id),
    ['ball:a', 'roller:a'],
  );
  assert.equal(getFilterFields([ball, inchPart]).filter((field) => field.key === 'bore').length, 2);
});

test('catalog dimension matching excludes guessed internal geometry', () => {
  const filters = emptyPresetFilters(ball);
  filters.parameters[fieldId(ball.parameters[4])] = { min: '7', max: '7' };
  const result = filterPresets(index, filters);
  assert.ok(result.items.every((entry) => !entry.preset.catalog));
  filters.parameters = { [boreId]: { min: '20', max: '20' } };
  assert.equal(filterPresets(index, filters).items[0].preset.catalog?.designation, '6204-2RS');
});

test('categorical and boolean filters are exact and preserve false', () => {
  const filters = emptyPresetFilters();
  filters.parameters[fieldId(sealed)] = { value: 'false' };
  filters.parameters[fieldId(drive)] = { value: 'slot' };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.id),
    ['ball:b'],
  );
  const mistyped = part(
    'bad',
    [sealed, bore],
    [{ id: 'a', name: 'Bad boolean', description: '', parameters: { sealed: 'false', bore: 20 } }],
  );
  assert.equal(
    filterPresets(buildPresetIndex([mistyped]), {
      ...emptyPresetFilters(),
      parameters: { [fieldId(sealed)]: { value: 'false' } },
    }).items.length,
    0,
  );
});

test('current-parameter matching is opt-in and ignores hidden or invalid fields', () => {
  const configurable = {
    ...ball,
    presetMatchKeys: ['bore', 'sealed', 'balls'],
    parameters: ball.parameters.map((field) =>
      field.key === 'balls' ? { ...field, visibleWhen: () => false } : field,
    ),
  };
  const filters = seedCurrentFilters(configurable, { bore: 0, width: 14, sealed: false, balls: 7 });
  assert.equal(filters.partId, 'ball');
  assert.deepEqual(filters.parameters[boreId], { min: '0', max: '0' });
  assert.deepEqual(filters.parameters[fieldId(sealed)], { value: 'false' });
  assert.equal(Object.keys(filters.parameters).length, 2);
  assert.equal(
    seedCurrentFilters(configurable, { bore: NaN, sealed: true }).parameters[boreId],
    undefined,
  );
});

test('exact catalog matching skips assumed dimensions while custom matching preserves requested values', () => {
  const preset: Preset = {
    id: 'nominal-only',
    name: 'Nominal bore reference',
    description: 'Width is an editable prototype assumption.',
    parameters: { bore: 20, width: 14 },
    catalog: { ...source, verifiedParameters: ['bore'] },
  };
  const configurable = {
    ...part('reference', [bore, width], [preset]),
    defaults: { ...preset.parameters },
    presetMatchKeys: ['bore', 'width'],
  };
  for (const values of [preset.parameters, { ...preset.parameters }]) {
    const filters = seedCurrentFilters(configurable, values);
    assert.deepEqual(filters.parameters[boreId], { min: '20', max: '20' });
    assert.equal(filters.parameters[fieldId(width)], undefined);
    assert.equal(filterPresets(buildPresetIndex([configurable]), filters).items[0].preset, preset);
  }
  const custom = seedCurrentFilters(configurable, { ...preset.parameters, width: 16 });
  assert.deepEqual(custom.parameters[fieldId(width)], { min: '16', max: '16' });
  assert.equal(filterPresets(buildPresetIndex([configurable]), custom).items.length, 0);
});

test('a hidden conditional parameter never matches an inactive preset feature', () => {
  const socket: ParameterDefinition = {
    key: 'socketDepth',
    label: 'Socket depth',
    type: 'number',
    group: 'Drive',
    visibleWhen: (parameters) => parameters.drive === 'hex',
  };
  const conditional = part(
    'conditional',
    [drive, socket],
    [{ id: 'a', name: '', description: '', parameters: { drive: 'slot', socketDepth: 3 } }],
  );
  const filters = emptyPresetFilters();
  filters.parameters[fieldId(socket)] = { min: '3', max: '3' };
  assert.equal(filterPresets(buildPresetIndex([conditional]), filters).items.length, 0);
});

test('source size intervals match inclusive overlap without asserting that the chosen preset value is sourced', () => {
  const ranged = part(
    'ranged',
    [bore, width],
    [
      {
        id: 'low',
        name: 'Small range',
        description: '',
        parameters: { bore: 6, width: 14 },
        catalog: {
          ...source,
          verifiedParameters: ['width'],
          parameterRanges: { bore: { min: 6, max: 8 } },
        },
      },
      {
        id: 'high',
        name: 'Large range',
        description: '',
        parameters: { bore: 10, width: 14 },
        catalog: {
          ...source,
          verifiedParameters: ['width'],
          parameterRanges: { bore: { min: 10, max: 12 } },
        },
      },
      {
        id: 'scalar',
        name: 'Fixed eight',
        description: '',
        parameters: { bore: 8, width: 14 },
        catalog: source,
      },
      {
        id: 'example',
        name: 'Prototype nine',
        description: '',
        parameters: { bore: 9, width: 14 },
      },
    ],
  );
  const rangedIndex = buildPresetIndex([ranged]);
  const matches = (range: { min?: string; max?: string }) =>
    filterPresets(rangedIndex, {
      ...emptyPresetFilters(ranged),
      parameters: { [boreId]: range },
    }).items.map((entry) => entry.preset.id);
  assert.deepEqual(matches({ min: '7', max: '7' }), ['low']);
  assert.deepEqual(matches({ min: '6', max: '6' }), ['low']);
  assert.deepEqual(matches({ min: '8', max: '8' }), ['low', 'scalar']);
  assert.deepEqual(matches({ min: '7.5', max: '10.5' }), ['low', 'high', 'scalar', 'example']);
  assert.deepEqual(matches({ min: '8.1', max: '8.9' }), []);
  assert.deepEqual(matches({ min: '12.001' }), []);
  assert.deepEqual(matches({ max: '5.999' }), []);
  assert.deepEqual(matches({ max: '6' }), ['low']);
  assert.deepEqual(matches({ min: '12' }), ['high']);
  assert.equal(ranged.presets[0].parameters.bore, 6);
  assert.ok(!ranged.presets[0].catalog!.verifiedParameters.includes('bore'));
  assert.equal(
    formatPresetRange(bore, getPresetParameterRange(ranged.presets[0], 'bore')!),
    '6–8 mm',
  );
});

test('malformed source intervals cannot create matches even when a default scalar is inside the filter', () => {
  const broken = part(
    'broken-range',
    [bore],
    [
      {
        id: 'reversed',
        name: '',
        description: '',
        parameters: { bore: 7 },
        catalog: { ...source, parameterRanges: { bore: { min: 8, max: 6 } } },
      },
      {
        id: 'infinite',
        name: '',
        description: '',
        parameters: { bore: 7 },
        catalog: { ...source, parameterRanges: { bore: { min: 6, max: Infinity } } },
      },
      {
        id: 'nan',
        name: '',
        description: '',
        parameters: { bore: 7 },
        catalog: { ...source, parameterRanges: { bore: { min: NaN, max: 8 } } },
      },
    ],
  );
  assert.equal(
    filterPresets(buildPresetIndex([broken]), {
      ...emptyPresetFilters(broken),
      parameters: { [boreId]: { min: '7', max: '7' } },
    }).items.length,
    0,
  );
  for (const preset of broken.presets)
    assert.equal(getPresetParameterRange(preset, 'bore'), undefined);
});

test('bevel Match current accepts fitting bores throughout both sourced intervals and rejects either bore outside', () => {
  const bevelIndex = buildPresetIndex([bevel]);
  for (const preset of bevel.presets.filter((item) => item.catalog?.parameterRanges)) {
    const ranges = preset.catalog!.parameterRanges!;
    for (const position of [0, 0.5, 1]) {
      const parameters = {
        ...preset.parameters,
        pinionBore:
          ranges.pinionBore.min + position * (ranges.pinionBore.max - ranges.pinionBore.min),
        wheelBore: ranges.wheelBore.min + position * (ranges.wheelBore.max - ranges.wheelBore.min),
      };
      const filters = seedCurrentFilters(bevel, parameters);
      const result = filterPresets(bevelIndex, filters);
      assert.deepEqual(result.errors, []);
      assert.ok(
        result.items.some((entry) => entry.preset.id === preset.id),
        `${preset.id}: ${position}`,
      );
    }
    for (const key of ['pinionBore', 'wheelBore']) {
      assert.ok(!preset.catalog!.verifiedParameters.includes(key));
      for (const value of [ranges[key].min - 0.001, ranges[key].max + 0.001]) {
        const result = filterPresets(
          bevelIndex,
          seedCurrentFilters(bevel, { ...preset.parameters, [key]: value }),
        );
        assert.ok(
          !result.items.some((entry) => entry.preset.id === preset.id),
          `${preset.id}: ${key} ${value}`,
        );
      }
    }
  }
});

test('bevel stock bore searches match exact combinations and source keyway widths, not intermediate bores or prototype depth', () => {
  const bevelIndex = buildPresetIndex([bevel]);
  const stockPrefix = 'reference-bevel-m2-15-30-bore-';
  const stockPresets = bevel.presets.filter((preset) => preset.id.startsWith(stockPrefix));
  assert.equal(stockPresets.length, 25);
  for (const preset of stockPresets) {
    const result = filterPresets(bevelIndex, seedCurrentFilters(bevel, preset.parameters));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(
      result.items
        .filter((entry) => entry.preset.id.startsWith(stockPrefix))
        .map((entry) => entry.preset.id),
      [preset.id],
    );
    for (const key of ['pinionBore', 'wheelBore']) {
      const intermediate = { ...preset.parameters, [key]: Number(preset.parameters[key]) + 0.5 };
      const customResult = filterPresets(bevelIndex, seedCurrentFilters(bevel, intermediate));
      assert.deepEqual(customResult.errors, []);
      assert.ok(!customResult.items.some((entry) => entry.preset.id.startsWith(stockPrefix)));
    }
  }

  const keyWidthField = bevel.parameters.find((field) => field.key === 'wheelBoreKeyWidth')!;
  for (const [width, count] of [
    [5, 15],
    [6, 10],
  ]) {
    const filters = emptyPresetFilters(bevel);
    filters.parameters[fieldId(keyWidthField)] = { min: String(width), max: String(width) };
    const result = filterPresets(bevelIndex, filters);
    assert.deepEqual(result.errors, []);
    assert.equal(result.items.length, count);
    assert.ok(result.items.every((entry) => entry.preset.parameters.wheelBoreKeyWidth === width));
  }

  const keyDepthField = bevel.parameters.find((field) => field.key === 'wheelBoreKeyDepth')!;
  const depthFilters = emptyPresetFilters(bevel);
  depthFilters.parameters[fieldId(keyDepthField)] = { min: '2', max: '2' };
  assert.deepEqual(filterPresets(bevelIndex, depthFilters).items, []);
});

test('metric size queries join whitespace and multiplication signs without matching numbers from unrelated supplier codes', () => {
  const bolt = parts.find((part) => part.id === 'bolt-screw')!;
  const index = buildPresetIndex([bolt]);
  const diameter = fieldId(bolt.parameters.find((field) => field.key === 'diameter')!);
  const length = fieldId(bolt.parameters.find((field) => field.key === 'length')!);
  const expected = filterPresets(index, {
    ...emptyPresetFilters(bolt),
    parameters: { [diameter]: { min: '8', max: '8' }, [length]: { min: '30', max: '30' } },
  }).items.map((item) => item.id);
  assert.equal(expected.length, 14);
  for (const query of ['M8 × 30', '  M8   x  30  ', 'M8×30', 'M8x30', 'M8 30']) {
    assert.deepEqual(compilePresetQuery(query).metricSize, { diameter: 8, length: 30 });
    assert.deepEqual(
      filterPresets(index, { ...emptyPresetFilters(bolt), query }).items.map((item) => item.id),
      expected,
      query,
    );
  }
  const comma = filterPresets(index, { ...emptyPresetFilters(bolt), query: 'M2,5 × 10' });
  assert.equal(comma.items.length, 6);
  assert.ok(
    comma.items.every(
      (item) => item.preset.parameters.diameter === 2.5 && item.preset.parameters.length === 10,
    ),
  );
  assert.equal(
    filterPresets(index, { ...emptyPresetFilters(bolt), query: '030361001' }).items[0].preset.id,
    'gvyntok-030-361-001',
  );
});

test('decimal-comma source intervals work without an assumed chosen scalar and invalid control payloads never become unfiltered results', () => {
  const ranged = {
    ...part(
      'range-only',
      [width],
      [
        {
          id: 'offered',
          name: '',
          description: '',
          parameters: {},
          catalog: {
            ...source,
            verifiedParameters: [],
            parameterRanges: { width: { min: 2, max: 3 } },
          },
        },
      ],
    ),
    defaults: {},
  };
  const index = buildPresetIndex([ranged]);
  const result = filterPresets(index, {
    ...emptyPresetFilters(ranged),
    parameters: { [widthId]: { min: '2,5', max: '2.5' } },
  });
  assert.deepEqual(
    result.items.map((item) => item.preset.id),
    ['offered'],
  );
  for (const parameters of [{ [widthId]: { value: '2.5' } }, { [fieldId(drive)]: { min: '1' } }])
    assert.ok(
      filterPresets(buildPresetIndex([ball]), { ...emptyPresetFilters(ball), parameters }).errors
        .length,
    );
});

test('selected scope reports unavailable active fields and unpublished categorical source assumptions cannot satisfy a filter', () => {
  const scoped = filterPresets(index, {
    ...emptyPresetFilters(roller),
    parameters: { [fieldId(ball.parameters[4])]: { min: '7' } },
  });
  assert.equal(scoped.items.length, 0);
  assert.equal(scoped.errors.length, 1);
  const guessed = filterPresets(index, {
    ...emptyPresetFilters(ball),
    parameters: { [fieldId(sealed)]: { value: 'true' } },
  });
  assert.equal(guessed.items.length, 0);
});

test('advanced facets preserve query, dimensions and an unavailable own selection with exact contextual counts', () => {
  const bolt = parts.find((part) => part.id === 'bolt-screw')!;
  const index = buildPresetIndex([bolt]);
  const field = getFilterFields([bolt]).find((field) => field.key === 'head')!;
  const filters = {
    ...emptyPresetFilters(bolt),
    query: 'M8 × 30',
    parameters: { [field.id]: { value: 'retired-head' } },
  };
  const options = presetFacetOptions(index, filters, field);
  assert.equal(options.find((option) => option.value === 'retired-head')!.count, 0);
  assert.equal(
    options.reduce((count, option) => count + option.count, 0),
    14,
  );
  assert.equal(filters.parameters[field.id].value, 'retired-head');
});

test('a browse-family scope keeps all four standoff product types under one selector without changing physical identities', () => {
  const members = parts.filter((part) => part.browseFamily?.id === 'spacers-standoffs');
  assert.equal(members.length, 4);
  assert.ok(members.every((part) => part.browseFamily!.label === 'Spacers & standoffs'));
  const index = buildPresetIndex(members);
  const filters = emptyPresetFilters(members[0]);
  assert.equal(filters.partId, 'spacers-standoffs');
  const result = filterPresets(index, filters);
  assert.deepEqual(result.errors, []);
  assert.equal(result.items.length, 4451);
  assert.deepEqual(
    new Set(result.items.map((item) => item.part.id)),
    new Set(members.map((part) => part.id)),
  );
  for (const part of members) {
    assert.equal(matchesPresetPartScope(part, filters.partId), true);
    assert.equal(matchesPresetPartScope(part, part.id), true);
    assert.equal(matchesPresetPartScope(part, 'bolt-screw'), false);
    const physical = filterPresets(index, { ...filters, partId: part.id });
    assert.equal(physical.items.length, part.presets.length);
    assert.ok(physical.items.every((entry) => entry.part.id === part.id));
  }
});
