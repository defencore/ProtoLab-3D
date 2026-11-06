import assert from 'node:assert/strict';
import test from 'node:test';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex } from '../src/core/library-search';
import {
  buildDiscoveryIndex,
  discoveryChoices,
  discoveryFamilyMatches,
  discoverySuggestions,
  emptyDiscoveryFilters,
  filterDiscoveryCandidates,
  hasDiscoveryFilters,
  parseDiscoveryQuery,
} from '../src/core/library-discovery';
import type { DiscoveryCandidate, DiscoveryFilters } from '../src/core/discovery-types';
import type { PartDefinition } from '../src/core/types';
import { parts } from '../src/parts';

const base = parts.find((part) => part.id === 'worm-fin-actuator')!;
const records = [
  { model: 'a', power: 12, bearing: 'F686-2RS', width: 60 },
  { model: 'b', power: 24, bearing: 'F695ZZ', width: 40 },
  { model: 'c', power: 12, bearing: 'F695ZZ', width: 20 },
];
const fixture: PartDefinition = {
  ...base,
  id: 'discovery-fixture',
  name: 'Fixture mechanism',
  description: 'A configurable fixture with documented component characteristics.',
  keywords: ['fixture'],
  defaults: { model: 'a' },
  parameters: [
    {
      key: 'model',
      label: 'Configuration',
      type: 'select',
      group: 'Model',
      options: [
        ...records.map(({ model }) => ({ value: model, label: `Configuration ${model}` })),
        { value: 'unknown', label: 'Unknown characteristics' },
      ],
    },
  ],
  presets: [
    ...records.map(({ model }) => ({
      id: model,
      name: `Configuration ${model}`,
      description: 'Configured fixture.',
      parameters: { model },
    })),
    {
      id: 'unknown',
      name: 'Unknown characteristics',
      description: 'Unpublished component values.',
      parameters: { model: 'unknown' },
    },
  ],
  discovery: records.flatMap(({ model, power, bearing, width }) => [
    {
      kind: 'power',
      key: 'supplyVoltage',
      label: 'Supply voltage',
      value: power,
      unit: 'V',
      when: { model },
    },
    {
      kind: 'bearing',
      key: 'outputBearing',
      label: 'Output bearing',
      value: bearing,
      when: { model },
    },
    {
      kind: 'width',
      key: 'bodyWidth',
      label: 'Body width',
      value: width,
      unit: 'mm',
      when: { model },
    },
  ]),
  composition() {
    assert.fail('Discovery must not construct a bill of materials while searching.');
  },
  dimensions() {
    assert.fail('Discovery must not build geometry to find a dimension.');
  },
  buildGeometry() {
    assert.fail('Discovery must not build geometry while searching.');
  },
};
const index = buildDiscoveryIndex(buildLibrarySearchIndex(groupBrowseFamilies([fixture])));
const ids = (candidates: readonly DiscoveryCandidate[]) =>
  candidates.map(({ preset }) => preset.id);
const number = (value: string) => Number(value.replace(',', '.'));
const filters = (changes: Partial<DiscoveryFilters> = {}): DiscoveryFilters => ({
  ...emptyDiscoveryFilters(),
  ...changes,
});

