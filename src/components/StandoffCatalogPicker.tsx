import { Check, ChevronDown, ExternalLink, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Parameters, PartDefinition, Preset } from '../core/types';
import {
  buildStandoffCatalog,
  filterStandoffs,
  standoffBodyLengthOptions,
  standoffFacetCounts,
  standoffFacetLabel,
  suggestedStandoffParameters,
  standoffConfigurationMatches,
  captureStandoffTemplate,
  resolveStandoffPreviewEntry,
  type StandoffTemplateChoice,
  rememberStandoffBodyLength,
  changeStandoffBodyLengthMode,
  type StandoffBodyLengthState,
  type StandoffCatalogEntry,
  type StandoffFilters,
  type StandoffSelectKey,
} from '../core/standoff-catalog';
import NumericRangeFilter from './NumericRangeFilter';
import FilterChips, { type FilterChip } from './FilterChips';
import { parseNumericRange } from '../core/numeric-range';
import './NumericRangeFilter.css';
import './CatalogModelPicker.css';
import './StandoffCatalogPicker.css';

interface Props {
  parts: PartDefinition[];
  selectedPart: PartDefinition;
  presetId: string;
  currentParameters?: Parameters;
  initialQuery?: string;
  onQueryChange: (query: string) => void;
  onSelect: (part: PartDefinition, preset: Preset, parameters?: Parameters) => void;
}
type NumericKey = 'bodyLength' | 'bodyWidth' | 'overallLength' | 'bore';
const selectLabels: Record<StandoffSelectKey, string> = {
  connection: 'Ends',
  thread: 'Thread (either end)',
  threadA: 'End 1 thread',
  threadB: 'End 2 thread',
  bodyForm: 'Body shape',
  material: 'Material',
  construction: 'Construction',
  supplier: 'Supplier',
  coating: 'Coating / finish',
};
const numericLabels: Record<NumericKey, string> = {
  bodyLength: 'Body length',
  bodyWidth: 'Body diameter / across flats',
  overallLength: 'Overall length incl. studs',
  bore: 'Plain bore',
};
const endLabels: Record<string, string> = {
  'female/female': 'Female / female',
  'female/male': 'Female / male',
  'male/male': 'Male / male',
  plain: 'Plain through bore',
};
const constructionLabels: Record<string, string> = {
  'single-piece': 'One-piece standoff',
  'metal-insert': 'With metal insert',
  'plain-spacer': 'Plain spacer design',
  'custom-sleeve': 'Custom-order sleeve',
};
function labelFor(key: StandoffSelectKey, value: string) {
  if (value === 'unspecified') return 'Not specified';
  if (key === 'bodyForm')
    return value === 'hex' ? 'Hexagonal' : value === 'round' ? 'Cylindrical' : value;
  if (key === 'material')
    return (
      (
        {
          brass: 'Brass',
          steel: 'Steel',
          aluminium: 'Aluminium',
          'stainless-steel': 'Stainless steel',
          'polyamide-brass': 'Polyamide / brass',
          polyamide: 'Polyamide (plastic)',
        } as Record<string, string>
      )[value] ?? value
    );
  return key === 'connection'
    ? (endLabels[value] ?? value)
    : key === 'construction'
      ? (constructionLabels[value] ?? value)
      : standoffFacetLabel(key, value);
}

