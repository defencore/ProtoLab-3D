import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { groupBrowseFamilies } from '../src/core/browse-families';
import boltModule from '../src/parts/bolt-screw/index';
import pcb from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import sleeve from '../src/parts/dremec-spacer-sleeve/part';
import spacer from '../src/parts/spacer/part';

const bolt = boltModule.part;
const index = buildLibrarySearchIndex(groupBrowseFamilies([bolt, pcb, insert, sleeve, spacer]));

test('library navigation matches one real size before passing the query into the model chooser', () => {
  for (const query of ['M3 10', 'M3 × 10', 'M3x10']) {
    const matches = searchLibrary(index, query);
    assert.deepEqual(
      matches.map((match) => match.family.id),
      ['bolt-screw', 'spacers-standoffs'],
    );
    assert.ok(matches.every((match) => match.articleQuery === query));
  }
  assert.deepEqual(searchLibrary(index, 'M3 × 999999'), []);
  assert.equal(searchLibrary(index, '   ').length, 2);
  assert.ok(searchLibrary(index, '   ').every((match) => match.articleQuery === ''));
});

test('separate articles and numeric navigation keywords cannot jointly satisfy a requested metric size', () => {
  const m2 = bolt.presets.find(
    (preset) =>
      preset.catalog && preset.parameters.diameter === 2 && preset.parameters.length === 8,
  )!;
  const m4 = bolt.presets.find(
    (preset) =>
      preset.catalog && preset.parameters.diameter === 4 && preset.parameters.length === 16,
  )!;
  assert.ok(m2 && m4);
  const subset = { ...bolt, presets: [m2, m4], keywords: ['M2 16', ...bolt.keywords] };
  const restricted = buildLibrarySearchIndex(groupBrowseFamilies([subset]));
  assert.equal(searchLibrary(restricted, 'M2 8').length, 1);
  assert.equal(searchLibrary(restricted, 'M4 16').length, 1);
  assert.deepEqual(searchLibrary(restricted, 'M2 16'), []);
});

test('part-name and manufacturing navigation remains available without imposing those words as article filters', () => {
  const component = {
    ...bolt,
    id: 'custom-name',
    name: 'Unlisted design vocabulary',
    description: 'A searchable workshop fixture',
    keywords: ['fixture prototype'],
    presets: [],
  };
  const local = buildLibrarySearchIndex(groupBrowseFamilies([component]));
  assert.deepEqual(
    searchLibrary(local, 'workshop fixture').map((match) => ({
      id: match.family.id,
      query: match.articleQuery,
    })),
    [{ id: 'custom-name', query: '' }],
  );
  assert.deepEqual(
    searchLibrary(local, 'prototype fixture').map((match) => match.family.id),
    ['custom-name'],
  );
  assert.deepEqual(searchLibrary(local, 'no such component'), []);
});

test('coalesced standoffs keep exact body-size and construction semantics across physical packages', () => {
  assert.equal(
    searchLibrary(index, 'brass M3 10').find((match) => match.family.id === 'spacers-standoffs')!
      .articleQuery,
    'brass M3 10',
  );
  assert.equal(
    searchLibrary(index, 'metal insert').filter((match) => match.family.id === 'spacers-standoffs')
      .length,
    1,
  );
  assert.deepEqual(searchLibrary(index, 'M3 999999'), []);
  const grouped = searchLibrary(index, 'standoffs').find(
    (match) => match.family.id === 'spacers-standoffs',
  )!;
  assert.equal(grouped.family.members.length, 4);
  assert.strictEqual(grouped.family.primary, pcb);
});

test('direct family-name matches rank before references in descriptions or article metadata', () => {
  const definitions = [
    {
      ...bolt,
      id: 'indirect',
      name: 'Other fixture',
      description: 'Uses a drill guide',
      keywords: [],
      presets: [],
    },
    {
      ...bolt,
      id: 'direct',
      name: 'Drill guide',
      description: 'A workshop fixture',
      keywords: [],
      presets: [],
    },
    {
      ...bolt,
      id: 'prefix',
      name: 'Drill guide plate',
      description: 'A workshop fixture',
      keywords: [],
      presets: [],
    },
  ];
  const local = buildLibrarySearchIndex(groupBrowseFamilies(definitions));
  assert.deepEqual(
    searchLibrary(local, 'drill guide').map((match) => match.family.id),
    ['direct', 'prefix', 'indirect'],
  );
  assert.ok(searchLibrary(local, 'drill guide').every((match) => match.articleQuery === ''));
});
