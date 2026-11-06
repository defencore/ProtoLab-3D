import { isPublishedValue, presetValue } from './catalog-models';
import type { PresetEntry } from './preset-search';
import type { CatalogSortOption } from './types';

/** Unknown dimensions stay last; an illustrative preview size cannot determine catalog order. */
export function sortPresetEntries(
  entries: readonly PresetEntry[],
  option?: CatalogSortOption,
): PresetEntry[] {
  if (!option) return [...entries];
  const value = (entry: PresetEntry): number | undefined => {
    const keys = option.productOf ?? [option.key];
    if (!keys.length) return undefined;
    let result = 1;
    for (const key of keys) {
      if (entry.preset.catalog && !isPublishedValue(entry.preset, key)) return undefined;
      const dimension = presetValue(entry.preset, key);
      if (typeof dimension !== 'number' || !Number.isFinite(dimension)) return undefined;
      result *= dimension;
    }
    return Number.isFinite(result) ? result : undefined;
  };
  const measured = entries.map((entry) => ({ entry, value: value(entry) }));
  measured.sort((a, b) => {
    if (a.value === undefined || b.value === undefined)
      return Number(a.value === undefined) - Number(b.value === undefined);
    const difference = option.direction === 'asc' ? a.value - b.value : b.value - a.value;
    return (
      difference || a.entry.preset.name.localeCompare(b.entry.preset.name, 'en', { numeric: true })
    );
  });
  return measured.map(({ entry }) => entry);
}
