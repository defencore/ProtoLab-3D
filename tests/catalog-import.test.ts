import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parts } from '../src/parts';

const report = JSON.parse(
  fs.readFileSync(new URL('../data/promtehimport-import-report.json', import.meta.url), 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync(new URL('../data/promtehimport-inventory.json', import.meta.url), 'utf8'),
);

test('supplier inventory accounts for every enumerated product and every category', () => {
  assert.equal(Object.keys(inventory.categories).length, 19);
  const urls = new Set<string>(
    Object.values(inventory.categories).flatMap((category: any) => category.productUrls),
  );
  assert.equal(urls.size, inventory.uniqueProductCount);
  assert.equal(report.results.length, urls.size);
  assert.equal(new Set(report.results.map((row: any) => row.url)).size, urls.size);
  assert.equal(
    Object.values(report.counts).reduce((sum: any, count: any) => sum + count, 0),
    urls.size,
  );
  for (const [code, category] of Object.entries(inventory.categories) as [string, any][]) {
    const coverage = report.categoryCoverage[code];
    assert.equal(category.fetchedPages.length + category.failedPages.length, category.pages);
    assert.equal(
      Object.values(coverage.statuses).reduce((sum: any, count: any) => sum + count, 0),
      category.productUrls.length,
    );
  }
});

test('source identifiers and specialized topology survive import classification', () => {
  const prefix = report.results.find((row: any) => row.url.includes('-15bcd107-'));
  assert.equal(prefix.designation, '15BCD107');
  assert.equal(prefix.status, 'unsupported-subtype');
  const longNumber = report.results.find((row: any) => row.url.includes('-511135-'));
  assert.equal(longNumber.partId, 'ball-bearing');
  assert.match(longNumber.designation, /511135 A/);
  const repaired =
    inventory.products[Object.keys(inventory.products).find((url) => url.endsWith('-o8915/'))!];
  assert.match(repaired.name, /1680206/);
  assert.doesNotMatch(repaired.name, /HMK1512/);
  const contradictoryZarn = report.results.find((row: any) => row.url.endsWith('-o7413/'));
  assert.equal(contradictoryZarn.status, 'source-conflict');
  for (const row of report.results.filter((row: any) => row.status === 'imported')) {
    assert.doesNotMatch(
      row.designation,
      /\+\s*H\s*\d/,
      'Adapter assemblies cannot become bare bearings',
    );
    if (row.partId === 'rod-end-bearing') assert.doesNotMatch(row.designation, /^SA\s*2\d{2}/);
  }
  for (const row of report.results.filter(
    (row: any) => row.status === 'imported' && row.partId === 'linear-bearing',
  )) {
    assert.match(row.designation, /^LME?[\s-]*\d{1,3}[\s-]*UU/);
    assert.doesNotMatch(row.designation, /SCS|SBR|TBR|LMK|LMF|OP|AJ/);
  }
});

test('catalog integration deduplicates translated and redirected supplier product URLs', () => {
  for (const part of parts) {
    const ids = part.presets.flatMap(
      (preset) =>
        preset.catalog?.sourceUrl.match(
          /promtehimport\.com\.ua\/(?:ru\/)?offer\/.*-o(\d+)\/?$/,
        )?.[1] ?? [],
    );
    assert.equal(new Set(ids).size, ids.length, part.id);
  }
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

test('curated presets cannot reintroduce supplier rows excluded by the source audit', () => {
  const productId = (url: string) =>
    url.match(/promtehimport\.com\.ua\/(?:ru\/)?offer\/.*-o(\d+)\/?$/)?.[1];
  const admitted = new Set(
    report.results
      .filter((row: { status: string }) => row.status === 'imported')
      .map((row: { url: string }) => productId(row.url)),
  );
  const available = new Set(
    parts.flatMap((part) =>
      part.presets.flatMap((preset) => productId(preset.catalog?.sourceUrl ?? '') ?? []),
    ),
  );
  assert.deepEqual(available, admitted);
});
