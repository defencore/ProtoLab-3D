import { translateSearchQuery } from './search-query';
import type { BrowseFamily } from './browse-families';
import {
  buildPresetIndex,
  compilePresetQuery,
  matchesPresetQuery,
  type PresetEntry,
} from './preset-search';
import {
  buildStandoffCatalog,
  filterStandoffs,
  isStandoffPart,
  type StandoffCatalogEntry,
} from './standoff-catalog';
import { productKindLabels, supplyKindLabels } from './product-library';

export interface LibrarySearchEntry {
  family: BrowseFamily;
  terminology: string;
  presets: PresetEntry[];
  standoffs?: StandoffCatalogEntry[];
}
export interface LibrarySearchMatch {
  family: BrowseFamily;
  articleQuery: string;
}
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Navigation text and individual articles are separate so two products cannot satisfy one size query. */
export function buildLibrarySearchIndex(families: BrowseFamily[]): LibrarySearchEntry[] {
  return families.map((family) => {
    const standoffs = family.grouped && family.members.every(isStandoffPart);
    return {
      family,
      terminology: normalize(
        [
          family.label,
          ...family.members.flatMap((part) => [
            part.name,
            part.category,
            part.subgroup,
            part.description,
            ...part.keywords,
            productKindLabels[part.product.kind],
            supplyKindLabels[part.product.supply],
            ...part.product.processes,
          ]),
        ].join(' '),
      ),
      presets: standoffs ? [] : buildPresetIndex(family.members),
      standoffs: standoffs ? buildStandoffCatalog(family.members) : undefined,
    };
  });
}

export function searchLibrary(index: LibrarySearchEntry[], query: string): LibrarySearchMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return index.map((entry) => ({ family: entry.family, articleQuery: '' }));
  const translated = translateSearchQuery(trimmed);
  const words = normalize(translated).split(/\s+/);
  const compiled = compilePresetQuery(trimmed);
  return index
    .flatMap((entry) => {
      const articleMatch = entry.standoffs
        ? filterStandoffs(entry.standoffs, { query: trimmed }).items.length > 0
        : entry.presets.some((preset) => matchesPresetQuery(preset, compiled));
      const terminologyMatch =
        !compiled.metricSize && words.every((word) => entry.terminology.includes(word));
      if (!articleMatch && !terminologyMatch) return [];
      const label = normalize(entry.family.label);
      const phrase = normalize(translated);
      const score =
        label === phrase
          ? 100
          : label.startsWith(phrase)
            ? 80
            : label.includes(phrase)
              ? 60
              : words.every((word) => label.includes(word))
                ? 40
                : articleMatch
                  ? 20
                  : 0;
      return [{ family: entry.family, articleQuery: articleMatch ? trimmed : '', score }];
    })
    .sort((a, b) => b.score - a.score)
    .map(({ family, articleQuery }) => ({ family, articleQuery }));
}
