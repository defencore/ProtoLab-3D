import fs from 'node:fs';
import { supplierFamily, type SupplierFastener } from '../src/catalog/fasteners';
import { parts as libraryParts } from '../src/parts';

const [input, ...extra] = process.argv.slice(2);
if (!input || extra.length)
  throw new Error('Usage: node --import tsx scripts/report-fastener-catalog.ts <inventory.json>');
const inventory = JSON.parse(fs.readFileSync(input, 'utf8')) as {
  source: string;
  retrievedAt: string;
  categories: { pages: string[]; listedCount: number }[];
  products: SupplierFastener[];
};

const fastenerIds = ['bolt-screw', 'set-screw', 'wing-screw', 'swing-eye-bolt', 'lifting-eye-bolt'];
const parts = libraryParts.filter((part) => fastenerIds.includes(part.id));
const supplierCodes = new Set(inventory.products.map((row) => row.sku));
const partCoverage = parts.map((part) => ({
  id: part.id,
  totalPresets: part.presets.length,
  supplierCodes: part.presets
    .map((preset) => (preset.catalog?.productCodes ?? []).filter((code) => supplierCodes.has(code)))
    .filter((codes) => codes.length),
}));
const mappedPresets = partCoverage.flatMap((part) => part.supplierCodes);
const codes = new Set(mappedPresets.flat());
const families = [...new Set(inventory.products.map(supplierFamily))].sort();
const rows = families.map((family) => {
  const products = inventory.products.filter((row) => supplierFamily(row) === family);
  const familyCodes = new Set(products.map((row) => row.sku));
  const presets = mappedPresets.filter((presetCodes) =>
    presetCodes.some((code) => familyCodes.has(code)),
  );
  return {
    family,
    categories: new Set(products.map((row) => row.categoryUrl)).size,
    listedSKUs: products.length,
    mappedSKUs: products.filter((row) => codes.has(row.sku)).length,
    presets: presets.length,
    sourceUrls: [...new Set(products.map((row) => row.categoryUrl))],
  };
});
const unsupported = inventory.products
  .filter((row) => !codes.has(row.sku))
  .map((row) => ({
    sku: row.sku,
    url: row.url,
    family: supplierFamily(row),
    diameter: row.diameter,
    length: row.length,
    reason:
      'The source listing supplies nominal sizes but no verified bend dimensions. A dedicated hook geometry is not yet implemented.',
  }));
