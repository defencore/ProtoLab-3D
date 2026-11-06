import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { Preset } from '../src/core/types';
import {
  buildSupplierNameIndex,
  collectSupplierNameCoverage,
  enrichSupplierNames,
  loadSupplierNameIndex,
  patchSupplierNamesJson,
  supplierNameForCatalog,
} from '../scripts/sync-supplier-names';

const root = fileURLToPath(new URL('..', import.meta.url));
const exactTitle = '\u0413\u0430\u0439\u043a\u0430 M6 DIN 934';
function preset(sourceUrl: string, productCodes?: string[]): Preset {
  return {
    id: 'nut-m6',
    name: 'M6 \u00b7 DIN 934',
    description: 'Curated English model title remains independent of supplier evidence.',
    parameters: { bore: 6, height: 5 },
    catalog: {
      designation: 'M6 DIN 934',
      sourceName: 'Example hardware shop',
      sourceUrl,
      verifiedParameters: ['bore', 'height'],
      ...(productCodes ? { productCodes } : {}),
    },
  };
}

test('exact primary product URL wins over other grouped SKU titles', () => {
  const index = buildSupplierNameIndex([
    { url: 'https://shop.test/nut/primary', sku: 'M6-A', name: exactTitle },
    { url: 'https://shop.test/nut/alternative', sku: 'M6-B', name: 'Different coating M6' },
  ]);
  assert.equal(
    supplierNameForCatalog(
      { sourceUrl: 'https://shop.test/nut/primary', productCodes: ['M6-B', 'M6-A'] },
      index,
    ),
    exactTitle,
  );
});

test('SKU matching is unambiguous and scoped to the supplier hostname', () => {
  const index = buildSupplierNameIndex([
    { url: 'https://first.test/old-url', sku: 'SKU-1', name: 'First supplier original name' },
    { url: 'https://second.test/item', sku: 'SKU-1', name: 'Second supplier original name' },
  ]);
  assert.equal(
    supplierNameForCatalog(
      { sourceUrl: 'https://first.test/new-url', productCodes: ['SKU-1'] },
      index,
    ),
    'First supplier original name',
  );
  assert.equal(
    supplierNameForCatalog(
      { sourceUrl: 'https://second.test/item', productCodes: ['SKU-1'] },
      index,
    ),
    'Second supplier original name',
  );
  assert.equal(
    supplierNameForCatalog(
      { sourceUrl: 'https://third.test/item', productCodes: ['SKU-1'] },
      index,
    ),
    undefined,
  );
});

test('ambiguous identities and absent source evidence never borrow a curated UI title', () => {
  const index = buildSupplierNameIndex([
    { url: 'https://shop.test/a', sku: 'DUPLICATE', name: 'Original product A' },
    { url: 'https://shop.test/b', sku: 'DUPLICATE', name: 'Original product B' },
    { url: 'https://shop.test/conflict', name: 'Conflicting title A' },
    { url: 'https://shop.test/conflict', name: 'Conflicting title B' },
  ]);
  assert.equal(
    supplierNameForCatalog(
      { sourceUrl: 'https://shop.test/new', productCodes: ['DUPLICATE'] },
      index,
    ),
    undefined,
  );
  assert.equal(
    supplierNameForCatalog({ sourceUrl: 'https://shop.test/conflict' }, index),
    undefined,
  );
  const missing = preset('https://unknown.test/product');
  assert.equal(enrichSupplierNames([missing], index)[0].catalog?.name, undefined);
  assert.equal(missing.catalog?.name, undefined);
});

test('enrichment preserves source identities, parameters and curated titles without mutating inputs', () => {
  const index = buildSupplierNameIndex([
    { url: 'https://shop.test/nut', name: exactTitle, sku: 'NUT-6' },
  ]);
  const original = preset('https://shop.test/nut', ['NUT-6']);
  const before = structuredClone(original);
  const enriched = enrichSupplierNames([original], index);
  assert.equal(enriched[0].catalog?.name, exactTitle);
  assert.equal(enriched[0].name, original.name);
  assert.equal(enriched[0].id, original.id);
  assert.deepEqual(enriched[0].parameters, original.parameters);
  assert.equal(enriched[0].catalog?.designation, original.catalog?.designation);
  assert.equal(enriched[0].catalog?.sourceUrl, original.catalog?.sourceUrl);
  assert.deepEqual(original, before);
});