test('discovery intersects power, bearing and width inside one real preset without building geometry', () => {
  assert.deepEqual(ids(filterDiscoveryCandidates(index, '', filters())), [
    'a',
    'b',
    'c',
    'unknown',
  ]);
  assert.deepEqual(
    ids(
      filterDiscoveryCandidates(
        index,
        '',
        filters({
          power: '12 V',
          bearing: 'F686-2RS',
          width: { min: '60', max: '60' },
        }),
      ),
    ),
    ['a'],
  );
  assert.deepEqual(
    filterDiscoveryCandidates(
      index,
      '',
      filters({
        power: '12 V',
        bearing: 'F686-2RS',
        width: { min: '40', max: '40' },
      }),
    ),
    [],
  );
  assert.deepEqual(
    filterDiscoveryCandidates(index, '', filters({ power: '24 V', bearing: 'F686-2RS' })),
    [],
  );
  assert.deepEqual(filterDiscoveryCandidates(index, '24 V', filters({ power: '12 V' })), []);
  assert.deepEqual(ids(filterDiscoveryCandidates(index, '', filters({ bearing: 'F695ZZ' }))), [
    'b',
    'c',
  ]);
  assert.deepEqual(filterDiscoveryCandidates(index, '', filters({ power: '999 V' })), []);
  assert.equal(hasDiscoveryFilters(filters()), false);
  assert.equal(hasDiscoveryFilters(filters({ power: '12 V' })), true);
});

test('numeric discovery widths support decimal commas and inclusive open bounds, rejecting invalid requests', () => {
  assert.deepEqual(
    ids(filterDiscoveryCandidates(index, '', filters({ width: { min: '', max: '40' } }))),
    ['b', 'c'],
  );
  assert.deepEqual(
    ids(filterDiscoveryCandidates(index, '', filters({ width: { min: '20,0', max: '40.0' } }))),
    ['b', 'c'],
  );
  assert.deepEqual(
    ids(filterDiscoveryCandidates(index, '', filters({ width: { min: '60', max: '' } }))),
    ['a'],
  );
  for (const width of [
    { min: '60', max: '20' },
    { min: 'NaN', max: '' },
    { min: '', max: 'Infinity' },
  ])
    assert.deepEqual(
      filterDiscoveryCandidates(index, '', filters({ width })),
      [],
      JSON.stringify(width),
    );
});

test('width choices and meanings do not invent intermediate sizes or mix two component dimensions', () => {
  const stepped: DiscoveryCandidate = {
    ...index[0],
    traits: [
      {
        kind: 'width',
        key: 'bodyWidth',
        label: 'Body width',
        value: 10,
        unit: 'mm',
        choices: [10, 30],
        range: { min: 10, max: 30 },
      },
    ],
  };
  assert.deepEqual(
    filterDiscoveryCandidates([stepped], '', filters({ width: { min: '20', max: '20' } })),
    [],
  );
  assert.equal(
    filterDiscoveryCandidates([stepped], '', filters({ width: { min: '30', max: '30' } })).length,
    1,
  );
  const continuous: DiscoveryCandidate = {
    ...stepped,
    traits: [
      {
        kind: 'width',
        key: 'bodyWidth',
        label: 'Body width',
        value: 10,
        unit: 'mm',
        range: { min: 10, max: 30 },
      },
    ],
  };
  assert.deepEqual(
    filterDiscoveryCandidates(
      [continuous],
      'width 30',
      filters({ width: { min: '10', max: '10' } }),
    ),
    [],
    'a published width interval cannot satisfy contradictory exact requested widths',
  );
  const multiple: DiscoveryCandidate = {
    ...index[0],
    traits: [
      { kind: 'width', key: 'bodyWidth', label: 'Body width', value: 40, unit: 'mm' },
      { kind: 'width', key: 'boardWidth', label: 'PCB width', value: 60, unit: 'mm' },
    ],
  };
  const body = discoveryChoices([multiple], '', filters()).widthKind.find(({ label }) =>
    /body width/i.test(label),
  );
  assert.ok(body);
  assert.deepEqual(
    filterDiscoveryCandidates(
      [multiple],
      '',
      filters({
        widthKind: body.value,
        width: { min: '60', max: '60' },
      }),
    ),
    [],
  );
  assert.equal(
    filterDiscoveryCandidates([multiple], '', filters({ width: { min: '60', max: '60' } })).length,
    1,
  );
  const pcb = discoveryChoices([multiple], '', filters()).widthKind.find(({ label }) =>
    /PCB width/i.test(label),
  );
  assert.ok(pcb);
  assert.deepEqual(
    filterDiscoveryCandidates(
      [multiple],
      'width 40',
      filters({
        widthKind: pcb.value,
        width: { min: '60', max: '60' },
      }),
    ),
    [],
    'a selected width meaning also qualifies a width typed in the query',
  );
  assert.deepEqual(
    filterDiscoveryCandidates(
      [multiple],
      'width <= 40',
      filters({
        width: { min: '60', max: '60' },
      }),
    ),
    [],
    'query bounds and chosen bounds must describe the same width characteristic',
  );
});

