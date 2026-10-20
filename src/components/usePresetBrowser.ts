import { useMemo } from 'react';
import { groupBrowseFamilies } from '../core/browse-families';
import { libraryCategories, sortLibraryParts } from '../core/library';
import { libraryArea, libraryAreas } from '../core/library-navigation';
import {
  presetBrowserPage,
  presetBrowserScope,
  presetBrowserSelection,
} from '../core/preset-browser';
import {
  buildPresetIndex,
  filterPresets,
  isActiveParameterFilter,
  presetFacetOptions,
  type PresetFilters,
} from '../core/preset-search';
import type { Parameters, PartDefinition } from '../core/types';

const sortedUnique = (values: (string | undefined)[]) =>
  [...new Set(values.filter((value): value is string => !!value))].sort();

/** Derive browsing data separately from the dock's controls and local presentation state. */
export function usePresetBrowser({
  parts,
  currentPart,
  currentParameters,
  currentPresetId,
  filters,
  showFilters,
  page,
}: {
  parts: PartDefinition[];
  currentPart: PartDefinition;
  currentParameters: Parameters;
  currentPresetId: string;
  filters: PresetFilters;
  showFilters: boolean;
  page: number;
}) {
  const orderedParts = useMemo(() => sortLibraryParts(parts), [parts]);
  const index = useMemo(() => buildPresetIndex(orderedParts), [orderedParts]);
  const scope = useMemo(
    () => presetBrowserScope(parts, filters.category, filters.partId),
    [parts, filters.category, filters.partId],
  );
  const { scopeParts, broadScope, primaryFields, fields } = scope;
  const renderedFilterFields = useMemo(
    () => (showFilters ? (broadScope ? primaryFields : fields) : []),
    [showFilters, broadScope, primaryFields, fields],
  );
  const results = useMemo(() => filterPresets(index, filters), [index, filters]);
  const selection = useMemo(
    () =>
      presetBrowserSelection(index, results.items, currentPart, currentParameters, currentPresetId),
    [index, results.items, currentPart, currentParameters, currentPresetId],
  );
  const categoryCollections = useMemo(() => {
    const categories = libraryCategories(orderedParts);
    return libraryAreas
      .map((area) => ({
        ...area,
        categories: categories.filter((category) => libraryArea(category) === area.id),
      }))
      .filter((area) => area.categories.length > 0);
  }, [orderedParts]);
  const categoryFamilies = useMemo(
    () =>
      groupBrowseFamilies(
        orderedParts.filter((part) => !filters.category || part.category === filters.category),
      ),
    [orderedParts, filters.category],
  );
  const scopeEntries = useMemo(
    () => index.filter((entry) => scopeParts.some((part) => part.id === entry.part.id)),
    [index, scopeParts],
  );
  const facetOptions = useMemo(
    () =>
      new Map(
        renderedFilterFields
          .filter((field) => field.type !== 'number')
          .map((field) => [field.id, presetFacetOptions(scopeEntries, filters, field)]),
      ),
    [scopeEntries, filters, renderedFilterFields],
  );
  const sources = useMemo(
    () => sortedUnique(scopeEntries.map((entry) => entry.preset.catalog?.sourceName)),
    [scopeEntries],
  );
  const manufacturers = useMemo(
    () => sortedUnique(scopeEntries.map((entry) => entry.preset.catalog?.manufacturer)),
    [scopeEntries],
  );
  const pagination = useMemo(() => presetBrowserPage(results.items, page), [results.items, page]);
  const activeParameters = Object.entries(filters.parameters).filter(([, filter]) =>
    isActiveParameterFilter(filter),
  );
  const activeCount =
    activeParameters.length +
    Number(!!filters.query) +
    Number(!!filters.sourceName) +
    Number(!!filters.manufacturer) +
    Number(filters.kind !== 'all');

  return {
    ...scope,
    ...selection,
    ...pagination,
    results,
    categoryCollections,
    categoryFamilies,
    facetOptions,
    sources,
    manufacturers,
    activeParameters,
    activeCount,
  };
}
