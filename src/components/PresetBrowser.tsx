import { useEffect, useRef, useState } from 'react';
import { ReferenceSpecifications } from './ReferenceSpecifications';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PackageSearch,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Parameters, PartDefinition, Preset } from '../core/types';
import { libraryLabel } from '../core/library-navigation';
import { changePresetBrowserScope } from '../core/preset-browser';
import { usePresetBrowser } from './usePresetBrowser';
import { isPublishedValue, presetValue, searchableFields } from '../core/catalog-models';
import {
  emptyPresetFilters,
  fieldId,
  formatPresetValue,
  formatPresetRange,
  getPresetParameterRange,
  isActiveParameterFilter,
  seedCurrentFilters,
  type ParameterFilter,
  type PresetEntry,
  type PresetFilterField,
  type PresetFilters,
} from '../core/preset-search';
import './PresetBrowser.css';
import NumericRangeFilter from './NumericRangeFilter';
import FilterChips, { type FilterChip } from './FilterChips';
import './NumericRangeFilter.css';
import { parseNumericRange } from '../core/numeric-range';

export interface PresetBrowserProps {
  parts: PartDefinition[];
  currentPart: PartDefinition;
  currentParameters: Parameters;
  currentPresetId: string;
  initialMode?: 'all' | 'browse' | 'match';
  filters: PresetFilters;
  onFiltersChange: (filters: PresetFilters) => void;
  onApply: (part: PartDefinition, preset: Preset) => void;
  onClose: () => void;
}

function DimensionSummary({ entry }: { entry: PresetEntry }) {
  const primary = entry.part.presetMatchKeys ?? ['bore', 'outer', 'width', 'diameter', 'length'];
  const fields = searchableFields(entry.part)
    .filter(
      (field) =>
        field.type === 'number' &&
        (!field.visibleWhen || field.visibleWhen(entry.preset.parameters)) &&
        (entry.preset.catalog
          ? isPublishedValue(entry.preset, field.key) ||
            !!getPresetParameterRange(entry.preset, field.key)
          : (entry.part.presetMatchKeys?.includes(field.key) ??
            [
              'bore',
              'outer',
              'width',
              'diameter',
              'length',
              'height',
              'thickness',
              'module',
              'teeth',
            ].includes(field.key))),
    )
    .sort((a, b) => {
      const aOrder = primary.indexOf(a.key);
      const bOrder = primary.indexOf(b.key);
      return (aOrder < 0 ? primary.length : aOrder) - (bOrder < 0 ? primary.length : bOrder);
    });
  const rangeFields = fields.filter((field) => getPresetParameterRange(entry.preset, field.key));
  const displayedFields = fields.filter((field, index) => index < 4 || rangeFields.includes(field));
  return (
    <>
      <div className="pb-dimensions">
        {displayedFields.map((field) => {
          const range = getPresetParameterRange(entry.preset, field.key);
          return (
            <span
              key={field.key}
              title={
                range
                  ? `${field.label}: source range; preset value ${formatPresetValue(field, presetValue(entry.preset, field.key))}`
                  : field.label
              }
            >
              <small>{field.symbol ?? field.label}</small>
              {range
                ? `${formatPresetRange(field, range)} range`
                : formatPresetValue(field, presetValue(entry.preset, field.key))}
            </span>
          );
        })}
      </div>
      {rangeFields.length > 0 && (
        <p className="pb-result-description">
          Preset values:{' '}
          {rangeFields
            .map(
              (field) =>
                `${field.label} ${formatPresetValue(field, entry.preset.parameters[field.key])}`,
            )
            .join(' · ')}
        </p>
      )}
    </>
  );
}

