/** Inventory every preset's evidence; this is not a metrology certificate. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parts } from '../src/parts';
import { presetEvidence } from '../src/core/model-evidence';
import { productKindLabels, supplyKindLabels } from '../src/core/product-library';
const counts: Record<string, number> = {};
const productCounts: Record<string, number> = {};
const missingReferences = new Set<string>();
const modules = parts.map((part) => {
  const classification = part.product.kind + '/' + part.product.supply;
  productCounts[classification] = (productCounts[classification] ?? 0) + 1;
  const presets = part.presets.map((preset) => {
    const evidence = presetEvidence(part, preset);
    counts[evidence.kind] = (counts[evidence.kind] ?? 0) + 1;
    const refs = [preset.catalog?.sourceUrl, ...(preset.catalog?.alternateSourceUrls ?? [])].filter(
      (s): s is string => !!s,
    );
    for (const ref of refs) {
      if (
        /^\/?references\//.test(ref) &&
        !existsSync(resolve('public', ref.replace(/^\//, '').split('#')[0]))
      )
        missingReferences.add(ref);
    }
    return {
      id: preset.id,
      kind: evidence.kind,
      source: evidence.source,
      verifiedParameters: evidence.verifiedParameters,
      unverifiedNumericParameters: part.parameters
        .filter((p) => p.type === 'number' && !evidence.verifiedParameters.includes(p.key))
        .map((p) => p.key),
      ...(preset.catalog?.geometryEvidence
        ? { geometryEvidence: preset.catalog.geometryEvidence }
        : {}),
    };
  });
  return { id: part.id, name: part.name, product: part.product, notes: part.notes, presets };
});
const report = {
  scope:
    'Metadata/evidence inventory of every registered preset. Source links and declared verified parameters do not establish full geometric accuracy. No claim that every remote page was re-read.',
  modules: modules.length,
  presets: modules.reduce((n, m) => n + m.presets.length, 0),
  counts,
  productCounts,
  missingLocalReferences: [...missingReferences].sort(),
  families: modules,
};
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/model-evidence-audit.json', JSON.stringify(report, null, 2) + '\n');
const lines = [
  '# Model fidelity audit',
  '',
  `Coverage: **${report.modules} families / ${report.presets} presets**. Regenerate with \`npm run audit:models\`.`,
  '',
  report.scope,
  '',
  'The generated `test-results/model-evidence-audit.json` lists every preset and its declared verified parameters. Unverified numeric fields also include pose controls and custom design choices; they are an evidence inventory, not automatically dimensional defects.',
  '',
  '## Product classifications',
  '',
  'Each family retains its reviewed package profile in the JSON audit. Product classification is independent of source fidelity and does not establish production approval.',
  '',
  '| Product type | Supply policy | Families |',
  '| --- | --- | ---: |',
  ...Object.entries(productCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [kind, supply] = key.split('/') as [
        keyof typeof productKindLabels,
        keyof typeof supplyKindLabels,
      ];
      return `| ${productKindLabels[kind]} | ${supplyKindLabels[supply]} | ${count} |`;
    }),
  '',
  '## Evidence classes',
  '',
  ...Object.entries(counts).map(([kind, n]) => `- ${kind}: ${n}`),
  '',
  'Manufacturer CAD means geometry is imported from an identified manufacturer source revision, with recorded exceptions. Community CAD means retained geometry from an identified community library revision, with an explicit source hash; it is not manufacturer-issued geometry. Neither imported CAD class certifies physical production tolerances or later product revisions. Source dimensions means a reconstruction with a limited set of published dimensions; model identity alone does not verify connector positions or every surface. Envelope models represent outside dimensions only. Parametric designs have no specific original to copy.',
  '',
  '## Remaining fidelity work',
  '',
  '- Bearing catalogs often confirm only bore, outside diameter and width. Ball/roller counts, raceways, cages, seals and locking details need manufacturer section drawings or CAD for each construction.',
  '- Fasteners use nominal/standard dimensions; thread tolerance classes, runouts, chamfers and manufacturer-specific head profiles remain outside complete source verification.',
  '- Gears, ball screws and linear guides need source tooth/raceway/recirculation geometry to certify internal detail; a valid mesh is insufficient.',
  '- Motors, servos, cameras and flight controllers retain their individual source limitations. Unspecified mounting depths, connectors and internal parts must not be inferred as exact.',
  '- Most electronics are packaging reconstructions. Source PCB dimensions do not verify port offsets, contact counts, component heights or board revision.',
  '- Generic springs, structures, solenoids and lifting surfaces are design tools, not copies of a particular supplier product.',
  '',
  '## Family-by-family limitations',
  '',
  '| Family | Presets | Manufacturer CAD | Community CAD | Sourced reconstruction / envelope | Parametric | Recorded limitations |',
  '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
];
const escape = (s: string) => s.replaceAll('|', '/').replaceAll('\n', ' ');
for (const m of modules) {
  const count = (k: string) => m.presets.filter((p) => p.kind === k).length;
  lines.push(
    `| ${escape(m.name)} | ${m.presets.length} | ${count('manufacturer-cad')} | ${count('community-cad')} | ${count('source-dimensions') + count('envelope')} | ${count('parametric')} | ${escape(m.notes ?? 'No detailed geometry audit recorded.')} |`,
  );
}
lines.push(
  '',
  '## Local source integrity',
  '',
  missingReferences.size
    ? [...missingReferences].map((r) => `- Missing: ${r}`).join('\n')
    : 'All locally linked preset reference assets exist.',
  '',
  'Full per-preset evidence and unverified numeric fields: JSON audit (local output: `test-results/model-evidence-audit.json`).',
);
writeFileSync('docs/model-fidelity-audit.md', lines.join('\n') + '\n');
console.log(JSON.stringify({ ...report, families: undefined }, null, 2));
