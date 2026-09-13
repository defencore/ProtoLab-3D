/** Produce a readable audit alongside the full, reproducible supplier snapshots. */
import fs from 'node:fs';
import { parts } from '../src/parts';
const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const all = parts.flatMap((part) => part.presets.map((preset) => ({ part, preset })));
const sourced = all.filter((row) => row.preset.catalog);
const codes = new Set(sourced.flatMap((row) => row.preset.catalog?.productCodes ?? []));
const sections = [
  ['Bolts and screws', 'fasteners'],
  ['Nuts and inserts', 'gajki'],
  ['Washers and rings', 'shajby-koltsa'],
  ['Threaded rods', 'shpilki'],
  ['Pins, cotters and clamps', 'shplinty-i-strubtsiny'],
];
const lines = [
  '# Catalog import coverage',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)}. All counts below distinguish discovered products from usable geometry presets; source inventories retain their snapshot timestamps.`,
  '',
  `The library contains **${parts.length} part modules**, **${sourced.length} sourced presets** and **${all.length - sourced.length} prototype examples**.`,
  '',
  '## Supplied drawings and motion components',
  '',
  'The eight supplied images are retained in `public/references/` and linked from the matching presets. Added modules cover ball screw assemblies, standalone ball nuts, a jaw coupling and bevel gear pairs. Ball screw manufacturer tables supplement the images; each preset identifies its own source and verified dimensions.',
  '',
  '- All 27 SFU dimension-table rows and all nine requested ball nut families are represented.',
  '- Miniature SFK shaft lengths cover 100–550 mm in 50 mm steps. Repeated lengths and assembly/nut exports are distinct configurations, not additional source products.',
  '- The D25 L30 coupling includes all 38 unique listed bore pairs.',
  '- Four m0.5 pinions cover 11/13/15/17 teeth with a 2.98 mm bore. Six bevel pairs cover all 12 dimension-table rows.',
  '- SFK602 and SFE3210 remain unverified prototype examples because the listing codes have no matching dimensioned drawing. DFI1605-4 is excluded from the LIMON import because its published L=10 conflicts with its double-nut construction.',
  '',
  'See [ball screw source coverage](docs/ball-screw-catalog.md) and [gear reference mapping](docs/reference-gears.md) for source-specific dimensions and model limitations.',
  '',
  '## Gvyntok',
  '',
  'Every public category page in the five supplied sections was read. Coatings and materials with identical dimensions are grouped; every admitted supplier SKU remains searchable.',
  '',
  '| Section | Source categories | Pages | Visible products read | SKUs represented by models |',
  '| --- | ---: | ---: | ---: | ---: |',
];
const missing = new Map<string, number>();
for (const [label, id] of sections) {
  const data = read(`src/catalog/data/gvyntok-${id}.json`);
  const represented = data.products.filter((p: { sku: string }) => codes.has(p.sku));
  lines.push(
    `| ${label} | ${data.categories.length} | ${data.categories.reduce((n: number, c: { pages: string[] }) => n + c.pages.length, 0)} | ${data.products.length} | ${represented.length} |`,
  );
  for (const row of data.products)
    if (!codes.has(row.sku))
      missing.set(
        row.standard ?? 'Other supplier families',
        (missing.get(row.standard ?? 'Other supplier families') ?? 0) + 1,
      );
}
lines.push(
  '',
  'Navigation badges have stale totals in a few categories. The importer checks against the actual visible result count and records discrepancies separately.',
  '',
  'Dimensions are taken from linked supplier drawings and product rows. Where a listing supplies only a nominal size, an explicitly identified standard reference can supply additional dimensions; each preset describes that distinction and links to the reference. Nominal screw sizes and washer clearance bores remain separate. Unspecified chamfers, slit angles, collars and internal profiles are prototype settings.',
  '',
  '### Products still without a supported model or verified size',
  '',
  '| Standard / group | Unrepresented SKU rows |',
  '| --- | ---: |',
);
for (const [standard, count] of [...missing].sort((a, b) => b[1] - a[1]))
  lines.push(`| ${standard} | ${count} |`);
const report = read('data/promtehimport-import-report.json');
const supplierPageCount = Object.values(report.categories).reduce(
  (sum: number, category) => sum + (category as { pages: number }).pages,
  0,
);
const sectionNames: Record<string, string> = {
  c34: 'Single-row radial ball',
  c35: 'Self-aligning ball',
  c36: 'Angular contact ball',
  c37: 'Mounted bearing units',
  c38: 'Thrust ball',
  c39: 'Tapered roller',
  c40: 'Insert bearings',
  c42: 'Spherical roller',
  c43: 'Cylindrical roller',
  c44: 'Needle roller',
  c45: 'One-way clutches',
  c46: 'Thrust roller',
  c47: 'Linear bushings',
  c48: 'Combined bearings',
  c49: 'Rod ends',
  c50: 'Plain bearings',
  c51: 'Double-row radial ball',
  c52: 'Adapter sleeves',
  c54: 'Oil seals',
};
lines.push(
  '',
  '## Promtehimport',
  '',
  `All 19 supplied sections were enumerated: **${supplierPageCount} category pages** and **${report.enumeratedProducts} distinct product URLs**. **${report.processedProducts} product records** were processed. Import state: **${report.sourceStatus}**.`,
  '',
  '| Import status | Product rows |',
  '| --- | ---: |',
);
for (const [status, count] of Object.entries(report.counts)) lines.push(`| ${status} | ${count} |`);
lines.push(
  '',
  '### Coverage by supplier section',
  '',
  '| Section | Enumerated products | Imported presets | Pending pages |',
  '| --- | ---: | ---: | ---: |',
);
for (const [id, coverage] of Object.entries(report.categoryCoverage) as [
  string,
  { url: string; enumerated: number; statuses: Record<string, number> },
][]) {
  lines.push(
    `| [${sectionNames[id] ?? id}](${coverage.url}) | ${coverage.enumerated} | ${coverage.statuses.imported ?? 0} | ${coverage.statuses['not-fetched'] ?? 0} |`,
  );
}
const exclusionReasons = new Map<string, number>();
for (const row of report.results as { status: string; reason?: string }[]) {
  if (row.status !== 'imported' && row.reason)
    exclusionReasons.set(row.reason, (exclusionReasons.get(row.reason) ?? 0) + 1);
}
lines.push(
  '',
  '### Most common remaining exclusions',
  '',
  '| Reason | Product rows |',
  '| --- | ---: |',
);
for (const [reason, count] of [...exclusionReasons].sort((a, b) => b[1] - a[1]).slice(0, 12))
  lines.push(`| ${reason.replaceAll('|', '/')} | ${count} |`);
lines.push(
  '',
  'Discovered URLs without retrieved dimensions are not labeled as imported presets. Unresolved dimension conflicts and unsupported shapes are excluded. A small set of shop-summary conflicts is reconciled against explicitly linked NSK reference dimensions and labeled accordingly. The importer resumes from its saved cache.',
  '',
  '## Presets by module',
  '',
  '| Part | Sourced presets | Prototype examples |',
  '| --- | ---: | ---: |',
);
for (const part of parts)
  lines.push(
    `| ${part.name} | ${part.presets.filter((p) => p.catalog).length} | ${part.presets.filter((p) => !p.catalog).length} |`,
  );
lines.push(
  '',
  '## Audit files',
  '',
  '- [Supplier inventory](data/promtehimport-inventory.json)',
  '- [Bearing mapping report](data/promtehimport-import-report.json)',
  '- [Hardware mapping report](src/catalog/data/gvyntok-hardware-mapping-coverage.json)',
  '- [Gvyntok source snapshots](src/catalog/data/)',
  '',
  'Regenerate this report with `node --import tsx scripts/report-catalog.ts` after refreshing supplier data.',
);
fs.writeFileSync('CATALOG_COVERAGE.md', lines.join('\n') + '\n');
console.log(
  JSON.stringify({
    modules: parts.length,
    sourcedPresets: sourced.length,
    examples: all.length - sourced.length,
    representedSKUs: codes.size,
  }),
);
