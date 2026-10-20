import assert from 'node:assert/strict';
import test from 'node:test';
import { translateSearchQuery } from '../src/core/search-query';
import {
  buildPresetIndex,
  compilePresetQuery,
  emptyPresetFilters,
  filterPresets,
} from '../src/core/preset-search';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { groupBrowseFamilies } from '../src/core/browse-families';
import panelSwitch from '../src/parts/panel-switch/part';
import terminal from '../src/parts/laboratory-terminal/part';
import connector from '../src/parts/signal-connector/part';

const vocabulary: [string, string][] = [
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0438', 'toggle'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447', 'switch'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447\u0456', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447\u0456', 'switch'],
  ['\u043a\u043d\u043e\u043f\u043a\u0430', 'button'],
  ['\u043a\u043d\u043e\u043f\u043a\u0438', 'button'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043e\u043a', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u043e\u043c', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430\u043c\u0438', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0438\u0439', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0438\u043c', 'guard'],
  ['\u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043d\u0438\u0439', 'rotary'],
  ['\u043a\u043b\u0430\u0432\u0456\u0448\u043d\u0438\u0439', 'rocker'],
];
const switchIndex = buildPresetIndex([panelSwitch]);
const libraryIndex = buildLibrarySearchIndex(
  groupBrowseFamilies([panelSwitch, terminal, connector]),
);

test('Ukrainian switch query vocabulary recognizes whole-word inflections without changing labels', () => {
  for (const [word, term] of vocabulary) {
    assert.equal(translateSearchQuery(word), term);
    assert.deepEqual(compilePresetQuery(word).tokens, [term]);
    assert.ok(
      searchLibrary(libraryIndex, word).some((match) => match.family.id === panelSwitch.id),
      term,
    );
  }
  assert.equal(translateSearchQuery('\u041a\u041d\u041e\u041f\u041a\u0410'), 'button');
});

test('guarded toggle phrases find the family and filter its actual guarded article while preserving typed text', () => {
  for (const query of [
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440 \u0437 \u0437\u0430\u0445\u0438\u0441\u0442\u043d\u0438\u043c\u0438 \u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430\u043c\u0438',
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0438 \u0456\u0437 \u0437\u0430\u0445\u0438\u0441\u0442\u043d\u0438\u043c\u0438 \u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430\u043c\u0438',
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440 \u0437 \u043a\u043e\u0432\u043f\u0430\u0447\u043a\u043e\u043c',
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440 \u0456\u0437 \u0437\u0430\u0445\u0438\u0441\u043d\u0438\u043c \u043a\u043e\u0432\u043f\u0430\u0447\u043a\u043e\u043c',
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0438 \u0437\u0456 \u0437\u0430\u0445\u0438\u0441\u043d\u0438\u043c\u0438 \u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430\u043c\u0438',
    '\u0442\u0443\u043c\u0431\u043b\u0435\u0440 \u0442\u0430 \u043a\u043e\u0432\u043f\u0430\u0447\u043e\u043a',
  ]) {
    assert.equal(translateSearchQuery(query), 'toggle guard');
    const match = searchLibrary(libraryIndex, query).find(
      (match) => match.family.id === panelSwitch.id,
    );
    assert.ok(match);
    assert.equal(match.articleQuery, query);
    const articles = filterPresets(switchIndex, {
      ...emptyPresetFilters(panelSwitch),
      query: match.articleQuery,
    });
    assert.equal(articles.errors.length, 0);
    assert.deepEqual(
      articles.items.map((entry) => entry.preset.id).sort(),
      panelSwitch.presets
        .filter((preset) => preset.catalog?.attributes?.guarded === true)
        .map((preset) => preset.id)
        .sort(),
    );
    assert.ok(articles.items.some((entry) => entry.preset.id === 'apem-12146ak-90c46'));
  }
});

test('generic localized switch names include every switch execution', () => {
  for (const query of [
    '\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447\u0456',
    '\u0432\u0438\u043c\u0438\u043a\u0430\u0447\u0456',
  ]) {
    const articles = filterPresets(switchIndex, { ...emptyPresetFilters(panelSwitch), query });
    assert.deepEqual(
      articles.items.map((entry) => entry.preset.id).sort(),
      panelSwitch.presets.map((preset) => preset.id).sort(),
    );
  }
});

