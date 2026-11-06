import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import type { Preset } from '../src/core/types';

export interface SupplierNameRecord {
  url: string;
  name: string;
  sku?: string;
}
export interface SupplierNameIndex {
  byUrl: Map<string, Set<string>>;
  bySku: Map<string, Set<string>>;
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshots = [
  'src/catalog/data/gvyntok-gajki.json',
  'src/catalog/data/gvyntok-shajby-koltsa.json',
  'src/catalog/data/gvyntok-shplinty-i-strubtsiny.json',
  'src/catalog/data/gvyntok-shpilki.json',
];

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Match a primary listing, or an unambiguous SKU within the same supplier domain. */
export function buildSupplierNameIndex(records: readonly SupplierNameRecord[]): SupplierNameIndex {
  const index: SupplierNameIndex = { byUrl: new Map(), bySku: new Map() };
  const add = (map: Map<string, Set<string>>, key: string, name: string) =>
    map.set(key, new Set([...(map.get(key) ?? []), name]));
  for (const record of records) {
    if (!record.url || !record.name?.trim()) continue;
    add(index.byUrl, record.url, record.name);
    const domain = host(record.url);
    if (domain && record.sku?.trim())
      add(index.bySku, `${domain}\n${record.sku.trim()}`, record.name);
  }
  return index;
}

export function supplierNameForCatalog(
  catalog: { sourceUrl: string; productCodes?: string[] },
  index: SupplierNameIndex,
): string | undefined {
  const direct = index.byUrl.get(catalog.sourceUrl);
  if (direct) return direct.size === 1 ? [...direct][0] : undefined;
  const domain = host(catalog.sourceUrl);
  if (!domain) return undefined;
  const candidates = new Set<string>();
  for (const code of catalog.productCodes ?? [])
    for (const name of index.bySku.get(`${domain}\n${code.trim()}`) ?? []) candidates.add(name);
  return candidates.size === 1 ? [...candidates][0] : undefined;
}

export function loadSupplierNameIndex(
  root = repositoryRoot,
  inventories: { gvyntokFasteners?: string; promtehimport?: string } = {},
): SupplierNameIndex {
  const records: SupplierNameRecord[] = [];
  const gvyntokInputs = snapshots.map((relative) => path.join(root, relative));
  if (inventories.gvyntokFasteners) gvyntokInputs.push(inventories.gvyntokFasteners);
  for (const input of gvyntokInputs) {
    const source = JSON.parse(readFileSync(input, 'utf8')) as {
      products: Array<{ url: string; sourceTitle: string; sku?: string }>;
    };
    for (const { url, sourceTitle, sku } of source.products)
      records.push({ url, name: sourceTitle, sku });
  }
  if (inventories.promtehimport) {
    const source = JSON.parse(readFileSync(inventories.promtehimport, 'utf8')) as {
      products: Record<string, SupplierNameRecord & { sourceUrl?: string; error?: string }>;
    };
    for (const product of Object.values(source.products)) {
      if (product.error) continue;
      records.push(product);
      if (product.sourceUrl && product.sourceUrl !== product.url)
        records.push({ ...product, url: product.sourceUrl });
    }
  }
  return buildSupplierNameIndex(records);
}

/** Preserve English selector titles and geometry; only recorded source evidence is added. */
export function enrichSupplierNames(
  presets: readonly Preset[],
  index: SupplierNameIndex,
): Preset[] {
  return presets.map((preset) => {
    const name = preset.catalog && supplierNameForCatalog(preset.catalog, index);
    return name && name !== preset.catalog?.name
      ? { ...preset, catalog: { ...preset.catalog!, name } }
      : preset;
  });
}

/** Foreign source titles are machine evidence and remain escaped in repository JSON. */
export function supplierSnapshotJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u0080-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Insert only catalog.name tokens, preserving existing compact/pretty JSON bytes. */
export function patchSupplierNamesJson(
  source: string,
  index: SupplierNameIndex,
): { text: string; updated: number } {
  const presets = JSON.parse(source) as Preset[];
  if (!Array.isArray(presets)) throw new Error('Preset snapshots must contain a JSON array.');
  const syntax = ts.parseJsonText('presets.json', source);
  const statement = syntax.statements[0];
  if (
    !statement ||
    !ts.isExpressionStatement(statement) ||
    !ts.isArrayLiteralExpression(statement.expression)
  )
    throw new Error('Preset snapshots must contain a JSON array.');
  const edits: { start: number; end: number; text: string }[] = [];
  function property(
    object: ts.ObjectLiteralExpression,
    key: string,
  ): ts.PropertyAssignment | undefined {
    return object.properties.find(
      (node): node is ts.PropertyAssignment =>
        ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && node.name.text === key,
    );
  }
  for (const [position, element] of statement.expression.elements.entries()) {
    const catalog = presets[position]?.catalog;
    const name = catalog && supplierNameForCatalog(catalog, index);
    if (!name || catalog?.name === name || !ts.isObjectLiteralExpression(element)) continue;
    const node = property(element, 'catalog')?.initializer;
    if (!node || !ts.isObjectLiteralExpression(node))
      throw new Error('Cannot locate catalog source evidence.');
    const existing = property(node, 'name')?.initializer;
    if (existing)
      edits.push({
        start: existing.getStart(syntax),
        end: existing.end,
        text: supplierSnapshotJson(name),
      });
    else {
      const start = node.getStart(syntax) + 1;
      const first = node.properties[0];
      const gap = source.slice(start, first?.getStart(syntax) ?? start);
      const indent = /(?:\r?\n)([\t ]*)$/.exec(gap)?.[1];
      const newline = gap.includes('\r\n') ? '\r\n' : '\n';
      const prefix = indent === undefined ? '' : `${newline}${indent}`;
      edits.push({
        start,
        end: start,
        text: `${prefix}"name":${indent === undefined ? '' : ' '}${supplierSnapshotJson(name)}${first ? ',' : ''}`,
      });
    }
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return { text: result, updated: edits.length };
}

function presetFiles(root: string): string[] {
  return readdirSync(path.join(root, 'src/parts'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, 'src/parts', entry.name, 'presets.json'))
    .filter(existsSync)
    .sort();
}

export function collectSupplierNameCoverage(
  root = repositoryRoot,
  index = loadSupplierNameIndex(root),
) {
  let catalogRecords = 0,
    named = 0,
    matched = 0,
    pending = 0;
  const sources = new Map<
    string,
    { source: string; total: number; named: number; missing: number }
  >();
  for (const file of presetFiles(root)) {
    const presets = JSON.parse(readFileSync(file, 'utf8')) as Preset[];
    for (const preset of presets) {
      const catalog = preset.catalog;
      if (!catalog) continue;
      catalogRecords++;
      const source = host(catalog.sourceUrl) || catalog.sourceName;
      const counts = sources.get(source) ?? { source, total: 0, named: 0, missing: 0 };
      counts.total++;
      if (catalog.name?.trim()) {
        named++;
        counts.named++;
      } else counts.missing++;
      const expected = supplierNameForCatalog(catalog, index);
      if (expected) {
        matched++;
        if (catalog.name !== expected) pending++;
      }
      sources.set(source, counts);
    }
  }
  return {
    catalogRecords,
    named,
    matched,
    missing: catalogRecords - named,
    pending,
    bySource: [...sources.values()].sort(
      (a, b) => b.total - a.total || a.source.localeCompare(b.source),
    ),
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      write: { type: 'boolean' },
      check: { type: 'boolean' },
      'gvyntok-fastener-inventory': { type: 'string' },
      'promtehimport-inventory': { type: 'string' },
    },
  });
  if (values.write && values.check) throw new Error('Choose either --write or --check.');
  const index = loadSupplierNameIndex(repositoryRoot, {
    gvyntokFasteners: values['gvyntok-fastener-inventory'],
    promtehimport: values['promtehimport-inventory'],
  });
  if (values.write) {
    let updated = 0,
      files = 0;
    for (const file of presetFiles(repositoryRoot)) {
      const patch = patchSupplierNamesJson(readFileSync(file, 'utf8'), index);
      if (!patch.updated) continue;
      writeFileSync(file, patch.text);
      updated += patch.updated;
      files++;
    }
    console.log(`Recorded ${updated} exact supplier titles in ${files} preset snapshots.`);
  }
  const report = collectSupplierNameCoverage(repositoryRoot, index);
  console.log(JSON.stringify(report, null, 2));
  if (values.check && report.pending) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
