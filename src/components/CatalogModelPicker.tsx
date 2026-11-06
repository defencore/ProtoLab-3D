import { Check, ChevronDown, ExternalLink, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isPublishedValue, presetValue } from '../core/catalog-models';
import {
  buildPresetIndex,
  compilePresetQuery,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  formatPresetRange,
  getFilterFields,
  getPresetParameterRange,
  isActiveParameterFilter,
  presetFacetOptions,
  type ParameterFilter,
  type PresetEntry,
  type PresetFilterField,
  type PresetFilters,
} from '../core/preset-search';
import { presetBrowserSelection } from '../core/preset-browser';
import { sortPresetEntries } from '../core/preset-sort';
import { familyLabel, presetLabels } from '../core/library-labels';
import NumericRangeFilter from './NumericRangeFilter';
import FilterChips, { type FilterChip } from './FilterChips';
import { parseNumericRange } from '../core/numeric-range';
import type { Parameters, ParameterDefinition, PartDefinition, Preset } from '../core/types';
import './NumericRangeFilter.css';
import './CatalogModelPicker.css';

interface Props {
  parts: PartDefinition[];
  part: PartDefinition;
  parameters: Parameters;
  presetId: string;
  initialQuery?: string;
  onQueryChange: (query: string) => void;
  onSelect: (part: PartDefinition, preset: Preset) => void;
  onSelectPart: (part: PartDefinition) => void;
}

function displayValue(preset: Preset, field: ParameterDefinition) {
  const choices = preset.catalog?.parameterChoices?.[field.key];
  if (choices?.length) return `${choices.join(' / ')}${field.unit ? ` ${field.unit}` : ''}`;
  const range = getPresetParameterRange(preset, field.key);
  if (range) return formatPresetRange(field, range);
  if (preset.catalog && !isPublishedValue(preset, field.key)) return 'Not published';
  const value =
    presetValue(preset, field.key) ?? preset.catalog?.attributeOptions?.[field.key]?.join(' / ');
  if (value === undefined || value === '') return 'Not published';
  const option = field.options?.find((item) => item.value === String(value));
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return `${value}${field.unit ? ` ${field.unit}` : ''}`;
}

function matchesDefault(part: PartDefinition, query: string): boolean {
  if (query.trim() === part.id) return true;
  if (query.includes(':')) return false;
  const text = [part.name, part.description, ...part.keywords]
    .join(' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ');
  const compiled = compilePresetQuery(query);
  return !compiled.metricSize && compiled.tokens.every((token) => text.includes(token));
}