test('localized actuator words filter individual supplier articles rather than their shared family label', () => {
  for (const [query, actuation] of [
    ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440', 'toggle'],
    ['\u043a\u043d\u043e\u043f\u043a\u0430', 'button'],
    ['\u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043d\u0438\u0439', 'rotary'],
    ['\u043a\u043b\u0430\u0432\u0456\u0448\u043d\u0438\u0439', 'rocker'],
  ] as const) {
    const articles = filterPresets(switchIndex, { ...emptyPresetFilters(panelSwitch), query });
    assert.ok(articles.items.length > 0);
    assert.ok(
      articles.items.every((entry) =>
        String(entry.preset.catalog!.attributes!.actuation).toLowerCase().includes(actuation),
      ),
    );
  }
});

test('unknown terms, unrecognized linking words, supplier SKUs and metric queries retain their exact text', () => {
  for (const query of [
    'BUTTONS-123',
    'TOGGLES.90C46',
    'buttons_2',
    'rockers24',
    '\u0456\u0437 \u0437\u0456 \u0437 \u0442\u0430',
    '\u043d\u0435\u0432\u0456\u0434\u043e\u043c\u0438\u0439 \u0437\u0430\u043f\u0438\u0442',
    '  USB-C 16pin  ',
    'A\u0442\u0443\u043c\u0431\u043b\u0435\u0440123',
    '12146AK-90C46',
    'M3 \u00d7 10',
  ])
    assert.equal(translateSearchQuery(query), query);
  for (const query of [
    '90C46',
    '7101SYZQE',
    'B3F-1000',
    'R1966ABLKBLKFF',
    'USB-C',
    'M3 × 10',
    'M3x10',
    '030-370-005',
  ]) {
    const compiled = compilePresetQuery(query);
    assert.equal(translateSearchQuery(query), query);
    if (query === 'M3 × 10' || query === 'M3x10') {
      assert.deepEqual(compiled, { tokens: [], metricSize: { diameter: 3, length: 10 } });
    } else assert.equal(compiled.tokens.length, 1);
  }
  const query = '\u0442\u0443\u043c\u0431\u043b\u0435\u0440 90C46';
  assert.equal(translateSearchQuery(query), 'toggle 90C46');
  assert.deepEqual(
    filterPresets(switchIndex, { ...emptyPresetFilters(panelSwitch), query }).items.map(
      (entry) => entry.preset.id,
    ),
    ['apem-12146ak-90c46'],
  );
});

test('fixed family labels remain navigable without contaminating article matches', () => {
  const familyOnly = {
    ...panelSwitch,
    name: 'Bench control selection',
    category: 'CONTROLS',
    subgroup: 'WORKBENCH',
    keywords: ['actuator collection'],
  };
  const articles = buildPresetIndex([familyOnly]);
  for (const query of ['bench control selection', 'workbench', 'actuator collection']) {
    assert.equal(
      filterPresets(articles, { ...emptyPresetFilters(familyOnly), query }).items.length,
      0,
    );
    const matches = searchLibrary(
      buildLibrarySearchIndex(groupBrowseFamilies([familyOnly])),
      query,
    );
    assert.deepEqual(
      matches.map((match) => [match.family.id, match.articleQuery]),
      [[panelSwitch.id, '']],
    );
  }
  const editable = { ...familyOnly, catalogSelectionOnly: false };
  assert.equal(
    filterPresets(buildPresetIndex([editable]), {
      ...emptyPresetFilters(editable),
      query: 'bench control selection',
    }).items.length,
    editable.presets.length,
  );
});

test('explicit English actuator plurals preserve query text and filter actual article types', () => {
  for (const [query, singular, actuation] of [
    ['buttons', 'button', 'button'],
    ['pushbuttons', 'pushbutton', 'pushbutton'],
    ['toggles', 'toggle', 'toggle'],
    ['rockers', 'rocker', 'rocker'],
    ['selectors', 'selector', 'selector'],
  ] as const) {
    assert.equal(translateSearchQuery(query), singular);
    const match = searchLibrary(libraryIndex, query).find(
      (match) => match.family.id === panelSwitch.id,
    );
    assert.ok(match);
    assert.equal(match.articleQuery, query);
    const articles = filterPresets(switchIndex, {
      ...emptyPresetFilters(panelSwitch),
      query: match.articleQuery,
    });
    assert.ok(articles.items.length > 0);
    assert.ok(articles.items.length < panelSwitch.presets.length);
    assert.ok(
      articles.items.every((entry) =>
        String(entry.preset.catalog!.attributes!.actuation).toLowerCase().includes(actuation),
      ),
    );
  }
  assert.equal(translateSearchQuery('switches'), 'switch');
  assert.equal(
    filterPresets(switchIndex, { ...emptyPresetFilters(panelSwitch), query: 'switches' }).items
      .length,
    panelSwitch.presets.length,
  );
});