export default function StandoffCatalogPicker({
  parts,
  selectedPart,
  presetId,
  currentParameters,
  initialQuery = '',
  onQueryChange,
  onSelect,
}: Props) {
  const entries = useMemo(() => buildStandoffCatalog(parts), [parts]);
  const [filters, setFilters] = useState<StandoffFilters>({ query: initialQuery });
  const [visibleCount, setVisibleCount] = useState(24);
  const [lengthState, setLengthState] = useState<StandoffBodyLengthState>({ mode: 'catalog' });
  const lengthRange = lengthState.mode === 'range';
  const [selectionError, setSelectionError] = useState('');
  const [chosenTemplate, setChosenTemplate] = useState<StandoffTemplateChoice>();
  const result = useMemo(() => filterStandoffs(entries, filters), [entries, filters]);
  const facets = useMemo(() => standoffFacetCounts(entries, filters), [entries, filters]);
  const lengthOptions = useMemo(
    () => standoffBodyLengthOptions(entries, filters),
    [entries, filters],
  );
  const selected = resolveStandoffPreviewEntry(
    entries,
    selectedPart.id,
    presetId,
    currentParameters,
    chosenTemplate,
  );
  function matchesCurrent(entry: StandoffCatalogEntry, parameters: Parameters) {
    if (entry.id !== selected?.id) return false;
    const current = currentParameters ?? entry.preset.parameters;
    return standoffConfigurationMatches(entry, parameters, current);
  }
  const selectedExcluded =
    selected &&
    !result.items.some((entry) =>
      matchesCurrent(entry, suggestedStandoffParameters(entry, filters).parameters),
    );
  const visible = result.items.slice(0, visibleCount);
  const pinnedSelection =
    selected &&
    !visible.some((entry) =>
      matchesCurrent(entry, suggestedStandoffParameters(entry, filters).parameters),
    )
      ? selected
      : undefined;
  const activeSelects = Object.entries(filters.values ?? {}).filter(([, value]) => !!value);
  const activeNumbers = (Object.keys(numericLabels) as NumericKey[]).filter(
    (key) =>
      String(filters[key]?.min ?? '').trim() !== '' ||
      String(filters[key]?.max ?? '').trim() !== '',
  );
  const activeCount = activeSelects.length + activeNumbers.length + (filters.query?.trim() ? 1 : 0);

  function update(next: StandoffFilters) {
    if ((next.query ?? '') !== (filters.query ?? '')) onQueryChange(next.query ?? '');
    setFilters(next);
    setVisibleCount(24);
    setSelectionError('');
  }
  function clearNumeric(key: NumericKey) {
    const next = { ...filters };
    delete next[key];
    if (key === 'bodyLength') setLengthState((current) => rememberStandoffBodyLength(current));
    update(next);
  }
  function changeLengthMode(range: boolean) {
    if (range === lengthRange) return;
    const next = changeStandoffBodyLengthMode(
      lengthState,
      range ? 'range' : 'catalog',
      lengthOptions,
    );
    setLengthState(next);
    update({ ...filters, bodyLength: next[next.mode] });
  }
  function chooseCatalogLength(value: string) {
    if (!value) return clearNumeric('bodyLength');
    const range = { min: value, max: value };
    setLengthState((current) => rememberStandoffBodyLength(current, range));
    update({ ...filters, bodyLength: range });
  }
  function selectField(key: StandoffSelectKey) {
    const options = facets[key] ?? [];
    return (
      <label className="standoff-select" key={key}>
        <span>{selectLabels[key]}</span>
        <select
          aria-label={`Filter ${selectLabels[key].toLowerCase()}`}
          value={filters.values?.[key] ?? ''}
          onChange={(event) =>
            update({ ...filters, values: { ...filters.values, [key]: event.target.value } })
          }
        >
          <option value="">Any</option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={!option.count && option.value !== filters.values?.[key]}
            >
              {labelFor(key, option.value)} · {option.count.toLocaleString('en-US')}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function rangeField(key: NumericKey, showLabel = true) {
    return (
      <div className="standoff-number" key={key}>
        {showLabel && (
          <span>
            {numericLabels[key]} <small>mm</small>
          </span>
        )}
        <NumericRangeFilter
          label={numericLabels[key]}
          value={filters[key] ?? {}}
          error={result.errors.find((error) => error.field === key)?.message}
          onChange={(value) => {
            if (key === 'bodyLength')
              setLengthState((current) => rememberStandoffBodyLength(current, value));
            update({ ...filters, [key]: value });
          }}
        />
      </div>
    );
  }
  function choose(entry: StandoffCatalogEntry) {
    const suggestion = suggestedStandoffParameters(entry, filters);
    if (suggestion.errors.length) {
      setSelectionError(suggestion.errors.join(' '));
      return;
    }
    setSelectionError('');
    setChosenTemplate(captureStandoffTemplate(entry));
    onSelect(entry.part, entry.preset, suggestion.parameters);
  }
  function card(entry: StandoffCatalogEntry, pinned = false) {
    const custom = entry.construction === 'custom-sleeve' || entry.construction === 'plain-spacer';
    const qualified = !custom && Object.values(entry.evidence).includes('qualified');
    const suggestion = pinned
      ? (currentParameters ?? entry.preset.parameters)
      : custom
        ? suggestedStandoffParameters(entry, filters).parameters
        : entry.preset.parameters;
    const current = pinned || matchesCurrent(entry, suggestion);
    const shownLength = custom
      ? Number(suggestion.bodyLength ?? suggestion.length)
      : entry.bodyLength;
    const shownWidth = custom
      ? Number(suggestion.bodyWidth ?? suggestion.outerDiameter)
      : entry.bodyWidth;
    const customized =
      custom &&
      Object.entries(suggestion).some(([key, value]) => entry.preset.parameters[key] !== value);
    const displayName = customized
      ? entry.construction === 'custom-sleeve'
        ? `DREMEC ${entry.material} sleeve — custom dimensions`
        : `Custom plain spacer (${entry.preset.name} template)`
      : entry.preset.name;
    const supplierCode = entry.preset.catalog?.productCodes?.find(
      (code) => code !== entry.preset.name,
    );
    return (
      <div className="catalog-model-entry" key={entry.id}>
        <button
          className={`catalog-model-result${current ? ' selected' : ''}`}
          type="button"
          aria-label={`${pinned ? 'Current preview' : 'Select'} ${displayName} from ${entry.supplier}${supplierCode ? `, SKU ${supplierCode}` : ''}`}
          aria-pressed={current}
          disabled={pinned}
          onClick={() => choose(entry)}
        >
          <span className="catalog-model-manufacturer">
            <span>{entry.supplier === 'unspecified' ? 'Custom design' : entry.supplier}</span>
            {current && <Check size={14} aria-hidden="true" />}
          </span>
          <strong>{displayName}</strong>
          {supplierCode && <span className="standoff-supplier-code">SKU {supplierCode}</span>}
          <span className="standoff-connection">
            {endLabels[entry.connection] ?? entry.connection} ·{' '}
            {entry.threads.join(' / ') || 'Unthreaded'}
          </span>
          <span className="standoff-card-dimensions">
            <span>
              Body <b>{shownLength} mm</b>
            </span>
            <span>
              {entry.bodyForm === 'hex' ? 'Across flats' : 'Diameter'} <b>{shownWidth} mm</b>
            </span>
            {(custom || entry.overallLength !== undefined) && (
              <span>
                Overall <b>{custom ? shownLength : entry.overallLength} mm</b>
              </span>
            )}
            <span>{labelFor('material', entry.material)}</span>
            {entry.bore !== undefined && (
              <span>
                Bore <b>{custom ? suggestion.bore : entry.bore} mm</b>
              </span>
            )}
          </span>
          {entry.construction === 'metal-insert' && (
            <span className="standoff-badge">With metal insert</span>
          )}
          {custom && (
            <span className="standoff-badge">
              {entry.construction === 'custom-sleeve'
                ? 'Custom order · editable dimensions'
                : 'Editable design'}
            </span>
          )}
          {qualified && (
            <span className="standoff-badge">
              {entry.evidence.bodyLength === 'qualified'
                ? 'Body length from article code; source unresolved'
                : 'Shape or ends inferred from article code'}
            </span>
          )}
          {!custom && !qualified && entry.preset.catalog?.geometryEvidence?.kind === 'envelope' && (
            <span className="standoff-badge">Source dimensions incomplete · see notes</span>
          )}
        </button>
        {(entry.notes.length > 0 || entry.preset.catalog?.geometryEvidence?.limitations) && (
          <details className="catalog-model-source-notes">
            <summary>Dimensions & source notes</summary>
            {entry.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            {entry.preset.catalog?.geometryEvidence?.limitations && (
              <p>{entry.preset.catalog.geometryEvidence.limitations}</p>
            )}
          </details>
        )}
        {entry.preset.catalog?.sourceUrl && (
          <a
            className="catalog-model-source"
            href={entry.preset.catalog.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${entry.preset.name} supplier page`}
          >
            {entry.supplier}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }
  const chips: FilterChip[] = [];
  if (filters.query?.trim())
    chips.push({
      id: 'query',
      label: `Search: ${filters.query}`,
      removeLabel: 'Clear standoff search',
      onRemove: () => update({ ...filters, query: '' }),
    });
  for (const [key, value] of activeSelects)
    chips.push({
      id: key,
      label: `${selectLabels[key as StandoffSelectKey]}: ${labelFor(key as StandoffSelectKey, String(value))}`,
      removeLabel: `Clear ${selectLabels[key as StandoffSelectKey].toLowerCase()} filter`,
      onRemove: () => update({ ...filters, values: { ...filters.values, [key]: '' } }),
    });
  for (const key of activeNumbers) {
    const range = parseNumericRange(filters[key] ?? {});
    const exact =
      !range.errors.length && range.range.min !== undefined && range.range.min === range.range.max;
    const text = exact
      ? String(filters[key]?.min)
      : `${String(filters[key]?.min ?? '').trim() || '…'}–${String(filters[key]?.max ?? '').trim() || '…'}`;
    chips.push({
      id: key,
      label: `${numericLabels[key]} ${text} mm`,
      removeLabel: `Clear ${numericLabels[key].toLowerCase()} filter`,
      onRemove: () => clearNumeric(key),
    });
  }
  return (
    <section
      className="catalog-model-picker standoff-picker"
      aria-label="Spacer and standoff selection"
    >
      <p className="catalog-model-hint">
        Set filters to narrow the list. Selecting an article updates the preview and keeps your
        filters.
      </p>
      <label className="catalog-model-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search standoffs"
          placeholder="M3 10, article or supplier SKU…"
          value={filters.query ?? ''}
          onChange={(event) => update({ ...filters, query: event.target.value })}
        />
      </label>
      <div className="standoff-fit-filters">
        {selectField('connection')}
        {selectField('thread')}
        <div className="standoff-number">
          <span>
            Body length <small>mm · excludes studs</small>
          </span>
          <div className="standoff-length-mode" role="group" aria-label="Body length filter mode">
            <button
              type="button"
              aria-pressed={!lengthRange}
              onClick={() => changeLengthMode(false)}
            >
              Catalog
            </button>
            <button type="button" aria-pressed={lengthRange} onClick={() => changeLengthMode(true)}>
              Range
            </button>
          </div>
          <small className="standoff-length-hint">
            Your catalog choice and entered range are remembered separately. Clear all removes both.
          </small>
          {lengthRange ? (
            rangeField('bodyLength', false)
          ) : (
            <select
              className="standoff-catalog-length"
              aria-label="Catalog body length"
              value={filters.bodyLength?.min ?? ''}
              onChange={(event) => chooseCatalogLength(event.target.value)}
            >
              <option value="">Any catalog length</option>
              {lengthOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    !option.count && String(option.value) !== String(filters.bodyLength?.min)
                  }
                >
                  {option.label} · {option.count.toLocaleString('en-US')}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectField('bodyForm')}
        {selectField('material')}
      </div>
      <details className="catalog-model-filter-group standoff-more-filters">
        <summary>
          <span>More filters</span>
          <ChevronDown size={13} aria-hidden="true" />
        </summary>
        <div className="standoff-fit-filters">
          {selectField('construction')}
          {selectField('supplier')}
          {selectField('coating')}
          {selectField('threadA')}
          {selectField('threadB')}
          {rangeField('bodyWidth')}
          {rangeField('overallLength')}
          {rangeField('bore')}
        </div>
      </details>
      <FilterChips label="Active standoff filters" items={chips} />
      {result.errors.length > 0 && (
        <p className="standoff-error" role="alert">
          {result.errors.map((error) => error.message).join(' ')}
        </p>
      )}
      {selectionError && (
        <p className="standoff-error" role="alert">
          {selectionError}
        </p>
      )}
      <div className="catalog-model-count">
        <strong aria-live="polite">
          {result.items.length.toLocaleString('en-US')} of {entries.length.toLocaleString('en-US')}{' '}
          models
        </strong>
        <button
          type="button"
          disabled={!activeCount && !lengthState.catalog && !lengthState.range}
          aria-label="Clear standoff filters"
          onClick={() => {
            update({});
            setLengthState({ mode: 'catalog' });
          }}
        >
          <RotateCcw size={12} /> Clear all
        </button>
      </div>
      {selectedExcluded && (
        <p className="catalog-model-selection-note" role="status">
          Previewing {selected.preset.name}, outside the requested configuration. Select a result
          below to apply its dimensions.
        </p>
      )}
      {pinnedSelection && (
        <div className="catalog-model-current">
          <span className="catalog-model-current-label">Current preview</span>
          {card(pinnedSelection, true)}
        </div>
      )}
      <div className="catalog-model-results">
        {visible.map((entry) => card(entry))}
        {!result.items.length && !result.errors.length && (
          <p className="catalog-model-empty" role="status">
            No matching standoffs. Remove a filter above or clear all to start again.
          </p>
        )}
      </div>
      {visibleCount < result.items.length && (
        <button
          className="catalog-model-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 24)}
        >
          Show more · {visible.length} of {result.items.length.toLocaleString('en-US')}
        </button>
      )}
    </section>
  );
}
