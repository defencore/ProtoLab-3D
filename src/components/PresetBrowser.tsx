import { useEffect, useMemo, useRef, useState } from 'react';
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
import { libraryCategories, sortLibraryParts } from '../core/library';
import {
  isPublishedValue,
  presetMatchesConfiguration,
  presetValue,
  searchableFields,
} from '../core/catalog-models';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  formatPresetValue,
  formatPresetRange,
  getPresetParameterRange,
  getFilterFields,
  isActiveParameterFilter,
  seedCurrentFilters,
  type ParameterFilter,
  type PresetEntry,
  type PresetFilterField,
  type PresetFilters,
} from '../core/preset-search';
import './PresetBrowser.css';

export interface PresetBrowserProps {
  parts: PartDefinition[];
  currentPart: PartDefinition;
  currentParameters: Parameters;
  currentPresetId: string;
  initialMode?: 'all' | 'browse' | 'match';
  initialFilters?: PresetFilters;
  onApply: (part: PartDefinition, preset: Preset) => void;
  onClose: () => void;
}

const PAGE_SIZE = 12;
const sortedUnique = (values: (string | undefined)[]) =>
  [...new Set(values.filter((value): value is string => !!value))].sort();

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
  onChange,
}: {
  field: PresetFilterField;
  filter: ParameterFilter;
  currentValue?: number | string | boolean;
  error?: string;
  onChange: (value: ParameterFilter) => void;
}) {
  const inputId = `preset-filter-${encodeURIComponent(field.id)}`;
  const active = isActiveParameterFilter(filter);
  return (
    <div className={`pb-filter-field ${active ? 'has-filter' : ''}`}>
      <div className="pb-filter-label">
        <label htmlFor={`${inputId}-from`}>
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
        <div className="pb-range">
          <input
            id={`${inputId}-from`}
            type="number"
            step="any"
            placeholder="From"
            aria-label={`${field.label} from`}
            aria-invalid={!!error}
            value={filter.min ?? ''}
            onChange={(event) => onChange({ ...filter, min: event.target.value })}
          />
          <span>–</span>
          <input
            type="number"
            step="any"
            placeholder="To"
            aria-label={`${field.label} to`}
            aria-invalid={!!error}
            value={filter.max ?? ''}
            onChange={(event) => onChange({ ...filter, max: event.target.value })}
          />
        </div>
      ) : (
        <select
          id={`${inputId}-from`}
          aria-label={`${field.label} filter`}
          value={filter.value ?? ''}
          onChange={(event) => onChange({ value: event.target.value })}
        >
          <option value="">Any {field.label.toLowerCase()}</option>
          {field.type === 'boolean' ? (
            <>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </>
          ) : (
            field.options?.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
      )}
      {error && (
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
  initialFilters,
  onApply,
  onClose,
}: PresetBrowserProps) {
  const [filters, setFilters] = useState<PresetFilters>(
    () =>
      initialFilters ??
      (initialMode === 'match'
        ? seedCurrentFilters(currentPart, currentParameters)
        : emptyPresetFilters(initialMode === 'all' ? undefined : currentPart)),
  );
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(initialMode === 'match' || !!initialFilters);
  const searchInput = useRef<HTMLInputElement>(null);
  const orderedParts = useMemo(() => sortLibraryParts(parts), [parts]);
  const index = useMemo(() => buildPresetIndex(orderedParts), [orderedParts]);
  const scopeParts = useMemo(
    () =>
      parts.filter(
        (part) =>
          (!filters.category || part.category === filters.category) &&
          (!filters.partId || part.id === filters.partId),
      ),
    [parts, filters.category, filters.partId],
  );
  const fields = useMemo(() => {
    const labels: Record<string, string> = {
      bore: 'Bore diameter',
      outer: 'Outside diameter',
      diameter: 'Nominal diameter',
      length: 'Length',
      width: 'Width',
      height: 'Height',
    };
    return getFilterFields(scopeParts).map((field) =>
      scopeParts.length > 1 && labels[field.key] ? { ...field, label: labels[field.key] } : field,
    );
  }, [scopeParts]);
  const results = useMemo(() => filterPresets(index, filters), [index, filters]);
  const selected = results.items.find(
    (entry) =>
      entry.part.id === currentPart.id &&
      entry.preset.id === currentPresetId &&
      presetMatchesConfiguration(currentPart, entry.preset, currentParameters),
  );
  const reviewParameters: Parameters = selected?.part.catalogSelectionOnly
    ? currentParameters
    : (selected?.preset.parameters ?? {});
  const reviewValues: Parameters = {
    ...reviewParameters,
    ...selected?.preset.catalog?.attributes,
  };
  const selectedId = selected?.id ?? '';
  const categories = libraryCategories(orderedParts);
  const categoryParts = orderedParts.filter(
    (part) => !filters.category || part.category === filters.category,
  );
  const scopeEntries = index.filter((entry) =>
    scopeParts.some((part) => part.id === entry.part.id),
  );
  const sources = sortedUnique(scopeEntries.map((entry) => entry.preset.catalog?.sourceName));
  const manufacturers = sortedUnique(
    scopeEntries.map((entry) => entry.preset.catalog?.manufacturer),
  );
  const pageCount = Math.max(1, Math.ceil(results.items.length / PAGE_SIZE));
  const displayedPage = Math.min(page, pageCount - 1);
  const visibleItems = results.items.slice(
    displayedPage * PAGE_SIZE,
    (displayedPage + 1) * PAGE_SIZE,
  );
  const commonBearingScope = filters.category === 'BEARINGS & SEALS' && scopeParts.length > 1;
  const isPrimary = (field: PresetFilterField) =>
    commonBearingScope
      ? ['bore', 'outer', 'width'].includes(field.key)
      : !filters.category
        ? ['bore', 'diameter', 'length', 'width', 'height'].includes(field.key)
        : field.primary;
  const primaryFields = fields.filter(isPrimary);
  const additionalFields = fields.filter((field) => !isPrimary(field));
  const activeParameters = Object.entries(filters.parameters).filter(([, filter]) =>
    isActiveParameterFilter(filter),
  );
  const activeCount =
    activeParameters.length +
    Number(!!filters.query) +
    Number(!!filters.sourceName) +
    Number(!!filters.manufacturer) +
    Number(filters.kind !== 'all');
  useEffect(() => {
    setPage(0);
  }, [filters]);
  useEffect(() => {
    searchInput.current?.focus();
  }, []);

  function setScope(category: string, partId: string) {
    const nextParts = parts.filter(
      (part) => (!category || part.category === category) && (!partId || part.id === partId),
    );
    const available = new Set(getFilterFields(nextParts).map((field) => field.id));
    setFilters((previous) => ({
      ...previous,
      category,
      partId,
      sourceName: '',
      manufacturer: '',
      parameters: Object.fromEntries(
        Object.entries(previous.parameters).filter(([id]) => available.has(id)),
      ),
    }));
  }

  function updateParameter(id: string, value: ParameterFilter) {
    setFilters((previous) => {
      const parameters = { ...previous.parameters };
      if (isActiveParameterFilter(value)) parameters[id] = value;
      else delete parameters[id];
      return { ...previous, parameters };
    });
  }

  function renderField(field: PresetFilterField) {
    const currentDefinition = currentPart.parameters.find(
      (candidate) => fieldId(candidate) === field.id,
    );
    const currentValue =
      currentDefinition &&
      (!currentDefinition.visibleWhen || currentDefinition.visibleWhen(currentParameters))
        ? currentParameters[field.key]
        : undefined;
    return (
      <FilterField
        key={field.id}
        field={field}
        filter={filters.parameters[field.id] ?? {}}
        currentValue={currentValue}
        error={results.errors.find((error) => error.fieldId === field.id)?.message}
        onChange={(value) => updateParameter(field.id, value)}
      />
    );
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
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
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
              {categoryParts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name}
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
        {activeCount > 0 && (
          <div className="pb-chips" aria-label="Active preset filters">
            {filters.query && (
              <button onClick={() => setFilters({ ...filters, query: '' })}>
                Search: {filters.query}
                <X size={12} />
              </button>
            )}
            {filters.kind !== 'all' && (
              <button onClick={() => setFilters({ ...filters, kind: 'all' })}>
                {filters.kind === 'catalog' ? 'Sourced catalog' : 'Prototype examples'}
                <X size={12} />
              </button>
            )}
            {filters.sourceName && (
              <button onClick={() => setFilters({ ...filters, sourceName: '' })}>
                {filters.sourceName}
                <X size={12} />
              </button>
            )}
            {filters.manufacturer && (
              <button onClick={() => setFilters({ ...filters, manufacturer: '' })}>
                {filters.manufacturer}
                <X size={12} />
              </button>
            )}
            {activeParameters.map(([id, filter]) => {
              const field = fields.find((candidate) => candidate.id === id);
              const range =
                filter.min?.trim() &&
                filter.max?.trim() &&
                Number(filter.min) === Number(filter.max)
                  ? filter.min
                  : `${filter.min?.trim() || 'any'} – ${filter.max?.trim() || 'any'}`;
              return (
                <button key={id} onClick={() => updateParameter(id, {})}>
                  {field?.label ?? 'Parameter'}:{' '}
                  {field?.type === 'number'
                    ? `${range}${field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`}`
                    : (field?.options?.find((option) => option.value === filter.value)?.label ??
                      (filter.value === 'true'
                        ? 'Yes'
                        : filter.value === 'false'
                          ? 'No'
                          : filter.value))}
                  <X size={12} />
                </button>
              );
            })}
            <button
              className="pb-clear-all"
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
          </div>
        )}
        <div className={`pb-workspace ${showFilters ? 'with-filters' : ''}`}>
          {showFilters && (
            <aside className="pb-filters" id="preset-filter-panel" aria-label="Preset filters">
              <div className="pb-sidebar-title">
                <span>PARAMETERS</span>
                <small>Optional filters</small>
              </div>
              <div className="pb-primary-fields">{primaryFields.map(renderField)}</div>
              {additionalFields.length > 0 && scopeParts.length === 1 && (
                <details className="pb-more-fields">
                  <summary>
                    More parameters <span>{additionalFields.length}</span>
                  </summary>
                  {additionalFields.map(renderField)}
                </details>
              )}
              {scopeParts.length > 1 && (
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
              <span>{selected ? 'Shown in 3D' : 'Select to preview'}</span>
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
            {results.items.length > PAGE_SIZE && (
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
                <span className="pb-review-eyebrow">SELECTED PRESET</span>
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