function FilterField({
  field,
  filter,
  currentValue,
  error,
  options,
  onChange,
}: {
  field: PresetFilterField;
  filter: ParameterFilter;
  currentValue?: number | string | boolean;
  error?: string;
  options: { value: string; label: string; count: number }[];
  onChange: (value: ParameterFilter) => void;
}) {
  const inputId = `preset-filter-${encodeURIComponent(field.id)}`;
  const active = isActiveParameterFilter(filter);
  return (
    <div className={`pb-filter-field ${active ? 'has-filter' : ''}`}>
      <div className="pb-filter-label">
        <label htmlFor={field.type === 'number' ? `${inputId}-min` : `${inputId}-select`}>
          {field.label}
          {field.type === 'number' && <small>{field.unit ?? 'mm'}</small>}
        </label>
        {active && (
          <button
            type="button"
            className="pb-clear-field"
            aria-label={`Clear ${field.label} filter`}
            onClick={() => onChange({})}
          >
            <X size={12} />
          </button>
        )}
      </div>
      {field.type === 'number' ? (
        <NumericRangeFilter
          id={inputId}
          className="pb-range"
          label={field.label}
          value={filter}
          error={error}
          minLabel={`${field.label} from`}
          maxLabel={`${field.label} to`}
          onChange={onChange}
        />
      ) : (
        <select
          id={`${inputId}-select`}
          aria-label={`${field.label} filter`}
          value={filter.value ?? ''}
          onChange={(event) => onChange({ value: event.target.value })}
        >
          <option value="">Any {field.label.toLowerCase()}</option>
          {options.map((option) => (
            <option
              value={option.value}
              key={option.value}
              disabled={!option.count && option.value !== filter.value?.trim()}
            >
              {option.label} · {option.count.toLocaleString('en-US')}
            </option>
          ))}
        </select>
      )}
      {error && field.type !== 'number' && (
        <p className="pb-field-error" role="alert">
          {error}
        </p>
      )}
      {currentValue !== undefined &&
        (typeof currentValue !== 'number' || Number.isFinite(currentValue)) && (
          <button
            className="pb-use-value"
            type="button"
            onClick={() =>
              onChange(
                field.type === 'number'
                  ? { min: String(currentValue), max: String(currentValue) }
                  : { value: String(currentValue) },
              )
            }
          >
            Use current: {formatPresetValue(field, currentValue)}
          </button>
        )}
    </div>
  );
}

