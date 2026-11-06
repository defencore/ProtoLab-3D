import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPresetIndex } from '../src/core/preset-search';
import { sortPresetEntries } from '../src/core/preset-sort';
import type { PartDefinition, Preset } from '../src/core/types';

function entries() {
  const preset = (id: string, length: number, width: number, height: number): Preset => ({
    id,
    name: `Case ${id}`,
    description: 'Published outside enclosure dimensions.',
    parameters: { length, width, height },
    catalog: {
      designation: id,
      sourceName: 'Fixture catalog',
      sourceUrl: 'https://example.com/enclosures',
      verifiedParameters: ['length', 'width', 'height'],
    },
  });
  const large = preset('10', 200, 100, 50);
  const flat = preset('2', 100, 100, 10);
  const narrow = preset('1', 50, 25, 100);
  const unknown = preset('unknown', 1, 1, 1);
  unknown.catalog!.verifiedParameters = ['length'];
  const part = {
    id: 'case-fixture',
    name: 'Catalog cases',
    category: 'ENCLOSURES & DEVICES',
    subgroup: 'CATALOG ENCLOSURES',
    keywords: [],
    parameters: [],
    presets: [unknown, large, narrow, flat],
  } as unknown as PartDefinition;
  return buildPresetIndex([part]);
}

test('outside volume sorting uses all published axes and leaves unknown dimensions last', () => {
  const index = entries();
  const sorted = sortPresetEntries(index, {
    key: 'volume',
    label: 'Smallest outside volume',
    direction: 'asc',
    productOf: ['length', 'width', 'height'],
  });
  assert.deepEqual(
    sorted.map((entry) => entry.preset.id),
    ['2', '1', '10', 'unknown'],
  );
  assert.deepEqual(
    index.map((entry) => entry.preset.id),
    ['unknown', '10', '1', '2'],
  );
});

test('descending dimension sorting keeps unpublished values last and accepts catalog attributes', () => {
  const index = entries();
  index[3].preset.catalog!.attributes = { height: 150 };
  const sorted = sortPresetEntries(index, {
    key: 'height',
    label: 'Tallest first',
    direction: 'desc',
  });
  assert.deepEqual(
    sorted.map((entry) => entry.preset.id),
    ['2', '1', '10', 'unknown'],
  );
});

test('catalog order is preserved without a selected sort and equal dimensions use natural names', () => {
  const index = entries();
  assert.deepEqual(sortPresetEntries(index), index);
  for (const entry of index.slice(1)) entry.preset.parameters.height = 30;
  assert.deepEqual(
    sortPresetEntries(index, { key: 'height', label: 'Height', direction: 'asc' }).map(
      (entry) => entry.preset.id,
    ),
    ['1', '2', '10', 'unknown'],
  );
});

test('nonfinite source values do not break catalog order', () => {
  const index = entries();
  index[1].preset.parameters.height = NaN;
  index[2].preset.parameters.height = Infinity;
  assert.equal(
    sortPresetEntries(index, { key: 'height', label: 'Height', direction: 'asc' })[0].preset.id,
    '2',
  );
});