test('compact JSON remains compact and stores foreign supplier evidence with Unicode escapes', () => {
  const index = buildSupplierNameIndex([{ url: 'https://shop.test/nut', name: exactTitle }]);
  const source = JSON.stringify([preset('https://shop.test/nut')]) + '\n';
  const result = patchSupplierNamesJson(source, index);
  assert.equal(result.updated, 1);
  assert.equal(result.text.trim().split('\n').length, 1);
  assert.equal(JSON.parse(result.text)[0].catalog.name, exactTitle);
  assert.ok(result.text.includes('\\u0413'));
  assert.ok(!/[\u0400-\u04ff]/u.test(result.text));
  assert.deepEqual(patchSupplierNamesJson(result.text, index), { text: result.text, updated: 0 });
});

test('pretty JSON retains indentation and unchanged fields while adding exact evidence', () => {
  const index = buildSupplierNameIndex([{ url: 'https://shop.test/nut', name: exactTitle }]);
  const source = JSON.stringify([preset('https://shop.test/nut')], null, 2) + '\n';
  const result = patchSupplierNamesJson(source, index);
  assert.equal(result.updated, 1);
  assert.ok(result.text.startsWith('[\n  {\n'));
  assert.ok(result.text.includes('\n    "catalog": {\n'));
  assert.equal(JSON.parse(result.text)[0].catalog.name, exactTitle);
  assert.equal(JSON.parse(result.text)[0].name, JSON.parse(source)[0].name);
});

test('saved Gvyntok product titles resolve exactly from the compact offline source snapshots', () => {
  const index = loadSupplierNameIndex(root);
  const hardware = JSON.parse(
    readFileSync(path.join(root, 'src/catalog/data/gvyntok-gajki.json'), 'utf8'),
  );
  const nut = hardware.products.find(
    (item: { sourceTitle?: string; url?: string; sku?: string }) =>
      item.sourceTitle && item.url && item.sku,
  );
  assert.ok(nut, 'Gvyntok snapshot has original per-product titles');
  assert.equal(
    supplierNameForCatalog({ sourceUrl: nut.url, productCodes: [nut.sku] }, index),
    nut.sourceTitle,
  );
});

test('explicit raw supplier inventories resolve exact titles and redirected evidence URLs', (context) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'protolab-supplier-titles-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const gvyntokFasteners = path.join(directory, 'gvyntok.json');
  const promtehimport = path.join(directory, 'promtehimport.json');
  const screw = { url: 'https://gvyntok.com/example', sku: 'BOLT-001', sourceTitle: exactTitle };
  const product = {
    name: '6200-Z',
    url: 'https://promtehimport.com.ua/offer/6200-z-o1/',
    sourceUrl: 'https://promtehimport.com.ua/ru/offer/6200-z-o1/',
  };
  const incomplete = {
    name: 'Failed page',
    url: 'https://promtehimport.com.ua/offer/error-o2/',
    error: 'Error',
  };
  writeFileSync(gvyntokFasteners, JSON.stringify({ products: [screw] }));
  writeFileSync(
    promtehimport,
    JSON.stringify({ products: { [product.url]: product, [incomplete.url]: incomplete } }),
  );
  const index = loadSupplierNameIndex(root, { gvyntokFasteners, promtehimport });
  assert.equal(supplierNameForCatalog({ sourceUrl: screw.url }, index), screw.sourceTitle);
  assert.equal(supplierNameForCatalog({ sourceUrl: product.url }, index), product.name);
  assert.equal(
    supplierNameForCatalog({ sourceUrl: product.sourceUrl }, index),
    product.name,
  );
  assert.equal(supplierNameForCatalog({ sourceUrl: incomplete.url }, index), undefined);
});

test('repository coverage distinguishes evidenced supplier names from genuinely missing titles', () => {
  const coverage = collectSupplierNameCoverage(root);
  assert.ok(coverage.catalogRecords > 0);
  assert.ok(coverage.named > 0);
  assert.ok(coverage.matched > 0);
  assert.ok(
    coverage.missing > 0,
    'missing evidence stays visible rather than becoming invented titles',
  );
  assert.equal(coverage.named + coverage.missing, coverage.catalogRecords);
  assert.equal(coverage.pending, 0, 'run the offline name sync after changing source snapshots');
  assert.deepEqual(coverage.bySource.find(({ source }) => source === 'promtehimport.com.ua'), {
    source: 'promtehimport.com.ua',
    total: 7928,
    named: 7928,
    missing: 0,
  });
  assert.equal(
    coverage.bySource.reduce((total, source) => total + source.total, 0),
    coverage.catalogRecords,
  );
  assert.equal(
    coverage.bySource.reduce((total, source) => total + source.named, 0),
    coverage.named,
  );
});