export default function PresetBrowser({
  parts,
  currentPart,
  currentParameters,
  currentPresetId,
  initialMode = 'browse',
  filters,
  onFiltersChange: setFilters,
  onApply,
  onClose,
}: PresetBrowserProps) {
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(
    initialMode === 'match' ||
      Object.values(filters.parameters).some(isActiveParameterFilter) ||
      !!filters.sourceName ||
      !!filters.manufacturer,
  );
  const searchInput = useRef<HTMLInputElement>(null);
  const {
    broadScope,
    fields,
    primaryFields,
    additionalFields,
    results,
    selected,
    selectedId,
    selectedOutsideResults,
    reviewParameters,
    reviewValues,
    categoryCollections,
    categoryFamilies,
    facetOptions,
    sources,
    manufacturers,
    pageCount,
    displayedPage,
    visibleItems,
    hasPages,
    activeParameters,
    activeCount,
  } = usePresetBrowser({
    parts,
    currentPart,
    currentParameters,
    currentPresetId,
    filters,
    showFilters,
    page,
  });
  useEffect(() => {
    setPage(0);
  }, [filters]);
  useEffect(() => {
    searchInput.current?.focus();
  }, []);

  function setScope(category: string, partId: string) {
    setFilters(changePresetBrowserScope(parts, filters, category, partId));
  }

  function updateParameter(id: string, value: ParameterFilter) {
    const parameters = { ...filters.parameters };
    if (isActiveParameterFilter(value)) parameters[id] = value;
    else delete parameters[id];
    setFilters({ ...filters, parameters });
  }

  function renderField(field: PresetFilterField) {
    const currentDefinition = searchableFields(currentPart).find(
      (candidate) => fieldId(candidate) === field.id,
    );
    const currentValue =
      currentDefinition &&
      (!currentDefinition.visibleWhen || currentDefinition.visibleWhen(currentParameters))
        ? (selected?.preset.catalog?.attributes?.[field.key] ?? currentParameters[field.key])
        : undefined;
    return (
      <FilterField
        key={field.id}
        field={field}
        filter={filters.parameters[field.id] ?? {}}
        currentValue={currentValue}
        error={results.errors.find((error) => error.fieldId === field.id)?.message}
        options={facetOptions.get(field.id) ?? []}
        onChange={(value) => updateParameter(field.id, value)}
      />
    );
  }

  const chips: FilterChip[] = [];
  if (filters.query.trim())
    chips.push({
      id: 'query',
      label: `Search: ${filters.query}`,
      removeLabel: 'Clear preset search',
      onRemove: () => setFilters({ ...filters, query: '' }),
    });
  if (filters.kind !== 'all')
    chips.push({
      id: 'kind',
      label: filters.kind === 'catalog' ? 'Sourced catalog' : 'Prototype examples',
      removeLabel: 'Clear preset library filter',
      onRemove: () => setFilters({ ...filters, kind: 'all' }),
    });
  if (filters.sourceName)
    chips.push({
      id: 'source',
      label: filters.sourceName,
      removeLabel: 'Clear preset source filter',
      onRemove: () => setFilters({ ...filters, sourceName: '' }),
    });
  if (filters.manufacturer)
    chips.push({
      id: 'manufacturer',
      label: filters.manufacturer,
      removeLabel: 'Clear preset manufacturer filter',
      onRemove: () => setFilters({ ...filters, manufacturer: '' }),
    });
  for (const [id, filter] of activeParameters) {
    const field = fields.find((candidate) => candidate.id === id);
    const range = parseNumericRange(filter);
    const label = field?.label ?? 'Unavailable parameter';
    const text =
      field?.type === 'number'
        ? (!range.errors.length &&
          range.range.min !== undefined &&
          range.range.min === range.range.max
            ? filter.min
            : `${filter.min?.trim() || '…'}–${filter.max?.trim() || '…'}`) +
          (field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`)
        : (field?.options?.find((option) => option.value === filter.value)?.label ??
          (filter.value === 'true' ? 'Yes' : filter.value === 'false' ? 'No' : filter.value));
    chips.push({
      id,
      label: `${label}: ${text}`,
      removeLabel: `Clear ${label.toLowerCase()} filter`,
      onRemove: () => updateParameter(id, {}),
    });
  }
  return (
    <aside className="preset-dock" aria-label="Advanced preset browser">
      <div className="preset-dock-heading">
        <div>
          <h2>Browse presets</h2>
          <p>Select a result to preview it in 3D.</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close preset browser">
          <X size={18} />
        </button>
      </div>
      <div className="preset-browser">
        <div className="pb-search-row">
          <div className="pb-search">
            <Search size={18} />
            <input
              autoFocus
              ref={searchInput}
              type="search"
              aria-label="Search presets"
              placeholder="Designation, SKU, standard, manufacturer…"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </div>
          <button
            className="secondary-button pb-match-button"
            onClick={() => {
              setFilters(seedCurrentFilters(currentPart, currentParameters));
              setShowFilters(true);
            }}
            title="Match the main dimensions and types from your current configuration"
          >
            <SlidersHorizontal size={15} />
            Match current
          </button>
        </div>
        <div className="pb-scope">
          <label>
            Category
            <select
              aria-label="Preset category"
              value={filters.category}
              onChange={(event) => setScope(event.target.value, '')}
            >
              <option value="">All categories</option>
              {categoryCollections.map((area) => (
                <optgroup key={area.id} label={area.label}>
                  {area.categories.map((category) => (
                    <option key={category} value={category}>
                      {libraryLabel(category)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Part type
            <select
              aria-label="Preset part type"
              value={filters.partId}
              onChange={(event) => setScope(filters.category, event.target.value)}
            >
              <option value="">All types in category</option>
              {categoryFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preset library
            <select
              aria-label="Preset library"
              value={filters.kind}
              onChange={(event) =>
                setFilters({ ...filters, kind: event.target.value as PresetFilters['kind'] })
              }
            >
              <option value="all">Catalog & examples</option>
              <option value="catalog">Sourced catalog dimensions</option>
              <option value="examples">Prototype examples</option>
            </select>
          </label>
        </div>
        <div className="pb-filter-toolbar">
          <button
            className={`pb-filter-toggle ${showFilters ? 'active' : ''}`}
            aria-expanded={showFilters}
            aria-controls="preset-filter-panel"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={14} />
            Filters{activeCount > 0 && <span>{activeCount}</span>}
            <ChevronDown size={14} />
          </button>
          <p>Ranges include both ends. Leave either end blank.</p>
          <button
            className="pb-reset"
            onClick={() =>
              setFilters(emptyPresetFilters(initialMode === 'all' ? undefined : currentPart))
            }
            title="Clear preset filters"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
        <FilterChips label="Active preset filters" items={chips} />
        <div className={`pb-workspace ${showFilters ? 'with-filters' : ''}`}>
          {showFilters && (
            <aside className="pb-filters" id="preset-filter-panel" aria-label="Preset filters">
              <div className="pb-sidebar-title">
                <span>PARAMETERS</span>
                <small>Optional filters</small>
              </div>
              <div className="pb-primary-fields">{primaryFields.map(renderField)}</div>
              {additionalFields.length > 0 && !broadScope && (
                <details className="pb-more-fields">
                  <summary>
                    More parameters <span>{additionalFields.length}</span>
                  </summary>
                  {additionalFields.map(renderField)}
                </details>
              )}
              {broadScope && (
                <p className="pb-field-hint">
                  Select a part type for additional dimensions and shape filters.
                </p>
              )}
              {(sources.length > 0 || manufacturers.length > 0) && (
                <div className="pb-provenance-filters">
                  <div className="pb-sidebar-title">
                    <span>SOURCE</span>
                  </div>
                  {sources.length > 0 && (
                    <label>
                      Supplier / source
                      <select
                        aria-label="Preset source"
                        value={filters.sourceName}
                        onChange={(event) =>
                          setFilters({ ...filters, sourceName: event.target.value })
                        }
                      >
                        <option value="">Any source</option>
                        {sources.map((source) => (
                          <option key={source}>{source}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {manufacturers.length > 0 && (
                    <label>
                      Manufacturer
                      <select
                        aria-label="Preset manufacturer"
                        value={filters.manufacturer}
                        onChange={(event) =>
                          setFilters({ ...filters, manufacturer: event.target.value })
                        }
                      >
                        <option value="">Any manufacturer</option>
                        {manufacturers.map((manufacturer) => (
                          <option key={manufacturer}>{manufacturer}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              <p className="pb-filter-note">
                Catalog size filters use dimensions recorded from the linked source. A source range
                matches any overlapping size. Unlisted internal dimensions are not matched.
              </p>
            </aside>
          )}
          <section className="pb-results" aria-label="Preset results">
            <div className="pb-results-heading">
              <strong role="status" aria-live="polite">
                {results.items.length} {results.items.length === 1 ? 'preset' : 'presets'} found
              </strong>
              <span>
                {selectedOutsideResults
                  ? 'Current preview outside results'
                  : selected
                    ? 'Shown in 3D'
                    : 'Select to preview'}
              </span>
            </div>
            {results.errors.length > 0 ? (
              <div className="pb-empty">
                <SlidersHorizontal size={30} />
                <h3>Check your ranges</h3>
                {results.errors.map((error) => (
                  <p key={error.fieldId}>{error.message}</p>
                ))}
                <button className="secondary-button" onClick={() => setShowFilters(true)}>
                  Show filters
                </button>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="pb-empty">
                <PackageSearch size={36} />
                <h3>No matching presets</h3>
                <p>Try a wider range, remove a condition, or search other part types.</p>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setFilters({
                        ...emptyPresetFilters(),
                        category: filters.category,
                        partId: filters.partId,
                      })
                    }
                  >
                    Clear filters
                  </button>
                  {filters.partId && (
                    <button
                      className="pb-text-button"
                      onClick={() => setScope(filters.category, '')}
                    >
                      Search all types in category <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="pb-result-grid">
                {visibleItems.map((entry) => (
                  <article
                    key={entry.id}
                    className={`pb-result ${entry.id === selectedId ? 'selected' : ''}`}
                  >
                    <button
                      className="pb-result-select"
                      aria-label={`Preview ${entry.preset.name}, ${entry.part.name}`}
                      aria-pressed={entry.id === selectedId}
                      onClick={() => {
                        onApply(entry.part, entry.preset);
                      }}
                    >
                      <div className="pb-result-top">
                        <span className={`pb-kind ${entry.preset.catalog ? 'pb-catalog' : ''}`}>
                          {entry.preset.catalog
                            ? entry.preset.catalog.sourceKind === 'attachment'
                              ? 'Reference dimensions'
                              : 'Catalog dimensions'
                            : 'Prototype example'}
                        </span>
                        <span className="pb-selection-dot">
                          {entry.id === selectedId && <Check size={12} />}
                        </span>
                      </div>
                      <h3>{entry.preset.catalog?.designation ?? entry.preset.name}</h3>
                      {entry.preset.catalog &&
                        entry.preset.name !== entry.preset.catalog.designation && (
                          <p className="pb-result-name">{entry.preset.name}</p>
                        )}
                      <p className="pb-part-name">
                        {entry.part.name}
                        {entry.preset.catalog?.manufacturer &&
                          ` · ${entry.preset.catalog.manufacturer}`}
                      </p>
                      <DimensionSummary entry={entry} />
                      {(entry.preset.catalog?.productCodes?.length ?? 0) > 1 && (
                        <p className="pb-result-description">
                          {entry.preset.catalog!.productCodes!.length} supplier SKUs · one geometry
                        </p>
                      )}
                      {!entry.preset.catalog && (
                        <p className="pb-result-description">{entry.preset.description}</p>
                      )}
                    </button>
                    {entry.preset.catalog?.sourceUrl && (
                      <a
                        className="pb-source-link"
                        href={entry.preset.catalog.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {entry.preset.catalog.sourceName}
                        <ExternalLink size={11} />
                        <span className="sr-only"> (opens source in a new tab)</span>
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
            {hasPages && (
              <nav className="pb-pagination" aria-label="Preset result pages">
                <button
                  className="icon-button"
                  aria-label="Previous preset page"
                  disabled={displayedPage === 0}
                  onClick={() => setPage(displayedPage - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  Page {displayedPage + 1} of {pageCount}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next preset page"
                  disabled={displayedPage + 1 >= pageCount}
                  onClick={() => setPage(displayedPage + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </nav>
            )}
          </section>
        </div>
        <div className="pb-review" aria-label="Selected preset review">
          {selected ? (
            <>
              <div className="pb-review-info">
                <span className="pb-review-eyebrow">CURRENT PREVIEW</span>
                {selectedOutsideResults && (
                  <p className="pb-current-excluded" role="status">
                    This article is outside your filters. The preview stays unchanged until you
                    select a result.
                  </p>
                )}
                <strong>{selected.preset.name}</strong>
                <p>
                  {selected.part.name} · {selected.preset.description}
                </p>
                {selected.preset.catalog?.productCodes?.length ? (
                  <details className="pb-review-parameters">
                    <summary>
                      Supplier product codes ({selected.preset.catalog.productCodes.length})
                    </summary>
                    <p>{selected.preset.catalog.productCodes.join(', ')}</p>
                  </details>
                ) : null}
                {selected.preset.catalog?.alternateSourceUrls?.length ? (
                  <details className="pb-review-parameters">
                    <summary>Reference drawings and listings</summary>
                    <div className="pb-reference-links">
                      {[...new Set(selected.preset.catalog.alternateSourceUrls)].map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          {url.startsWith('https:') ? new URL(url).hostname : 'Attached reference'}{' '}
                          ·{' '}
                          {decodeURIComponent(
                            new URL(url, 'https://reference.local/').pathname
                              .split('/')
                              .filter(Boolean)
                              .at(-1) ?? 'Reference',
                          )}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </details>
                ) : null}
                <details className="pb-review-parameters">
                  <summary>Review all parameters</summary>
                  <dl>
                    {searchableFields(selected.part)
                      .filter((field) => !field.visibleWhen || field.visibleWhen(reviewParameters))
                      .map((field) => (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>
                            {formatPresetValue(field, reviewValues[field.key])}
                            {selected.preset.catalog?.attributeConditions?.[field.key] && (
                              <small>
                                {' '}
                                · {selected.preset.catalog.attributeConditions[field.key]}
                              </small>
                            )}
                            {getPresetParameterRange(selected.preset, field.key) && (
                              <>
                                {' '}
                                preset · source range{' '}
                                {formatPresetRange(
                                  field,
                                  getPresetParameterRange(selected.preset, field.key)!,
                                )}
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
                <ReferenceSpecifications catalog={selected.preset.catalog} />
                {selected.preset.catalog && (
                  <p className="pb-verified">
                    Sourced parameters:{' '}
                    {searchableFields(selected.part)
                      .filter(
                        (field) =>
                          isPublishedValue(selected.preset, field.key) ||
                          !!getPresetParameterRange(selected.preset, field.key),
                      )
                      .map(
                        (field) =>
                          `${field.label} ${
                            getPresetParameterRange(selected.preset, field.key)
                              ? `${formatPresetRange(field, getPresetParameterRange(selected.preset, field.key)!)} range`
                              : formatPresetValue(field, presetValue(selected.preset, field.key))
                          }`,
                      )
                      .join(' · ')}
                    . Other geometry uses prototype settings.
                  </p>
                )}
              </div>
              <button className="primary-button" onClick={onClose}>
                Done
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <p>
                <PackageSearch size={17} />
                Choose a result to preview it in 3D.
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
