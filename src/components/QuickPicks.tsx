import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Search } from 'lucide-react';
import type { Parameters, PartDefinition, Preset } from '../core/types';
import {
  closestQuickPick,
  quickPickFields,
  quickPickLabel,
  quickPickMatches,
  quickPickOptions,
  updateQuickPickFilters,
} from '../core/quick-picks';
import type { QuickPickFilters } from '../core/quick-picks';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../core/preset-search';
import FilterChips from './FilterChips';
import './QuickPicks.css';

interface Props {
  part: PartDefinition;
  parameters: Parameters;
  presetId: string;
  onSelect: (preset: Preset) => void;
  initialQuery?: string;
  onQueryChange: (query: string) => void;
  onBrowse: (filters: QuickPickFilters, query?: string) => void;
}
export default function QuickPicks({
  part,
  parameters,
  presetId,
  initialQuery = '',
  onQueryChange,
  onSelect,
  onBrowse,
}: Props) {
  const fields = useMemo(() => quickPickFields(part), [part]);
  const [filters, setFilters] = useState<QuickPickFilters>({});
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const index = useMemo(() => buildPresetIndex([part]), [part]);
  const searched = useMemo(
    () =>
      filterPresets(index, { ...emptyPresetFilters(part), query }).items.map(
        (entry) => entry.preset,
      ),
    [index, part, query],
  );
  const matches = useMemo(() => quickPickMatches(searched, filters), [searched, filters]);
  const pageCount = Math.max(1, Math.ceil(matches.length / 4));
  const visiblePage = Math.min(page, pageCount - 1);
  const selectedPreset = part.presets.find((preset) => preset.id === presetId);
  function changeQuery(value: string) {
    setQuery(value);
    onQueryChange(value);
    setPage(0);
  }
  useEffect(() => {
    const available = new Set(fields.map((field) => field.key));
    setFilters((previous) =>
      Object.keys(previous).some((key) => !available.has(key))
        ? Object.fromEntries(Object.entries(previous).filter(([key]) => available.has(key)))
        : previous,
    );
  }, [fields]);
  useEffect(() => {
    const selectedIndex = matches.findIndex((preset) => preset.id === presetId);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / 4));
  }, [matches, presetId]);
  function choose(index: number, value: string) {
    const next = updateQuickPickFilters(fields, filters, index, value);
    setFilters(next);
    const candidates = quickPickMatches(searched, next);
    const candidate = closestQuickPick(candidates, fields, parameters);
    setPage(candidate ? Math.floor(candidates.indexOf(candidate) / 4) : 0);
    if (candidate) onSelect(candidate);
  }
  return (
    <section className="quick-picks" aria-label="Catalog size selection">
      <label className="quick-pick-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search catalog sizes"
          placeholder="Designation, size or SKU…"
          value={query}
          onChange={(event) => {
            changeQuery(event.target.value);
            setPage(0);
          }}
        />
      </label>
      <div className="quick-pick-fields">
        {fields.map((field, index) => {
          const options = quickPickOptions(part.presets, fields, filters, index, searched);
          return options.length ? (
            <label key={field.key}>
              <span>
                <small>{index + 1}</small>
                {field.label}
              </span>
              <select
                aria-label={`Catalog ${field.label.toLowerCase()}`}
                value={filters[field.key] ?? ''}
                onChange={(event) => choose(index, event.target.value)}
              >
                <option value="">Any {field.label.toLowerCase()}</option>
                {options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={!option.count && option.value !== filters[field.key]}
                  >
                    {option.label} · {option.count}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="quick-pick-custom-size" key={field.key}>
              <span>{field.label}</span>
              <strong>{quickPickLabel(field, parameters[field.key])}</strong>
              <small>Editable in Custom dimensions</small>
            </div>
          );
        })}
      </div>
      <FilterChips
        label="Active catalog size filters"
        items={[
          ...(query.trim()
            ? [
                {
                  id: 'query',
                  label: query,
                  removeLabel: 'Clear catalog size search',
                  onRemove: () => {
                    changeQuery('');
                    setPage(0);
                  },
                },
              ]
            : []),
          ...fields
            .filter((field) => !!filters[field.key])
            .map((field) => ({
              id: field.key,
              label: `${field.label}: ${quickPickLabel(field, filters[field.key])}`,
              removeLabel: `Clear catalog ${field.label.toLowerCase()} filter`,
              onRemove: () => {
                setFilters((current) => {
                  const next = { ...current };
                  delete next[field.key];
                  return next;
                });
                setPage(0);
              },
            })),
        ]}
      />
      <div className="quick-pick-count">
        <strong aria-live="polite">
          {matches.length.toLocaleString('en-US')} catalog{' '}
          {matches.length === 1 ? 'match' : 'matches'}
        </strong>
        <button
          aria-label="Clear catalog size filters"
          title="Clear size filters"
          disabled={!query && !Object.values(filters).some(Boolean)}
          onClick={() => {
            setFilters({});
            changeQuery('');
            setPage(0);
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <p className="quick-pick-hint">Select a size or result to update the 3D model.</p>
      {selectedPreset &&
        (query.trim() || Object.values(filters).some(Boolean)) &&
        !matches.some((preset) => preset.id === presetId) && (
          <p className="quick-pick-hint" role="status">
            Previewing {selectedPreset.name}, outside these filters. Select a result to change the
            model.
          </p>
        )}
      <div className="quick-pick-results">
        {matches.slice(visiblePage * 4, visiblePage * 4 + 4).map((preset) => (
          <article key={preset.id} className={preset.id === presetId ? 'selected' : ''}>
            <button
              className="quick-pick-result"
              aria-label={`Preview ${preset.name}`}
              aria-pressed={preset.id === presetId}
              onClick={() => onSelect(preset)}
            >
              <span className="quick-pick-standard">
                {preset.catalog?.standard ??
                  preset.catalog?.manufacturer ??
                  preset.catalog?.sourceName}
                {preset.id === presetId && <Check size={13} />}
              </span>
              <strong>{preset.name}</strong>
              <small>
                {fields
                  .filter((field) => field.type === 'select')
                  .map((field) => quickPickLabel(field, preset.parameters[field.key]))
                  .join(' · ') || preset.catalog?.sourceName}
              </small>
            </button>
            {preset.catalog?.sourceUrl && (
              <a href={preset.catalog.sourceUrl} target="_blank" rel="noreferrer">
                {preset.catalog!.sourceKind === 'attachment'
                  ? 'Reference drawing'
                  : `${preset.catalog!.sourceName} listing`}
                <ExternalLink size={11} />
              </a>
            )}
          </article>
        ))}
        {!matches.length && (
          <p>No sourced size matches. Adjust the filters or use custom dimensions.</p>
        )}
      </div>
      {pageCount > 1 && (
        <div className="quick-pick-pages">
          <button
            aria-label="Previous catalog matches"
            disabled={visiblePage === 0}
            onClick={() => setPage(visiblePage - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {visiblePage + 1} / {pageCount}
          </span>
          <button
            aria-label="Next catalog matches"
            disabled={visiblePage + 1 === pageCount}
            onClick={() => setPage(visiblePage + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <button className="quick-pick-browse" onClick={() => onBrowse(filters, query)}>
        <Search size={14} />
        Browse presets · advanced filters
      </button>
    </section>
  );
}
