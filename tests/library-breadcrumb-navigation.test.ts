import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalog from '../src/components/Catalog';
import { groupBrowseFamilies } from '../src/core/browse-families';
import {
  filterLibraryLocation,
  libraryLocationContains,
  libraryLocationLabel,
  libraryLocationPath,
  type LibraryLocation,
} from '../src/core/library-navigation';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { parts } from '../src/parts';

const entries = groupBrowseFamilies(parts);
const category: LibraryLocation = { level: 'category', category: 'POWER & MOTOR CONTROL' };
const subgroup: LibraryLocation = {
  level: 'subgroup',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
};
const batteryIds = [
  'battery-cells-packs',
  'battery-holders',
  'panel-battery-module',
  'waveshare-ups-3s',
];
const powerIds = [
  ...batteryIds,
  'bec',
  'bus-servo-driver',
  'cnc-servo-drive',
  'dc-dc-converter',
  'esc',
  'machine-control',
  'power-filter',
  'pwm-switch',
].sort();
const familyIds = (location?: LibraryLocation) =>
  filterLibraryLocation(entries, location)
    .map((entry) => entry.id)
    .sort();

function render(location?: LibraryLocation, query = '', selectedId = 'waveshare-ups-3s') {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts,
        selected: parts.find((part) => part.id === selectedId)!,
        location,
        query,
        onLocationChange() {},
        onSelect() {
          assert.fail('Browsing a parent level must not select a product.');
        },
        onClose() {},
        onQueryChange() {},
      }),
    );
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

const resultRows = (html: string) =>
  (html.match(/class="part-button(?: selected)?\s*"/g) ?? []).length;

test('parent library locations select complete categories and subgroups, retaining grouped products', () => {
  assert.deepEqual(familyIds(), entries.map((entry) => entry.id).sort());
  assert.deepEqual(familyIds({ level: 'all' }), familyIds());
  assert.deepEqual(familyIds(category), powerIds);
  assert.deepEqual(familyIds(subgroup), batteryIds);
  const scoped = filterLibraryLocation(entries, subgroup);
  assert.deepEqual(
    scoped
      .find((entry) => entry.id === 'battery-holders')!
      .members.map((part) => part.id)
      .sort(),
    ['battery-holder', 'li-ion-battery-holder'],
  );
  assert.deepEqual(
    scoped
      .find((entry) => entry.id === 'battery-cells-packs')!
      .members.map((part) => part.id)
      .sort(),
    ['li-ion-cell', 'li-ion-pack', 'lipo-battery', 'standard-battery'],
  );
  assert.ok(
    scoped.every((entry) => entries.includes(entry)),
    'location filtering retains the real family objects',
  );
});

test('a subgroup is bounded by its category and unknown locations cannot become the whole library', () => {
  const power = { category: 'POWER & MOTOR CONTROL', subgroup: 'BATTERIES & HOLDERS' };
  assert.equal(libraryLocationContains(power, subgroup), true);
  assert.equal(
    libraryLocationContains({ ...power, category: 'VEHICLE STRUCTURES' }, subgroup),
    false,
  );
  assert.equal(libraryLocationContains({ ...power, subgroup: 'BEC REGULATORS' }, subgroup), false);
  assert.deepEqual(familyIds({ level: 'category', category: 'UNKNOWN CATEGORY' }), []);
  assert.deepEqual(familyIds({ ...subgroup, category: 'VEHICLE STRUCTURES' }), []);
  assert.deepEqual(familyIds({ ...subgroup, subgroup: 'UNKNOWN SUBGROUP' }), []);
});

test('breadcrumb paths contain independently navigable generic ancestor locations', () => {
  assert.equal(libraryLocationLabel(category), 'Power & motor control');
  assert.equal(libraryLocationLabel(subgroup), 'Batteries & holders');
  assert.deepEqual(libraryLocationPath({ level: 'all' }), [
    { label: 'Library', location: { level: 'all' } },
  ]);
  assert.deepEqual(libraryLocationPath(category), [
    { label: 'Library', location: { level: 'all' } },
    { label: 'Power & motor control', location: category },
  ]);
  assert.deepEqual(libraryLocationPath(subgroup), [
    { label: 'Library', location: { level: 'all' } },
    { label: 'Power & motor control', location: category },
    { label: 'Batteries & holders', location: subgroup },
  ]);
});

test('the rendered battery level exposes all four families without another category expansion', () => {
  const html = render(subgroup);
  assert.match(html, /4 products in this level/);
  assert.equal(resultRows(html), 4);
  for (const label of [
    'Battery holders',
    'Battery cells &amp; packs',
    'Panel battery module',
    'Waveshare UPS Module 3S',
  ])
    assert.ok(html.includes(`<span>${label}</span>`), label);
  assert.doesNotMatch(html, /class="(?:category-button|subgroup-button)/);
  assert.doesNotMatch(
    html,
    /<span>BEC voltage regulator<\/span>|<span>Rocket Release Mechanism<\/span>/,
  );
  assert.match(html, /aria-current="true"/);
});

test('category and root browsing show complete scoped inventories while leaving the preview independent', () => {
  const categoryHtml = render(category);
  assert.match(categoryHtml, new RegExp(`${powerIds.length} products in this level`));
  assert.equal(resultRows(categoryHtml), powerIds.length);
  assert.match(categoryHtml, /<span>BEC voltage regulator<\/span>/);
  assert.match(categoryHtml, /<span>Brushless speed controller \(ESC\)<\/span>/);
  const rootHtml = render({ level: 'all' });
  assert.match(rootHtml, new RegExp(`${entries.length} products in this level`));
  assert.equal(resultRows(rootHtml), entries.length);
  const elsewhere = render(subgroup, '', 'worm-fin-actuator');
  assert.equal(resultRows(elsewhere), 4);
  assert.doesNotMatch(elsewhere, /<span>Worm-sector actuator<\/span>/);
});

test('search within a breadcrumb location cannot return matching products from another section', () => {
  const scoped = filterLibraryLocation(entries, subgroup);
  for (const query of ['3S 18650', 'battery', 'BEC']) {
    const matches = searchLibrary(buildLibrarySearchIndex(scoped), query);
    const html = render(subgroup, query);
    assert.equal(resultRows(html), matches.length, query);
    assert.ok(
      matches.every(({ family }) => batteryIds.includes(family.id)),
      query,
    );
    assert.doesNotMatch(
      html,
      /<span>Rocket Release Mechanism<\/span>|<span>BEC voltage regulator<\/span>/,
      query,
    );
    assert.doesNotMatch(
      html,
      /Search all collections/,
      'scope search must not claim to span the whole library',
    );
  }
});

test('default collection browsing stays available when no breadcrumb location is supplied', () => {
  const html = render();
  assert.match(html, /Group by/);
  assert.doesNotMatch(html, /products in this level/);
  const queryHtml = render(undefined, '3S 18650');
  assert.match(queryHtml, /Search all collections/);
});