export default function CatalogModelPicker({
  parts,
  part,
  parameters,
  presetId,
  initialQuery = '',
  onQueryChange,
  onSelect,
  onSelectPart,
}: Props) {
  const [filters, setFilters] = useState<PresetFilters>(() => ({
    ...emptyPresetFilters(),
    query: initialQuery,
  }));
  const [subtype, setSubtype] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const [sortKey, setSortKey] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(parts.length === 1);
  const index = useMemo(() => buildPresetIndex(parts), [parts]);
  const scopeParts = useMemo(
    () => parts.filter((member) => !subtype || member.id === subtype),
    [parts, subtype],
  );
  const scopeIndex = useMemo(
    () => index.filter((entry) => !subtype || entry.part.id === subtype),
    [index, subtype],
  );
  const fields = useMemo(() => getFilterFields(scopeParts), [scopeParts]);
  const primaryFields = useMemo(() => {
    const preferred = part.catalogFilterFields?.some((field) => field.catalogSummary)
      ? part
      : (scopeParts.find((member) => member.browseFamily?.primary) ?? scopeParts[0]);
    const preferredSummary = new Map(
      preferred?.catalogFilterFields
        ?.filter((field) => field.catalogSummary)
        .map((field, index) => [fieldId(field), index]),
    );
    return [...fields]
      .filter((field) => field.catalogSummary || field.primary)
      .sort(
        (a, b) =>
          Number(preferredSummary.has(b.id)) - Number(preferredSummary.has(a.id)) ||
          (preferredSummary.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (preferredSummary.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
          Number(!!b.catalogSummary) - Number(!!a.catalogSummary),
      )
      .slice(0, 4);
  }, [fields, part, scopeParts]);
  const additionalFields = fields.filter(
    (field) => !primaryFields.some((primary) => primary.id === field.id),
  );
  const groups = [...new Set(additionalFields.map((field) => field.group))];
  const result = useMemo(() => filterPresets(scopeIndex, filters), [scopeIndex, filters]);
  const sortOptions = useMemo(
    () => [
      ...new Map(
        scopeParts
          .flatMap((member) => member.catalogSortOptions ?? [])
          .map((option) => [option.key, option]),
      ).values(),
    ],
    [scopeParts],
  );
  const sortedItems = useMemo(
    () =>
      sortPresetEntries(
        result.items,
        sortOptions.find((option) => option.key === sortKey),
      ),
    [result.items, sortOptions, sortKey],
  );
  const selection = useMemo(
    () => presetBrowserSelection(index, result.items, part, parameters, presetId),
    [index, result.items, part, parameters, presetId],
  );
  const noPresetParts = useMemo(() => parts.filter((member) => !member.presets.length), [parts]);
  const defaults = scopeParts.filter(
    (member) =>
      !member.presets.length &&
      filters.kind !== 'catalog' &&
      !filters.manufacturer &&
      !filters.sourceName &&
      !Object.values(filters.parameters).some(isActiveParameterFilter) &&
      matchesDefault(member, filters.query),
  );
  const selectedDefault = noPresetParts.find((member) => member.id === part.id);
  const visible = sortedItems.slice(0, visibleCount);
  const pinned =
    selection.selected && !visible.some((entry) => entry.id === selection.selectedId)
      ? selection.selected
      : undefined;
  const pinnedDefault =
    selectedDefault && !defaults.some((member) => member.id === part.id)
      ? selectedDefault
      : undefined;
  const manufacturers = [
    ...new Set(scopeIndex.flatMap((entry) => entry.preset.catalog?.manufacturer ?? [])),
  ].sort();
  const sources = [
    ...new Set(scopeIndex.flatMap((entry) => entry.preset.catalog?.sourceName ?? [])),
  ].sort();
  const active = Object.entries(filters.parameters).filter(([, filter]) =>
    isActiveParameterFilter(filter),
  );
  const activeCount =
    active.length +
    Number(!!filters.manufacturer) +
    Number(!!filters.sourceName) +
    Number(filters.kind !== 'all');
  const additionalActive = additionalFields.filter((field) =>
    isActiveParameterFilter(filters.parameters[field.id] ?? {}),
  ).length;
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
  }, [selection.selectedId, part.id, sortedItems, subtype]);

  function changeQuery(query: string) {
    setFilters((current) => ({ ...current, query }));
    onQueryChange(query);
    setVisibleCount(40);
  }
  function changeSubtype(value: string) {
    const members = parts.filter((member) => !value || member.id === value);
    const available = new Set(getFilterFields(members).map((field) => field.id));
    setSubtype(value);
    setVisibleCount(40);
    setFilters((current) => ({
      ...current,
      manufacturer: members.some((member) =>
        member.presets.some((preset) => preset.catalog?.manufacturer === current.manufacturer),
      )
        ? current.manufacturer
        : '',
      sourceName: members.some((member) =>
        member.presets.some((preset) => preset.catalog?.sourceName === current.sourceName),
      )
        ? current.sourceName
        : '',
      parameters: Object.fromEntries(
        Object.entries(current.parameters).filter(([id]) => available.has(id)),
      ),
    }));
  }
  function changeCharacteristic(field: PresetFilterField, value: ParameterFilter) {
    setVisibleCount(40);
    setFilters((current) => ({
      ...current,
      parameters: { ...current.parameters, [fieldId(field)]: value },
    }));
  }
  function characteristic(field: PresetFilterField) {
    const value = filters.parameters[field.id] ?? {};
    const unit = field.type === 'number' ? (field.unit ?? 'mm') : field.unit;
    const errors = result.errors.filter((error) => error.fieldId === field.id);
    const options = field.type === 'number' ? [] : presetFacetOptions(scopeIndex, filters, field);
    return (
      <div className="catalog-model-filter" key={field.id}>
        <div className="catalog-model-filter-label">
          <span>{field.label}</span>
          {unit && <span>{unit}</span>}
        </div>
        {field.type === 'number' ? (
          <NumericRangeFilter
            label={field.label}
            value={value}
            error={errors.map((error) => error.message).join(' ') || undefined}
            onChange={(range) => changeCharacteristic(field, range)}
          />
        ) : (
          <select
            aria-label={`Filter ${field.label.toLowerCase()}`}
            value={value.value ?? ''}
            onChange={(event) => changeCharacteristic(field, { value: event.target.value })}
          >
            <option value="">Any</option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={!option.count && option.value !== value.value?.trim()}
              >
                {option.label} · {option.count.toLocaleString('en-US')}
              </option>
            ))}
          </select>
        )}
        {errors.length && field.type !== 'number' ? (
          <small className="catalog-model-range-error" role="alert">
            {errors.map((error) => error.message).join(' ')}
          </small>
        ) : !errors.length && field.description ? (
          <small>{field.description}</small>
        ) : null}
      </div>
    );
  }
  function modelCard(entry: PresetEntry, pinned = false) {
    const { preset, part: owner } = entry;
    const labels = presetLabels(preset);
    const name = preset.catalog?.name?.trim() || labels.name;
    const selected = entry.id === selection.selectedId;
    const ownFields =
      owner.catalogFilterFields?.filter((field) => field.filterable !== false) ?? [];
    return (
      <div className="catalog-model-entry" key={entry.id}>
        <button
          type="button"
          className={`catalog-model-result${selected ? ' selected' : ''}`}
          aria-label={`${pinned ? 'Current preview' : 'Select'} ${name}`}
          aria-pressed={selected}
          disabled={pinned}
          onClick={() => onSelect(owner, preset)}
        >
          <span className="catalog-model-manufacturer">
            <span>
              {preset.catalog?.manufacturer ??
                preset.catalog?.sourceName ??
                'Reference / example configuration'}
            </span>
            {selected && <Check size={14} aria-hidden="true" />}
          </span>
          <strong>{name}</strong>
          {name !== labels.name && (
            <span className="catalog-model-curated-name">{labels.name}</span>
          )}
          {parts.length > 1 && <span className="catalog-model-subtype">{owner.name}</span>}
          {labels.designation && labels.designation !== name && (
            <span className="catalog-model-condition">
              Source designation: {labels.designation}
            </span>
          )}
          {!preset.catalog && (
            <span className="catalog-model-description">{preset.description}</span>
          )}
          {ownFields.some((field) => field.catalogSummary) && (
            <span className="catalog-model-summary">
              {ownFields
                .filter((field) => field.catalogSummary)
                .map((field) => (
                  <span className="catalog-model-metric" key={fieldId(field)}>
                    <span>{field.label}</span>
                    <b>{displayValue(preset, field)}</b>
                  </span>
                ))}
            </span>
          )}
          {ownFields
            .filter((field) => field.catalogCondition)
            .map((field) => (
              <span className="catalog-model-condition" key={fieldId(field)}>
                {field.label}: {displayValue(preset, field)}
              </span>
            ))}
        </button>
        {selected && !!Object.keys(preset.catalog?.attributeConditions ?? {}).length && (
          <details className="catalog-model-source-notes">
            <summary>Source notes & limitations</summary>
            {[...new Set(Object.values(preset.catalog?.attributeConditions ?? {}))].map((note) => (
              <p key={note}>{note}</p>
            ))}
          </details>
        )}
        {preset.catalog?.sourceUrl && (
          <a
            className="catalog-model-source"
            href={preset.catalog.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${name} on ${preset.catalog.sourceName}`}
          >
            {String(preset.catalog.attributes?.supplier ?? preset.catalog.sourceName)}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }
  function defaultCard(member: PartDefinition, pinned = false) {
    const selected = member.id === part.id;
    return (
      <div className="catalog-model-entry" key={`default:${member.id}`}>
        <button
          type="button"
          className={`catalog-model-result${selected ? ' selected' : ''}`}
          disabled={pinned}
          aria-label={`${pinned ? 'Current preview' : 'Configure'} ${member.name}`}
          aria-pressed={selected}
          onClick={() => onSelectPart(member)}
        >
          <span className="catalog-model-manufacturer">
            <span>Configurable construction</span>
            {selected && <Check size={14} aria-hidden="true" />}
          </span>
          <strong>{member.name}</strong>
          <span className="catalog-model-description">{member.description}</span>
          <span className="catalog-model-condition">
            Choose this construction, then set its dimensions below.
          </span>
        </button>
      </div>
    );
  }

  const chips: FilterChip[] = [];
  if (filters.query.trim())
    chips.push({
      id: 'query',
      label: `Search: ${filters.query}`,
      removeLabel: 'Clear catalog search',
      onRemove: () => changeQuery(''),
    });
  if (subtype)
    chips.push({
      id: 'subtype',
      label: `Type: ${parts.find((member) => member.id === subtype)?.name ?? subtype}`,
      removeLabel: 'Clear model type filter',
      onRemove: () => changeSubtype(''),
    });
  if (filters.manufacturer)
    chips.push({
      id: 'manufacturer',
      label: `Manufacturer: ${filters.manufacturer}`,
      removeLabel: 'Clear manufacturer filter',
      onRemove: () => setFilters((current) => ({ ...current, manufacturer: '' })),
    });
  if (filters.sourceName)
    chips.push({
      id: 'sourceName',
      label: `Catalog / supplier: ${filters.sourceName}`,
      removeLabel: 'Clear catalog supplier filter',
      onRemove: () => setFilters((current) => ({ ...current, sourceName: '' })),
    });
  if (filters.kind !== 'all')
    chips.push({
      id: 'kind',
      label: filters.kind === 'catalog' ? 'Catalog models' : 'Reference & example configurations',
      removeLabel: 'Clear model source filter',
      onRemove: () => setFilters((current) => ({ ...current, kind: 'all' })),
    });
  for (const [id, filter] of active) {
    const field = fields.find((field) => field.id === id);
    const name = field?.label ?? 'Unavailable characteristic';
    const range = parseNumericRange(filter);
    const text =
      field?.type === 'number'
        ? (!range.errors.length &&
          range.range.min !== undefined &&
          range.range.min === range.range.max
            ? filter.min
            : `${filter.min?.trim() || '…'}–${filter.max?.trim() || '…'}`) +
          ((field.unit ?? 'mm') ? ` ${field.unit ?? 'mm'}` : '')
        : (field?.options?.find((option) => option.value === filter.value)?.label ??
          filter.value ??
          '');
    chips.push({
      id,
      label: `${name}: ${text}`,
      removeLabel: `Clear ${name.toLowerCase()} filter`,
      onRemove: () => {
        setFilters((current) => ({
          ...current,
          parameters: Object.fromEntries(
            Object.entries(current.parameters).filter(([key]) => key !== id),
          ),
        }));
        setVisibleCount(40);
      },
    });
  }
  return (
    <section className="catalog-model-picker" aria-label="Catalog model selection">
      {parts.length > 1 && <h3 className="catalog-model-family-title">{familyLabel(part)}</h3>}
      <p className="catalog-model-hint">Choose a model, then adjust its configuration below.</p>
      <label className="catalog-model-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search catalog models"
          placeholder="Model or manufacturer…"
          value={filters.query}
          onChange={(event) => changeQuery(event.target.value)}
        />
      </label>
      <details
        className="catalog-model-controls"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>
          <span>Filter models</span>
          {activeCount + Number(!!subtype) > 0 && (
            <span className="catalog-model-filter-badge">{activeCount + Number(!!subtype)}</span>
          )}
          <ChevronDown size={13} aria-hidden="true" />
        </summary>
        <div className="catalog-model-basic-filters">
          {parts.length > 1 && (
            <label className="catalog-model-filter catalog-model-subtype-filter">
              <span className="catalog-model-filter-label">Model type</span>
              <select
                aria-label="Filter model type"
                value={subtype}
                onChange={(event) => changeSubtype(event.target.value)}
              >
                <option value="">All types</option>
                {parts.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(parts.length > 1 || index.some((entry) => !entry.preset.catalog)) && (
            <label className="catalog-model-filter">
              <span className="catalog-model-filter-label">Source</span>
              <select
                aria-label="Filter model source"
                value={filters.kind}
                onChange={(event) => {
                  const kind = event.target.value as PresetFilters['kind'];
                  setFilters((current) => ({ ...current, kind }));
                  setVisibleCount(40);
                }}
              >
                <option value="all">All configurations</option>
                <option value="catalog">Catalog models</option>
                <option value="examples">Reference & examples</option>
              </select>
            </label>
          )}
          {manufacturers.length > 1 && (
            <label className="catalog-model-filter">
              <span className="catalog-model-filter-label">Manufacturer</span>
              <select
                aria-label="Filter model manufacturer"
                value={filters.manufacturer}
                onChange={(event) => {
                  const manufacturer = event.target.value;
                  setFilters((current) => ({ ...current, manufacturer }));
                  setVisibleCount(40);
                }}
              >
                <option value="">Any manufacturer</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sources.length > 1 && (
            <label className="catalog-model-filter">
              <span className="catalog-model-filter-label">Catalog / supplier</span>
              <select
                aria-label="Filter catalog supplier"
                value={filters.sourceName}
                onChange={(event) => {
                  const sourceName = event.target.value;
                  setFilters((current) => ({ ...current, sourceName }));
                  setVisibleCount(40);
                }}
              >
                <option value="">Any catalog / supplier</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!!primaryFields.length && (
          <div className="catalog-model-primary-filters">{primaryFields.map(characteristic)}</div>
        )}
        {!!additionalFields.length && (
          <details className="catalog-model-additional-filters">
            <summary>
              <span>More characteristics · {additionalFields.length}</span>
              {additionalActive > 0 && (
                <span className="catalog-model-filter-badge">{additionalActive}</span>
              )}
              <ChevronDown size={13} aria-hidden="true" />
            </summary>
            <div className="catalog-model-filter-groups">
              {groups.map((group) => (
                <section className="catalog-model-filter-group" key={group}>
                  <h4>{group}</h4>
                  <div className="catalog-model-filters">
                    {additionalFields.filter((field) => field.group === group).map(characteristic)}
                  </div>
                </section>
              ))}
            </div>
          </details>
        )}
      </details>
      <FilterChips label="Active catalog filters" items={chips} />
      {result.errors.length > 0 && (
        <p className="catalog-model-range-error" role="alert">
          {result.errors.map((error) => error.message).join(' ')}
        </p>
      )}
      <div className="catalog-model-count">
        <strong aria-live="polite" aria-atomic="true">
          {result.items.length + defaults.length} of {index.length + noPresetParts.length} models
        </strong>
        <button
          type="button"
          disabled={!activeCount && !filters.query && !subtype}
          onClick={() => {
            setSubtype('');
            setFilters(emptyPresetFilters());
            onQueryChange('');
            setVisibleCount(40);
          }}
          aria-label="Clear model filters"
        >
          <RotateCcw size={12} /> Clear filters
        </button>
      </div>
      {sortOptions.length > 0 && (
        <label className="catalog-model-filter catalog-model-sort">
          <span className="catalog-model-filter-label">Sort models</span>
          <select
            aria-label="Sort catalog models"
            value={sortOptions.some((option) => option.key === sortKey) ? sortKey : ''}
            onChange={(event) => {
              setSortKey(event.target.value);
              setVisibleCount(40);
            }}
          >
            <option value="">Catalog order</option>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {active.length > 0 && (
        <p className="catalog-model-unknown-note">
          Models with unpublished values are excluded only for the filters you set.
        </p>
      )}
      {selection.selectedOutsideResults && selection.selected && (
        <p className="catalog-model-selection-note" role="status">
          Still previewing {selection.selected.preset.name}. Choose a result to change the model.
        </p>
      )}
      {!selection.selected && part.presets.length > 0 && (
        <p className="catalog-model-selection-note" role="status">
          Previewing your custom configuration of {part.name}. Choose a model to apply its saved
          parameters.
        </p>
      )}
      {(pinned || pinnedDefault) && (
        <div className="catalog-model-current">
          <span className="catalog-model-current-label">Current selection</span>
          {pinned ? modelCard(pinned, true) : defaultCard(pinnedDefault!, true)}
        </div>
      )}
      <div className="catalog-model-results" ref={results}>
        {visible.map((entry) => modelCard(entry))}
        {defaults.map((member) => defaultCard(member))}
        {!result.items.length && !defaults.length && !result.errors.length && (
          <p className="catalog-model-empty" role="status">
            No models match these filters. Change the ranges or clear filters to see all models.
          </p>
        )}
      </div>
      {visibleCount < result.items.length && (
        <button
          className="catalog-model-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 40)}
        >
          Show more models · {visible.length} of {result.items.length}
        </button>
      )}
    </section>
  );
}
