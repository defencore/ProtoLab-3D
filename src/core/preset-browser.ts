import { presetMatchesConfiguration } from './catalog-models';
import {
  getFilterFields,
  matchesPresetPartScope,
  type PresetEntry,
  type PresetFilterField,
  type PresetFilters,
} from './preset-search';
import type { Parameters, PartDefinition } from './types';

export const PRESET_BROWSER_PAGE_SIZE = 12;

function partsInScope(parts: PartDefinition[], category: string, partId: string) {
  return parts.filter(
    (part) => (!category || part.category === category) && matchesPresetPartScope(part, partId),
  );
}

/** Field labels and prominence depend on the selected physical part or browse family. */
export function presetBrowserScope(parts: PartDefinition[], category: string, partId: string) {
  const scopeParts = partsInScope(parts, category, partId);
  const groupedScope = !!partId && scopeParts.some((part) => part.browseFamily?.id === partId);
  const broadScope = !partId && scopeParts.length > 1;
  const labels: Record<string, string> = {
    bore: 'Bore diameter',
    outer: 'Outside diameter',
    diameter: 'Nominal diameter',
    length: 'Length',
    width: 'Width',
    height: 'Height',
  };
  const available = getFilterFields(scopeParts);
  const separateBodyLengths =
    groupedScope && available.some((field) => field.key === 'catalogBodyLength');
  const fields = available.map((field) => {
    if (separateBodyLengths && field.key === 'length')
      return { ...field, label: 'Plain spacer / sleeve length' };
    if (separateBodyLengths && field.key === 'catalogBodyLength')
      return { ...field, label: 'Catalog body length' };
    return broadScope && labels[field.key] ? { ...field, label: labels[field.key] } : field;
  });
  const commonBearingScope = category === 'BEARINGS & SEALS' && broadScope;
  const isPrimary = (field: PresetFilterField) =>
    groupedScope
      ? field.primary || field.catalogSummary === true
      : commonBearingScope
        ? ['bore', 'outer', 'width'].includes(field.key)
        : !category
          ? ['bore', 'diameter', 'length', 'width', 'height'].includes(field.key)
          : field.primary;

  return {
    scopeParts,
    broadScope,
    fields,
    primaryFields: fields.filter(isPrimary),
    additionalFields: fields.filter((field) => !isPrimary(field)),
  };
}

/** Changing scope retains only filters that can still be satisfied in that scope. */
export function changePresetBrowserScope(
  parts: PartDefinition[],
  filters: PresetFilters,
  category: string,
  partId: string,
): PresetFilters {
  const nextParts = partsInScope(parts, category, partId);
  const available = new Set(getFilterFields(nextParts).map((field) => field.id));
  return {
    ...filters,
    category,
    partId,
    sourceName: nextParts.some((part) =>
      part.presets.some((preset) => preset.catalog?.sourceName === filters.sourceName),
    )
      ? filters.sourceName
      : '',
    manufacturer: nextParts.some((part) =>
      part.presets.some((preset) => preset.catalog?.manufacturer === filters.manufacturer),
    )
      ? filters.manufacturer
      : '',
    parameters: Object.fromEntries(
      Object.entries(filters.parameters).filter(([id]) => available.has(id)),
    ),
  };
}

/** Filtering never replaces the configuration currently shown in the model preview. */
export function presetBrowserSelection(
  index: PresetEntry[],
  results: PresetEntry[],
  currentPart: PartDefinition,
  currentParameters: Parameters,
  currentPresetId: string,
) {
  const selected = index.find(
    (entry) =>
      entry.part.id === currentPart.id &&
      entry.preset.id === currentPresetId &&
      presetMatchesConfiguration(currentPart, entry.preset, currentParameters),
  );
  const reviewParameters: Parameters = selected?.part.catalogSelectionOnly
    ? currentParameters
    : (selected?.preset.parameters ?? {});
  return {
    selected,
    selectedId: selected?.id ?? '',
    selectedOutsideResults: selected && !results.some((entry) => entry.id === selected.id),
    reviewParameters,
    reviewValues: { ...reviewParameters, ...selected?.preset.catalog?.attributes },
  };
}

export function presetBrowserPage(items: PresetEntry[], page: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PRESET_BROWSER_PAGE_SIZE));
  const displayedPage = Math.min(page, pageCount - 1);
  return {
    pageCount,
    displayedPage,
    visibleItems: items.slice(
      displayedPage * PRESET_BROWSER_PAGE_SIZE,
      (displayedPage + 1) * PRESET_BROWSER_PAGE_SIZE,
    ),
    hasPages: items.length > PRESET_BROWSER_PAGE_SIZE,
  };
}
