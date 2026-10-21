import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parts } from '../src/parts';
import { libraryCategories } from '../src/core/library';
import { libraryAreas, libraryArea } from '../src/core/library-navigation';
import { libraryLabel } from '../src/core/library-labels';
import type { PartDefinition } from '../src/core/types';
import { emptyPresetFilters, fieldId, type PresetFilters } from '../src/core/preset-search';

// Rendering the real component verifies its control layout; styles are handled by Vite in the app.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url,
);
const { default: PresetBrowser } = await import('../src/components/PresetBrowser');

const family = parts.filter((part) => part.browseFamily?.id === 'spacers-standoffs');
const current = family.find((part) => part.id === 'pcb-standoff')!;

function browserHtml(
  filters: PresetFilters,
  definitions: PartDefinition[] = parts,
  selectedPart: PartDefinition = current,
): string {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      createElement(PresetBrowser, {
        parts: definitions,
        currentPart: selectedPart,
        currentParameters: selectedPart.defaults,
        currentPresetId: '',
        initialMode: 'match',
        filters,
        onFiltersChange: () => {},
        onApply: () => {},
        onClose: () => {},
      }),
    );
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('preset results use the canonical name and retain a different source designation', () => {
  const preset = {
    ...current.presets.find((item) => item.catalog)!,
    id: 'display-name-fixture',
    name: 'Maker X1 · 4 mm',
    catalog: {
      ...current.presets.find((item) => item.catalog)!.catalog!,
      designation: 'SOURCE-004',
    },
  };
  const definition = { ...current, presets: [preset] };
  for (const query of ['Maker X1', 'SOURCE-004']) {
    const html = browserHtml(
      { ...emptyPresetFilters(definition), query },
      [definition],
      definition,
    );
    assert.match(html, /<h3>Maker X1 · 4 mm<\/h3>/);
    assert.match(html, /Source designation: SOURCE-004/);
    assert.doesNotMatch(html, /<h3>SOURCE-004<\/h3>/);
    assert.match(html, /aria-label="Preview Maker X1 · 4 mm,/);
  }
  assert.equal(preset.catalog.designation, 'SOURCE-004');
});

test('a selected multi-part family exposes its source facets and separates catalog body length from plain sleeve length', () => {
  assert.equal(family.length, 4);
  const html = browserHtml(emptyPresetFilters(current));
  assert.doesNotMatch(html, /Select a part type for additional dimensions/);
  assert.match(html, /class="pb-more-fields"/);
  assert.match(html, /aria-label="Source thread at end A filter"/);
  assert.match(html, /aria-label="Source thread at end B filter"/);
  const primary = html.slice(
    html.indexOf('class="pb-primary-fields"'),
    html.indexOf('class="pb-more-fields"'),
  );
  assert.match(primary, /aria-label="Catalog body length from"/);
  assert.match(primary, /aria-label="Plain spacer \/ sleeve length from"/);
  assert.match(primary, /aria-label="Diameter \/ across flats from"/);
  assert.match(html, /aria-label="Published overall length from"/);
  assert.match(html, /aria-label="Across-corner envelope from"/);
  assert.doesNotMatch(html, /aria-label="Lower female \/ pilot depth from"/);
});

test('a family selected without a category retains its catalog controls and an explicit source length constraint', () => {
  const field = current.catalogFilterFields!.find((field) => field.key === 'catalogBodyLength')!;
  const html = browserHtml({
    ...emptyPresetFilters(current),
    category: '',
    parameters: { [fieldId(field)]: { min: '10', max: '10' } },
  });
  assert.match(html, /aria-label="Catalog body length from"[^>]*value="10"/);
  assert.match(html, /aria-label="Source thread at end A filter"/);
  assert.doesNotMatch(html, /Select a part type for additional dimensions/);
  assert.doesNotMatch(html, /Check your ranges/);
  const sourceThread = html.match(
    /aria-label="Source thread at end A filter"[^>]*>([\s\S]*?)<\/select>/,
  )![1];
  const count = family
    .flatMap((part) => part.presets)
    .filter(
      (preset) =>
        preset.catalog?.attributes?.catalogThreadA === 'M3' &&
        preset.catalog.attributes.catalogBodyLength === 10,
    ).length;
  assert.ok(count > 0);
  assert.ok(sourceThread.includes(`value="M3">M3 · ${count.toLocaleString('en-US')}</option>`));
});

test('unscoped category and all-library browsing stay concise until a part or family is chosen', () => {
  for (const category of ['', current.category]) {
    const html = browserHtml({ ...emptyPresetFilters(), category });
    assert.match(html, /Select a part type for additional dimensions/);
    assert.doesNotMatch(html, /class="pb-more-fields"/);
    assert.doesNotMatch(html, /aria-label="Published overall length from"/);
  }
});

test('advanced category choices follow the six collections with readable labels and unchanged category IDs', () => {
  const html = browserHtml(emptyPresetFilters());
  const select = html.match(/aria-label="Preset category"[^>]*>([\s\S]*?)<\/select>/)![1];
  const decode = (value: string) =>
    value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");
  const groups = [...select.matchAll(/<optgroup label="([^"]*)">([\s\S]*?)<\/optgroup>/g)];
  assert.deepEqual(
    groups.map((group) => decode(group[1])),
    libraryAreas.map((area) => area.label),
  );
  assert.match(select, /^<option value="" selected="">All categories<\/option>/);
  const actualCategories: string[] = [];
  for (const [index, group] of groups.entries()) {
    const options = [...group[2].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)];
    const values = options.map((option) => decode(option[1]));
    assert.deepEqual(
      values,
      libraryCategories(parts).filter(
        (category) => libraryArea(category) === libraryAreas[index].id,
      ),
    );
    assert.deepEqual(
      options.map((option) => decode(option[2])),
      values.map(libraryLabel),
    );
    actualCategories.push(...values);
  }
  assert.equal(new Set(actualCategories).size, actualCategories.length);
  assert.deepEqual([...actualCategories].sort(), libraryCategories(parts).sort());
  for (const definition of parts)
    assert.ok(
      actualCategories.includes(definition.category),
      definition.id + ' remains selectable',
    );
});

test('grouped category options preserve the selected category and its supplier results', () => {
  const html = browserHtml({ ...emptyPresetFilters(current), query: 'M3' });
  const select = html.match(/aria-label="Preset category"[^>]*>([\s\S]*?)<\/select>/)![1];
  assert.match(
    select,
    /<option value="FASTENERS &amp; THREADS" selected="">Fasteners &amp; threads<\/option>/,
  );
  assert.match(html, /Source thread at end A filter/);
  assert.match(html, /M3/);
  assert.doesNotMatch(html, /No matching presets/);
});