test('explicit natural-language component queries become the same compatible constraints', () => {
  for (const query of [
    'supply 12 V bearing F686-2RS width 60',
    '\u0436\u0438\u0432\u043b\u0435\u043d\u043d\u044f 12 \u0412 \u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a F686-2RS \u0448\u0438\u0440\u0438\u043d\u0430 60',
  ]) {
    const parsed = parseDiscoveryQuery(query);
    assert.equal(parsed.power.replace(/\s/g, '').toUpperCase(), '12V', query);
    assert.equal(parsed.bearing.toUpperCase(), 'F686-2RS', query);
    assert.equal(number(parsed.width.min), 60, query);
    assert.equal(number(parsed.width.max), 60, query);
    assert.equal(parsed.hasConstraints, true);
    assert.deepEqual(ids(filterDiscoveryCandidates(index, query, filters())), ['a'], query);
  }
  const range = parseDiscoveryQuery('width 20\u201340');
  assert.equal(number(range.width.min), 20);
  assert.equal(number(range.width.max), 40);
  const maximum = parseDiscoveryQuery('width <= 40,0');
  assert.equal(maximum.width.min, '');
  assert.equal(number(maximum.width.max), 40);
  assert.deepEqual(
    filterDiscoveryCandidates(index, '12 V bearing F686-2RS width 40', filters()),
    [],
  );
});

test('facet counts include other active characteristics while preserving their own alternatives', () => {
  const choices = discoveryChoices(index, '', filters({ power: '12 V' }));
  assert.equal(choices.power.find(({ value }) => value === '12 V')?.count, 2);
  assert.equal(choices.power.find(({ value }) => value === '24 V')?.count, 1);
  assert.equal(choices.bearing.find(({ value }) => value === 'F686-2RS')?.count, 1);
  assert.equal(choices.bearing.find(({ value }) => value === 'F695ZZ')?.count, 1);
  const constrained = discoveryChoices(
    index,
    '',
    filters({
      power: '12 V',
      width: { min: '60', max: '60' },
    }),
  );
  assert.equal(constrained.bearing.find(({ value }) => value === 'F686-2RS')?.count, 1);
  assert.equal(constrained.bearing.find(({ value }) => value === 'F695ZZ')?.count ?? 0, 0);
});

test('partial component suggestions are selectable constraints and retain unrelated query text', () => {
  const before = JSON.stringify(filters({ power: '12 V' }));
  const chosenFilters = filters({ power: '12 V' });
  const suggestions = discoverySuggestions(index, 'fixture F68', chosenFilters);
  const bearing = suggestions.find(
    (suggestion) => suggestion.kind === 'bearing' && suggestion.filters.bearing === 'F686-2RS',
  );
  assert.ok(bearing, 'a partial bearing designation offers its actual model');
  assert.equal(bearing.count, 1);
  assert.match(bearing.query, /fixture/i);
  assert.doesNotMatch(bearing.query, /F68/i);
  assert.deepEqual(
    ids(
      filterDiscoveryCandidates(index, bearing.query, {
        ...chosenFilters,
        ...bearing.filters,
      }),
    ),
    ['a'],
  );
  assert.equal(
    JSON.stringify(chosenFilters),
    before,
    'suggesting does not change active constraints',
  );
  assert.ok(
    discoverySuggestions(index, '12', filters()).some((suggestion) => suggestion.kind === 'power'),
  );
});

