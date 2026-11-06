import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import coverage from '../src/catalog/generated/promtehimport-coverage.json';
import { parts } from '../src/parts';

const productId = (url: string) =>
  url.match(/promtehimport\.com\.ua\/(?:ru\/)?offer\/.*-o(\d+)\/?$/)?.[1];
const sourcedPresets = parts.flatMap((part) =>
  part.presets.flatMap((preset) => {
    const id = productId(preset.catalog?.sourceUrl ?? '');
    return id ? [{ part, preset, id }] : [];
  }),
);

test('supplier coverage accounts for every enumerated product and every category', () => {
  const categories = Object.values(coverage.categories);
  assert.equal(categories.length, 19);
  assert.equal(categories.reduce((sum, category) => sum + category.pages, 0), 510);
  assert.equal(categories.reduce((sum, category) => sum + category.failedPages, 0), 0);
  assert.equal(coverage.enumeratedProducts, 11977);
  assert.equal(coverage.processedProducts, coverage.enumeratedProducts);
  assert.equal(
    Object.values(coverage.counts).reduce((sum, count) => sum + count, 0),
    coverage.enumeratedProducts,
  );
  assert.equal(
    categories.reduce((sum, category) => sum + category.enumerated, 0),
    coverage.enumeratedProducts,
  );
  for (const category of categories)
    assert.equal(
      Object.values(category.statuses).reduce((sum, count) => sum + count, 0),
      category.enumerated,
      category.url,
    );
  assert.deepEqual(
    Object.fromEntries(
      parts.flatMap((part) => {
        const count = part.presets.filter((preset) =>
          productId(preset.catalog?.sourceUrl ?? ''),
        ).length;
        return count ? [[part.id, count]] : [];
      }),
    ),
    coverage.byModel,
  );
});

test('source identifiers and specialized topology survive import classification', () => {
  const longNumber = sourcedPresets.find(({ id }) => id === '12163');
  assert.equal(longNumber?.part.id, 'ball-bearing');
  assert.match(longNumber?.preset.catalog?.designation ?? '', /^511135 A/);
  for (const { part, preset } of sourcedPresets) {
    const designation = preset.catalog!.designation;
    assert.doesNotMatch(
      designation,
      /\+\s*H\s*\d/,
      'Adapter assemblies cannot become bare bearings',
    );
    if (part.id === 'rod-end-bearing') assert.doesNotMatch(designation, /^SA\s*2\d{2}/);
    if (part.id === 'linear-bearing') {
      assert.match(designation, /^LME?[\s-]*\d{1,3}[\s-]*UU/);
      assert.doesNotMatch(designation, /SCS|SBR|TBR|LMK|LMF|OP|AJ/);
    }
  }
  const excluded = new Set(sourcedPresets.map(({ id }) => id));
  for (const id of ['5265', '8915', '7413']) assert.ok(!excluded.has(id), id);
});

test('catalog integration deduplicates translated and redirected supplier product URLs', () => {
  const ids = sourcedPresets.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  const singleShield = parts
    .find((part) => part.id === 'ball-bearing')!
    .presets.find((preset) => /^6000-Z\s/.test(preset.catalog?.designation ?? ''));
  assert.ok(singleShield);
  assert.equal(singleShield.parameters.seals, 'metal-one');
  for (const id of ['flange-2-bolt-bearing', 'flange-4-bolt-bearing']) {
    const part = parts.find((part) => part.id === id)!;
    assert.ok(part.presets.some((preset) => preset.catalog?.sourceName === 'Promtehimport'));
  }
});

test('curated presets retain the exact product identities admitted by the source audit', () => {
  const ids = sourcedPresets.map(({ id }) => id).sort();
  assert.equal(ids.length, coverage.counts.imported);
  // SHA-256 of sorted, newline-joined product IDs from the September 13, 2026 import decisions.
  assert.equal(
    createHash('sha256').update(ids.join('\n')).digest('hex'),
    '30c338a52100ad61b05cfd4742bb63fa5b2a291665d76a86a9a7a31c43502c22',
  );
});
