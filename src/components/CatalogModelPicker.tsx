import { Check, ChevronDown, ExternalLink, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  catalogFilterErrors,
  catalogValue,
  matchesCatalogFilters,
  catalogFacetOptions,
} from '../core/catalog-models';
import { buildPresetIndex, filterPresets, emptyPresetFilters } from '../core/preset-search';
import { presetLabels } from '../core/library-labels';
import NumericRangeFilter from './NumericRangeFilter';
import FilterChips, { type FilterChip } from './FilterChips';
import { parseNumericRange } from '../core/numeric-range';
import './NumericRangeFilter.css';
import type { CatalogModelFilters } from '../core/catalog-models';
import type { ParameterDefinition, PartDefinition, Preset } from '../core/types';
import './CatalogModelPicker.css';

interface Props {
  part: PartDefinition;
  presetId: string;
  initialQuery?: string;
  onQueryChange: (query: string) => void;
  onSelect: (preset: Preset) => void;
}

function displayValue(preset: Preset, field: ParameterDefinition) {
  const value = catalogValue(preset, field.key);
  if (value === undefined || value === '') return 'Not published';
  const option = field.options?.find((item) => item.value === String(value));
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return `${value}${field.unit ? ` ${field.unit}` : ''}`;
}

function isActive(filter: CatalogModelFilters[string] | undefined) {
  return Object.values(filter ?? {}).some((value) => value?.trim());
}