test('an empty compatible set offers an explicit relaxation that preserves the other characteristics', () => {
  for (const scenario of [
    {
      query: '',
      selected: filters({ power: '12 V', bearing: 'F686-2RS', width: { min: '40', max: '40' } }),
    },
    { query: '12 V bearing F686-2RS width 40', selected: filters() },
  ]) {
    assert.deepEqual(filterDiscoveryCandidates(index, scenario.query, scenario.selected), []);
    const suggestions = discoverySuggestions(index, scenario.query, scenario.selected);
    const relax = suggestions.find(
      (suggestion) => suggestion.kind === 'width' && suggestion.label === 'Try without width',
    );
    assert.ok(relax);
    assert.equal(relax.count, 1);
    assert.deepEqual(relax.filters.width, { min: '', max: '' });
    assert.deepEqual(
      ids(
        filterDiscoveryCandidates(index, relax.query, {
          ...scenario.selected,
          ...relax.filters,
        }),
      ),
      ['a'],
    );
    if (scenario.query) {
      assert.match(relax.query, /12\s*V/);
      assert.match(relax.query, /F686-2RS/);
      assert.doesNotMatch(relax.query, /width/i);
    }
  }
});

test('unlabelled numeric completion offers distinguishable power and width choices', () => {
  const ambiguous: DiscoveryCandidate = {
    ...index[0],
    traits: [
      { kind: 'power', key: 'supplyVoltage', label: 'Supply voltage', value: 12, unit: 'V' },
      { kind: 'width', key: 'bodyWidth', label: 'Body width', value: 12, unit: 'mm' },
    ],
  };
  const suggestions = discoverySuggestions([ambiguous], '12', filters());
  assert.ok(
    suggestions.some(
      (suggestion) => suggestion.kind === 'power' && suggestion.label.includes('12'),
    ),
  );
  assert.ok(
    suggestions.some(
      (suggestion) => suggestion.kind === 'width' && /body width/i.test(suggestion.detail),
    ),
  );
  assert.ok(suggestions.every((suggestion) => suggestion.count === 1));
});

test('series-cell queries use published cell counts without converting them to assumed voltages', () => {
  const exact: DiscoveryCandidate = {
    ...index[0],
    traits: [{ kind: 'power', key: 'batteryCells', label: 'Series cells', value: 3, unit: 'S' }],
  };
  const supported: DiscoveryCandidate = {
    ...index[1],
    traits: [
      {
        kind: 'power',
        key: 'batteryCells',
        label: 'Supported series cells',
        value: '2–4',
        unit: 'S',
        range: { min: 2, max: 4 },
      },
    ],
  };
  assert.equal(filterDiscoveryCandidates([exact, supported], '3S', filters()).length, 2);
  assert.deepEqual(filterDiscoveryCandidates([exact, supported], '5S', filters()), []);
  assert.deepEqual(filterDiscoveryCandidates([exact, supported], '12 V', filters()), []);
});

test('matching configurations retain exact preset references and coalesce into generic family navigation', () => {
  const matches = filterDiscoveryCandidates(index, '', filters({ power: '12 V' }));
  const families = discoveryFamilyMatches(matches, '');
  assert.equal(families.length, 1);
  assert.equal(families[0].family.id, fixture.id);
  assert.strictEqual(matches[0].part, fixture);
  assert.strictEqual(matches[0].preset, fixture.presets[0]);
  assert.deepEqual(discoveryFamilyMatches([], ''), []);
});