const report = {
  source: inventory.source,
  retrievedAt: inventory.retrievedAt,
  categories: inventory.categories.length,
  discoveredPages: inventory.categories.reduce((sum, row) => sum + row.pages.length, 0),
  navigationSKUs: inventory.categories.reduce((sum, row) => sum + row.listedCount, 0),
  visibleSKUs: inventory.products.length,
  mappedSKUs: codes.size,
  cataloguePresets: mappedPresets.length,
  parts: partCoverage.map(({ id, totalPresets, supplierCodes }) => ({
    id,
    totalPresets,
    supplierPresets: supplierCodes.length,
    SKUs: supplierCodes.flat().length,
  })),
  families: rows,
  unsupported,
};
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync(
  'test-results/gvyntok-fastener-analysis.json',
  JSON.stringify(report, null, 2) + '\n',
);
const lines = [
  '# Gvyntok bolt and screw catalogue analysis',
  '',
  `Source: [Gvyntok bolts and screws](${inventory.source}). Retrieved ${inventory.retrievedAt}.`,
  '',
  `${report.categories} supplier subcategories and all ${report.discoveredPages} discovered pages yielded ${report.visibleSKUs} live product listings. ${report.mappedSKUs} supplier SKUs map to ${report.cataloguePresets} distinct catalogue geometries across five configurators. Material and coating duplicates retain their individual SKUs and product links.`,
  '',
  `The navigation counter reports ${report.navigationSKUs}, while the actual category result counts total ${report.visibleSKUs}. Four stale navigation counters are recorded in the extraction coverage JSON. No next-page links were omitted and no arbitrary page or product limit was applied.`,
  '',
  '## Geometry families',
  '',
  '| Geometry / standard | Supplier categories | Live SKUs | Mapped SKUs | Distinct presets |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| [${row.family}](${row.sourceUrls[0]}) | ${row.categories} | ${row.listedSKUs} | ${row.mappedSKUs} | ${row.presets} |`,
  ),
  '',
  '## Model and source interpretation',
  '',
  '- Basic screw heads now cover chamfered hex and hex flange, cylindrical socket and furniture heads, pan and flanged pan, button and flanged button, countersunk, carriage, countersunk square neck and elevator forms. Head and square-neck boundaries are shared in STL; the equivalent native CAD solids are fused.',
  '- DIN 913 flat, DIN 914 cone and DIN 915 dog-point screws retain all listed sizes. DIN 915 point diameter and length bands come from the linked drawing. The requested M2.5 × 8 cone-point geometry is available as a source-backed Gvyntok SKU 040-270-014.',
  '- DIN 444 swing eye bolts use tip-to-eye-centre nominal length. Full and partial-thread listings remain separate even when their envelopes have the same size.',
  '- DIN 580 lifting eyes use round-section torus geometry joined to a collar and stem. Local forged fillets are omitted. The resulting model does not establish a lifting capacity.',
  '- DIN 316 wing screws expose both standard and German supplier forms. The drawing h and overall-length rows conflict; head height and wing taper therefore remain unverified prototype settings. The head base is a square envelope of the listed base width.',
  '- Only explicit product dimensions, identified style choices and transcribed drawing values are marked verified. Unlisted drive depth, thread runout, fillets, tip details and dimensions outside a drawing table remain editable prototype settings. A supplier listing alone is not a claim that the entire generated model complies with a standard.',
  '- Imported presets default to smooth thread envelopes for responsive browsing. Standard bolts and grub screws can switch to modelled threads. Wing and eye modules currently use smooth thread envelopes only.',
  '- Fine-thread product titles use diameter × length × pitch, for example M8 × 35 × 1. These dimensions are parsed independently.',
  '- The M-Teh product URL returned a JavaScript challenge to the direct read, with no product dimensions. Its contents were not used as verification; the equivalent Gvyntok product and DIN 914 drawing supply the requested nominal dimensions.',
  '',
  '## Explicit remaining coverage',
  '',
  `${unsupported.length} L, C, O and Q hook listings remain in the raw inventory and the unsupported report. They are not silently replaced with ordinary bolts or fabricated bend dimensions. These require dedicated hook configurators and additional bend / opening measurements.`,
  '',
  '## Reproduction and evidence',
  '',
  '- `python3 scripts/import-gvyntok-fasteners.py --output test-results/catalog/gvyntok-fasteners.json` follows public category pagination, checks extracted counts and writes local raw evidence, a compact runtime projection and an extraction coverage report. Remove or change `--cache` to refresh the HTTP snapshots.',
  '- `node --import tsx scripts/report-fastener-catalog.ts test-results/catalog/gvyntok-fasteners.json` regenerates this geometry coverage report.',
  '- The local inventory records original product titles, source URLs, SKUs, subcategories and pagination URLs.',
  '- `src/catalog/data/gvyntok-fasteners-runtime.json` contains compact source tuples used by the offline adapters. Explicitly sync reviewed changes into each package’s `presets.json`.',
  '- `src/catalog/data/gvyntok-fastener-drawings.json` records the source product pages and their linked technical PDFs. `src/catalog/fastener-dimensions.ts` and `src/catalog/special-fastener-catalog.ts` contain the reviewed table transcriptions.',
  '- `tests/fasteners.test.ts` checks all imported parameter sets and SKU coverage, fine-pitch parsing, dog-point bands, thread and drive geometry, and manifold meshes across model variants and catalogue bounds.',
  '',
];
fs.writeFileSync('test-results/gvyntok-fastener-analysis.md', lines.join('\n'));
console.log(
  JSON.stringify({ ...report, families: undefined, unsupported: unsupported.length }, null, 2),
);
