import assert from 'node:assert/strict';
import test from 'node:test';
import panelSwitch from '../src/parts/panel-switch/part';
import terminal from '../src/parts/laboratory-terminal/part';
import connector from '../src/parts/signal-connector/part';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { groupBrowseFamilies } from '../src/core/browse-families';
import type { PartDefinition } from '../src/core/types';

const search = (part: PartDefinition, query: string) =>
  filterPresets(buildPresetIndex([part]), { ...emptyPresetFilters(part), query }).items;

test('fixed switch articles match their own actuator and manufacturer rather than every family keyword', () => {
  const guards = search(panelSwitch, 'guard');
  assert.equal(guards.length, 2);
  assert.ok(guards.every((entry) => entry.preset.catalog!.attributes!.guarded === true));
  assert.deepEqual(
    new Set(guards.map((entry) => entry.preset.id)),
    new Set(['apem-12146ak-90c46', 'daier-asw-07d-sac-01']),
  );
  const rockers = search(panelSwitch, 'rocker');
  assert.equal(rockers.length, 3);
  assert.ok(rockers.every((entry) => entry.preset.catalog!.attributes!.actuation === 'Rocker'));
  const omron = search(panelSwitch, 'Omron');
  assert.equal(omron.length, 4);
  assert.ok(omron.every((entry) => entry.preset.catalog!.manufacturer === 'Omron'));
  assert.equal(search(panelSwitch, '90C46').length, 1);
});

test('banana article search excludes unrelated wire clamps and speaker terminals', () => {
  const matches = search(terminal, 'banana');
  assert.equal(matches.length, 8);
  assert.ok(matches.length < terminal.presets.length);
  assert.ok(
    matches.every((entry) =>
      String(entry.preset.catalog!.attributes!.connection).includes('banana'),
    ),
  );
  assert.ok(matches.some((entry) => entry.preset.id === 'pomona-1325-2'));
  assert.ok(matches.some((entry) => entry.preset.id === 'cliff-spt1'));
  assert.ok(
    !matches.some(
      (entry) => entry.preset.id.startsWith('wago-') || entry.preset.id.startsWith('phoenix-'),
    ),
  );
});

test('USB article search returns USB interfaces and excludes JST headers', () => {
  const matches = search(connector, 'USB');
  assert.equal(matches.length, 5);
  assert.ok(matches.every((entry) => entry.preset.catalog!.attributes!.family === 'USB'));
  assert.ok(!matches.some((entry) => /jst/i.test(entry.preset.name)));
  const jst = search(connector, 'JST');
  assert.ok(jst.length > 0);
  assert.ok(jst.every((entry) => entry.preset.catalog!.manufacturer === 'JST'));
});

test('family-only navigation keywords still find the family without imposing an article filter', () => {
  const family = { ...terminal, keywords: [...terminal.keywords, 'workbench fitting station'] };
  assert.equal(search(family, 'workbench fitting station').length, 0);
  const index = buildLibrarySearchIndex(groupBrowseFamilies([panelSwitch, family, connector]));
  assert.deepEqual(
    searchLibrary(index, 'workbench fitting station').map((match) => ({
      id: match.family.id,
      query: match.articleQuery,
    })),
    [{ id: terminal.id, query: '' }],
  );
  assert.deepEqual(
    searchLibrary(index, 'guard').map((match) => ({
      id: match.family.id,
      query: match.articleQuery,
    })),
    [{ id: panelSwitch.id, query: 'guard' }],
  );
});

test('editable geometry families retain shared descriptive search terminology', () => {
  const editable = {
    ...panelSwitch,
    id: 'editable-panel-control',
    catalogSelectionOnly: false,
    keywords: ['workbench control'],
  };
  assert.equal(search(editable, 'workbench control').length, editable.presets.length);
  assert.equal(search(panelSwitch, 'workbench control').length, 0);
});