test('source supply intervals and width meanings remain visible in actual servo configurations', () => {
  const servo = parts.find((part) => part.id === 'servo-motor')!;
  const servoIndex = buildDiscoveryIndex(buildLibrarySearchIndex(groupBrowseFamilies([servo])));
  const kst = filterDiscoveryCandidates(
    servoIndex,
    '',
    filters({
      power: '7.4 V',
      width: { min: '10', max: '10' },
    }),
  );
  assert.ok(kst.some(({ preset }) => /X10 Mini Pro/i.test(preset.name)));
  assert.ok(
    kst.every(({ traits }) =>
      traits.some((trait) => trait.kind === 'width' && /case width/i.test(trait.label)),
    ),
  );
  const st3215 = filterDiscoveryCandidates(
    servoIndex,
    'ST3215',
    filters({
      power: '12 V',
      width: { min: '24.72', max: '24.72' },
    }),
  );
  assert.ok(st3215.some(({ preset }) => /HS/i.test(preset.name)));
});

test('exploratory candidates cannot combine alternative screws or motor windings from a family title', () => {
  const mechanisms = parts.filter((part) => part.mechanismExecution);
  const mechanismIndex = buildDiscoveryIndex(
    buildLibrarySearchIndex(groupBrowseFamilies(mechanisms)),
  );
  for (const query of ['2838 3100KV', '2845 5700KV', 'TR8x2 four start', 'TR8x8 TR8x2'])
    assert.deepEqual(filterDiscoveryCandidates(mechanismIndex, query, filters()), [], query);
  assert.ok(filterDiscoveryCandidates(mechanismIndex, '2838 5700KV', filters()).length > 0);
  assert.ok(
    filterDiscoveryCandidates(mechanismIndex, 'TR8x8 bearing F686-2RS', filters()).length > 0,
  );
});

test('metric dimensions still require a real matching article instead of unrelated source numbers', () => {
  const bolt = parts.find((part) => part.id === 'bolt-screw')!;
  const selected = [
    bolt.presets.find(
      (preset) =>
        preset.catalog && preset.parameters.diameter === 2 && preset.parameters.length === 8,
    )!,
    bolt.presets.find(
      (preset) =>
        preset.catalog && preset.parameters.diameter === 4 && preset.parameters.length === 16,
    )!,
  ];
  assert.ok(selected.every(Boolean));
  const subset = { ...bolt, presets: selected, keywords: ['M2 16', ...bolt.keywords] };
  const boltIndex = buildDiscoveryIndex(buildLibrarySearchIndex(groupBrowseFamilies([subset])));
  assert.equal(filterDiscoveryCandidates(boltIndex, 'M2 8', filters()).length, 1);
  assert.equal(filterDiscoveryCandidates(boltIndex, 'M4 16', filters()).length, 1);
  assert.deepEqual(filterDiscoveryCandidates(boltIndex, 'M2 16', filters()), []);
});

test('a named but unfinished bearing keeps matching and completes before offering to remove it', () => {
  assert.deepEqual(ids(filterDiscoveryCandidates(index, 'fixture bearing F68', filters())), ['a']);
  const suggestions = discoverySuggestions(index, 'fixture bearing F68', filters());
  assert.equal(suggestions[0]?.label, 'F686-2RS');
  assert.ok(suggestions[0]?.query.includes('fixture'));
  assert.equal(suggestions[0]?.count, 1);
});

test('completion follows the unfinished characteristic while preserving earlier power constraints', () => {
  for (const query of [
    'fixture power 12 V bearing F68',
    'fixture power 12 V F68',
    '\u0436\u0438\u0432\u043b\u0435\u043d\u043d\u044f 12 \u0412 \u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a F68',
  ]) {
    const suggestions = discoverySuggestions(index, query, filters());
    assert.equal(suggestions[0]?.label, 'F686-2RS', query);
    assert.equal(suggestions[0]?.kind, 'bearing', query);
    assert.equal(suggestions[0]?.count, 1, query);
    assert.deepEqual(
      ids(
        filterDiscoveryCandidates(index, suggestions[0].query, {
          ...filters(),
          ...suggestions[0].filters,
        }),
      ),
      ['a'],
      query,
    );
  }
});