export default function CatalogModelPicker({
  part,
  presetId,
  initialQuery = '',
  onQueryChange,
  onSelect,
}: Props) {
  const fields = useMemo(
    () => (part.catalogFilterFields ?? []).filter((field) => field.filterable !== false),
    [part],
  );
  const [filters, setFilters] = useState<CatalogModelFilters>({});
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(40);
  const groups = [...new Set(fields.map((field) => field.group))];
  const summaryFields = fields.filter((field) => field.catalogSummary);
  const conditionFields = fields.filter((field) => field.catalogCondition);
  const queryIndex = useMemo(() => buildPresetIndex([part]), [part]);
  const queryMatches = useMemo(
    () =>
      new Set(
        filterPresets(queryIndex, { ...emptyPresetFilters(part), query }).items.map(
          (entry) => entry.preset.id,
        ),
      ),
    [queryIndex, part, query],
  );
  const filterErrors = catalogFilterErrors(fields, filters);
  const matches = useMemo(() => {
    return part.presets.filter(
      (preset) => matchesCatalogFilters(preset, fields, filters) && queryMatches.has(preset.id),
    );
  }, [part, fields, filters, queryMatches]);
  const selectedOutsideResults = !!presetId && !matches.some((preset) => preset.id === presetId);
  const selectedPreset = part.presets.find((preset) => preset.id === presetId);
  const visibleMatches = matches.slice(0, visibleCount);
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = results.current;
    if (!list) return;
    const selected = list.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) {
      list.scrollTop = 0;
      return;
    }
    const bottom = selected.offsetTop + selected.offsetHeight;
    if (selected.offsetTop < list.scrollTop) list.scrollTop = selected.offsetTop;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [presetId, matches]);
  const pinnedSelection =
    selectedPreset && !visibleMatches.some((preset) => preset.id === selectedPreset.id)
      ? selectedPreset
      : undefined;
  const activeCount = Object.values(filters).filter(isActive).length;
  function changeQuery(value: string) {
    setQuery(value);
    onQueryChange(value);
    setVisibleCount(40);
  }

  function changeFilter(key: string, property: 'min' | 'max' | 'value', value: string) {
    setVisibleCount(40);
    setFilters((current) => ({
      ...current,
      [key]: { ...current[key], [property]: value },
    }));
  }

  function modelCard(preset: Preset, pinned = false) {
    const labels = presetLabels(preset);
    return (
      <div className="catalog-model-entry" key={preset.id}>
        <button
          type="button"
          className={`catalog-model-result${preset.id === presetId ? ' selected' : ''}`}
          aria-label={`${pinned ? 'Current preview' : 'Select'} ${labels.name}`}
          aria-pressed={preset.id === presetId}
          disabled={pinned}
          onClick={() => onSelect(preset)}
        >
          <span className="catalog-model-manufacturer">
            <span>{preset.catalog?.manufacturer ?? preset.catalog?.sourceName}</span>
            {preset.id === presetId && <Check size={14} aria-hidden="true" />}
          </span>
          <strong>{labels.name}</strong>
          {labels.designation && (
            <span className="catalog-model-condition">
              Source designation: {labels.designation}
            </span>
          )}
          {!!summaryFields.length && (
            <span className="catalog-model-summary">
              {summaryFields.map((field) => (
                <span className="catalog-model-metric" key={field.key}>
                  <span>{field.label}</span>
                  <b>{displayValue(preset, field)}</b>
                </span>
              ))}
            </span>
          )}
          {conditionFields.map((field) => (
            <span className="catalog-model-condition" key={field.key}>
              {field.label}: {displayValue(preset, field)}
            </span>
          ))}
        </button>
        {preset.id === presetId &&
          !!Object.keys(preset.catalog?.attributeConditions ?? {}).length && (
            <details className="catalog-model-source-notes">
              <summary>Source notes & limitations</summary>
              {[...new Set(Object.values(preset.catalog?.attributeConditions ?? {}))].map(
                (note) => (
                  <p key={note}>{note}</p>
                ),
              )}
            </details>
          )}
        {preset.catalog?.sourceUrl && (
          <a
            className="catalog-model-source"
            href={preset.catalog.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${labels.name} on ${preset.catalog.sourceName}`}
          >
            {String(preset.catalog.attributes?.supplier ?? preset.catalog.sourceName)}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  const chips: FilterChip[] = [];
  if (query.trim())
    chips.push({
      id: 'query',
      label: `Search: ${query}`,
      removeLabel: 'Clear catalog search',
      onRemove: () => {
        changeQuery('');
        setVisibleCount(40);
      },
    });
  for (const [key, filter] of Object.entries(filters).filter(([, filter]) => isActive(filter))) {
    const field = fields.find((field) => field.key === key);
    const name = field?.label ?? 'Unavailable characteristic';
    const range = parseNumericRange(filter);
    const text =
      field?.type === 'number'
        ? (!range.errors.length &&
          range.range.min !== undefined &&
          range.range.min === range.range.max
            ? filter.min
            : `${filter.min?.trim() || '…'}–${filter.max?.trim() || '…'}`) +
          (field.unit ? ` ${field.unit}` : '')
        : (field?.options?.find((option) => option.value === filter.value)?.label ??
          filter.value ??
          '');
    chips.push({
      id: key,
      label: `${name}: ${text}`,
      removeLabel: `Clear ${name.toLowerCase()} filter`,
      onRemove: () => {
        setFilters((current) =>
          Object.fromEntries(Object.entries(current).filter(([field]) => field !== key)),
        );
        setVisibleCount(40);
      },
    });
  }
  return (
    <section className="catalog-model-picker" aria-label="Catalog model selection">
      <p className="catalog-model-hint">
        Choose a model by its published dimensions. Adjust its configuration below.
      </p>
      <label className="catalog-model-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search catalog models"
          placeholder="Model or manufacturer…"
          value={query}
          onChange={(event) => {
            changeQuery(event.target.value);
            setVisibleCount(40);
          }}
        />
      </label>
      <div className="catalog-model-filter-groups">
        {groups.map((group) => {
          const groupFields = fields.filter((field) => field.group === group);
          const groupActive = groupFields.filter((field) => isActive(filters[field.key])).length;
          return (
            <details className="catalog-model-filter-group" key={group}>
              <summary>
                <span>{group}</span>
                {groupActive > 0 && (
                  <span className="catalog-model-filter-badge">{groupActive}</span>
                )}
                <ChevronDown size={13} aria-hidden="true" />
              </summary>
              <div className="catalog-model-filters">
                {groupFields.map((field) => {
                  const filter = filters[field.key] ?? {};
                  const errors = catalogFilterErrors([field], { [field.key]: filter });
                  const options = catalogFacetOptions(
                    part.presets,
                    fields,
                    filters,
                    field.key,
                    (preset) => queryMatches.has(preset.id),
                  );
                  return (
                    <div className="catalog-model-filter" key={field.key}>
                      <div className="catalog-model-filter-label">
                        <span>{field.label}</span>
                        {field.unit && <span>{field.unit}</span>}
                      </div>
                      {field.type === 'number' ? (
                        <NumericRangeFilter
                          label={field.label}
                          value={filter}
                          error={errors.join(' ') || undefined}
                          onChange={(range) => {
                            setVisibleCount(40);
                            setFilters((current) => ({ ...current, [field.key]: range }));
                          }}
                        />
                      ) : (
                        <select
                          aria-label={`Filter ${field.label.toLowerCase()}`}
                          value={filter.value ?? ''}
                          onChange={(event) => changeFilter(field.key, 'value', event.target.value)}
                        >
                          <option value="">Any</option>
                          {options.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={!option.count && option.value !== filter.value?.trim()}
                            >
                              {option.label} · {option.count.toLocaleString('en-US')}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.length && field.type !== 'number' ? (
                        <small className="catalog-model-range-error" role="alert">
                          {errors.join(' ')}
                        </small>
                      ) : !errors.length && field.description ? (
                        <small>{field.description}</small>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      <FilterChips label="Active catalog filters" items={chips} />
      {filterErrors.length > 0 && (
        <p className="catalog-model-range-error" role="alert">
          {filterErrors.join(' ')}
        </p>
      )}
      <div className="catalog-model-count">
        <strong aria-live="polite" aria-atomic="true">
          {matches.length} of {part.presets.length} models
        </strong>
        <button
          type="button"
          disabled={!activeCount && !query}
          onClick={() => {
            setFilters({});
            changeQuery('');
            setVisibleCount(40);
          }}
          aria-label="Clear model filters"
        >
          <RotateCcw size={12} /> Clear filters
        </button>
      </div>
      {activeCount > 0 && (
        <p className="catalog-model-unknown-note">
          Models with unpublished values are excluded only for the filters you set.
        </p>
      )}
      {selectedOutsideResults && selectedPreset && (
        <p className="catalog-model-selection-note" role="status">
          Still previewing {selectedPreset.name}. Choose a result to change the model.
        </p>
      )}
      {pinnedSelection && (
        <div className="catalog-model-current">
          <span className="catalog-model-current-label">Current selection</span>
          {modelCard(pinnedSelection, true)}
        </div>
      )}
      <div className="catalog-model-results" ref={results}>
        {visibleMatches.map((preset) => modelCard(preset))}
        {!matches.length && !filterErrors.length && (
          <p className="catalog-model-empty" role="status">
            No models match these filters. Change the ranges or clear filters to see all models.
          </p>
        )}
      </div>
      {visibleCount < matches.length && (
        <button
          className="catalog-model-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 40)}
        >
          Show more models · {visibleMatches.length} of {matches.length}
        </button>
      )}
    </section>
  );
}
