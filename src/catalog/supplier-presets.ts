import generated from './generated/promtehimport-presets.json';
import type { PartDefinition, Preset } from '../core/types';

const imported = generated as Record<string, Preset[]>;
const sourceKey = (preset: Preset) => {
  const url = preset.catalog?.sourceUrl ?? '';
  const supplierId = url.match(/promtehimport\.com\.ua\/(?:ru\/)?offer\/.*-o(\d+)\/?$/)?.[1];
  return supplierId ? `promtehimport:${supplierId}` : url;
};

/** Combine generated supplier rows with manually authored examples, deduplicating sources. */
export function withSupplierPresets(part: PartDefinition): PartDefinition {
  const additions = imported[part.id] ?? [];
  if (!additions.length) return part;
  const replacements = new Map(additions.map((preset) => [sourceKey(preset), preset]));
  const curatedUrls = new Set(part.presets.filter((preset) => preset.catalog).map(sourceKey));
  return {
    ...part,
    presets: [
      ...part.presets.map((preset) => {
        const replacement = preset.catalog ? replacements.get(sourceKey(preset)) : undefined;
        return replacement ? { ...replacement, id: preset.id } : preset;
      }),
      ...additions.filter((preset) => !curatedUrls.has(sourceKey(preset))),
    ],
  };
}
