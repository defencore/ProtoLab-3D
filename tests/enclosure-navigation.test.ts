import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parts } from '../src/parts';
import { familyMembers, groupBrowseFamilies } from '../src/core/browse-families';
import { libraryArea, libraryNavigationGroups } from '../src/core/library-navigation';
import { librarySubgroups, sortLibraryParts } from '../src/core/library';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { presetBrowserSelection } from '../src/core/preset-browser';

register(
  `data:text/javascript,${encodeURIComponent(`
  export async function load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
    return nextLoad(url, context);
  }
`)}`,
  import.meta.url,
);
const { default: CatalogModelPicker } = await import('../src/components/CatalogModelPicker');

const enclosures = parts.filter((part) => part.category === 'ENCLOSURES & DEVICES');
const catalog = enclosures.find((part) => part.id === 'catalog-enclosure');

test('supplier and authored enclosures share one catalog and retain their physical identities', () => {
  assert.ok(catalog);
  assert.equal(catalog.name, 'Catalog enclosures');
  assert.equal(catalog.subgroup, 'GENERAL-PURPOSE ENCLOSURES');
  assert.equal(catalog.product.supply, 'purchased');
  assert.equal(libraryArea(catalog.category), 'enclosures');
  assert.equal(sortLibraryParts(enclosures)[0], catalog);
  assert.deepEqual(librarySubgroups(enclosures, catalog.category), [
    'GENERAL-PURPOSE ENCLOSURES',
    'HANDHELD CONTROLLERS',
  ]);
  const entries = groupBrowseFamilies(enclosures);
  assert.equal(entries.length, 2, 'one enclosure catalog and the separate handheld device family');
  const entry = entries.find((entry) => entry.id === 'enclosures');
  assert.ok(entry);
  assert.equal(entry.label, 'Enclosures');
  assert.equal(entry.grouped, true);
  assert.equal(entry.primary, catalog);
  assert.deepEqual(entry.members.map((member) => member.id).sort(), [
    'catalog-enclosure',
    'enclosure',
    'field-daq-enclosure',
    'grandado-tube-mount',
    'jcg108-tube-fairing',
    'printed-bayonet-enclosure',
    'printed-rim-enclosure',
    'printed-screw-enclosure',
    'printed-self-centering-enclosure',
    'printed-threaded-enclosure',
    'printed-threaded-shell',
    'underwater-pressure-enclosure',
  ]);
  assert.ok(!entries.some((entry) => entry.id === 'field-daq-enclosure'));
});

test('alternate views retain the shared enclosure catalog without changing make or buy policies', () => {
  assert.ok(catalog);
  const entries = groupBrowseFamilies(enclosures);
  for (const view of ['supply', 'product-kind', 'process'] as const) {
    const groups = libraryNavigationGroups(entries, view);
    const matching = groups
      .flatMap((group) => group.entries)
      .filter((entry) => entry.id === 'enclosures');
    assert.equal(matching.length, 1, view);
    assert.ok(matching[0].members.includes(catalog));
    assert.equal(
      matching[0].members.find((member) => member.id === 'field-daq-enclosure')?.product.supply,
      'manufactured',
    );
  }
  assert.equal(catalog.product.supply, 'purchased');
});

test('localized enclosure and DAQ searches reach the shared enclosure catalog', () => {
  assert.ok(catalog);
  const index = buildLibrarySearchIndex(groupBrowseFamilies(enclosures));
  const localized = String.fromCodePoint(0x43a, 0x43e, 0x440, 0x43f, 0x443, 0x441, 0x438);
  for (const query of ['enclosure', localized, 'field daq']) {
    const matches = searchLibrary(index, query);
    assert.ok(
      matches.some((match) => match.family.id === 'enclosures'),
      query,
    );
    assert.ok(!matches.some((match) => match.family.id === 'field-daq-enclosure'), query);
  }
});

test('the common model list finds all four DAQ executions and keeps supplier selections distinct', () => {
  assert.ok(catalog);
  const members = familyMembers(parts, catalog);
  const index = buildPresetIndex(members);
  const result = filterPresets(index, { ...emptyPresetFilters(), query: 'field daq' });
  const daq = members.find((member) => member.id === 'field-daq-enclosure')!;
  assert.ok(daq);
  assert.equal(result.items.length, 4);
  assert.deepEqual(
    result.items.map((entry) => entry.preset.id).sort(),
    daq.presets.map((preset) => preset.id).sort(),
  );
  assert.ok(result.items.every((entry) => entry.part === daq));

  for (const entry of [result.items[0], index.find((entry) => entry.part === catalog)!]) {
    const selected = presetBrowserSelection(
      index,
      index,
      entry.part,
      entry.preset.parameters,
      entry.preset.id,
    );
    assert.equal(selected.selected, entry);
    assert.equal(selected.selectedId, `${entry.part.id}:${entry.preset.id}`);
  }

  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    const html = renderToStaticMarkup(
      React.createElement(CatalogModelPicker, {
        parts: members,
        part: catalog,
        parameters: catalog.defaults,
        presetId: '',
        initialQuery: 'field daq',
        onQueryChange() {},
        onSelect() {},
        onSelectPart() {},
      }),
    );
    assert.match(html, /catalog-model-family-title">Enclosures<\/h3>/);
    assert.equal((html.match(/aria-label="Select Field DAQ/g) ?? []).length, 4);
    assert.match(html, /Field DAQ enclosure/);
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
