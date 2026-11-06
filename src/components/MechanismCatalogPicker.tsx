import { Check, RotateCcw, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  emptyMechanismFilters,
  filterMechanismExecutions,
  matchingMechanismPreset,
  mechanismExecutionChoices,
  mechanismFacetLabels,
  mechanismParametersMatch,
  screwKindLabels,
  type MechanismExecutionFilters,
  type MechanismFacet,
} from '../core/mechanism-catalog';
import { numericRangeErrorMessage, parseNumericRange } from '../core/numeric-range';
import type { Parameters, PartDefinition, Preset } from '../core/types';
import FilterChips from './FilterChips';
import './MechanismCatalogPicker.css';

interface Props {
  parts: PartDefinition[];
  selectedPart: PartDefinition;
  parameters?: Parameters;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectPart: (part: PartDefinition) => void;
  onSelectModel?: (part: PartDefinition, preset: Preset) => void;
}

export default function MechanismCatalogPicker({
  parts,
  selectedPart,
  parameters = selectedPart.defaults,
  query,
  onQueryChange,
  onSelectPart,
  onSelectModel,
}: Props) {
  const headingId = useId();
  const rangeErrorId = useId();
  const [constraints, setConstraints] = useState(emptyMechanismFilters);
  const filters = useMemo(() => ({ ...constraints, query }), [constraints, query]);
  const choices = useMemo(() => mechanismExecutionChoices(parts, filters), [parts, filters]);
  const matches = useMemo(() => filterMechanismExecutions(parts, filters), [parts, filters]);
  const range = parseNumericRange(filters.lead ?? {});
  const results = useRef<HTMLUListElement>(null);
  const currentMatches = mechanismParametersMatch(selectedPart, parameters, filters);
  const filtered =
    !!query.trim() ||
    Object.keys(mechanismFacetLabels).some((key) => !!filters[key as MechanismFacet]) ||
    !!filters.lead?.min ||
    !!filters.lead?.max;
  const extraCount =
    Number(!!filters.material) +
    Number(!!filters.process) +
    Number(!!filters.lead?.min || !!filters.lead?.max);

  useEffect(() => {
    const list = results.current;
    const selected = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list) return;
    if (!selected) {
      list.scrollTop = 0;
      return;
    }
    const bottom = selected.offsetTop + selected.offsetHeight;
    if (selected.offsetTop < list.scrollTop) list.scrollTop = selected.offsetTop;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [selectedPart.id, matches]);

  function update(key: MechanismFacet, value: string) {
    setConstraints((current) => ({ ...current, [key]: value }));
  }

  function executionCard(part: PartDefinition, current = false) {
    const execution = part.mechanismExecution!;
    const selected = selectedPart.id === part.id;
    const preset = matchingMechanismPreset(part, filters);
    const values =
      current || (selected && currentMatches) ? parameters : (preset?.parameters ?? part.defaults);
    const screws = execution.screws.filter(
      (screw) =>
        !screw.when || Object.entries(screw.when).every(([key, value]) => values[key] === value),
    );
    const motors = execution.motors.filter(
      (motor) =>
        !motor.when || Object.entries(motor.when).every(([key, value]) => values[key] === value),
    );
    return (
      <button
        type="button"
        className="mechanism-execution-card"
        aria-label={part.name}
        aria-pressed={selected && (current || currentMatches)}
        title={part.name}
        onClick={() => {
          if (current) return;
          if (selected && currentMatches) return;
          if (filtered && preset && onSelectModel) onSelectModel(part, preset);
          else if (!selected) onSelectPart(part);
        }}
      >
        <span className="mechanism-execution-card-heading">
          <strong>{part.name}</strong>
          {selected && (current || currentMatches) && (
            <span className="mechanism-execution-selected">
              <Check size={11} aria-hidden="true" />
              Selected
            </span>
          )}
        </span>
        <span className="mechanism-execution-summary">
          {screws.map((screw) => (
            <span key={screw.designation}>
              {screwKindLabels[screw.kind]} · {screw.designation} · lead {screw.lead} mm/rev
              {screw.pitch !== undefined && ` · pitch ${screw.pitch} mm`}
              {screw.starts !== undefined &&
                ` · ${screw.starts} ${screw.starts === 1 ? 'start' : 'starts'}`}
            </span>
          ))}
          <span>{motors.map((motor) => motor.model).join(' / ')}</span>
        </span>
        <span className="mechanism-execution-description">{execution.construction}</span>
        {!current && (
          <span className="mechanism-execution-description">
            {execution.materials.join(' · ')}
            <br />
            {execution.processes.join(' · ')}
          </span>
        )}
        {filtered && !current && preset && !(selected && currentMatches) && (
          <span className="mechanism-execution-configuration">
            {selected && !currentMatches
              ? 'Apply matching configuration: '
              : 'Matching configuration: '}
            {preset.name}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="mechanism-catalog-picker" aria-labelledby={headingId}>
      <div className="mechanism-catalog-heading">
        <h3 id={headingId}>Mechanism catalog</h3>
        <span>{parts.length}</span>
      </div>
      <p className="mechanism-catalog-hint">Choose a construction with matching components.</p>
      <label className="mechanism-catalog-search">
        <Search size={13} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search mechanism executions"
          placeholder="Screw, motor, material or construction"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className="mechanism-catalog-filters">
        {(['screwKind', 'drive', 'motor', 'outputs'] as MechanismFacet[]).map((key) => (
          <label key={key}>
            <span>{mechanismFacetLabels[key]}</span>
            <select
              aria-label={`Filter mechanism ${mechanismFacetLabels[key].toLowerCase()}`}
              value={filters[key] ?? ''}
              onChange={(event) => update(key, event.target.value)}
            >
              <option value="">All</option>
              {choices.facets[key].map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={!option.count && option.value !== filters[key]}
                >
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <details className="mechanism-catalog-more">
        <summary>
          Materials, manufacturing &amp; lead{extraCount ? ` · ${extraCount} active` : ''}
        </summary>
        <p className="mechanism-catalog-hint">
          Materials describe structural and transmission components; processes describe custom
          details.
        </p>
        <div className="mechanism-catalog-filters">
          {(['material', 'process'] as MechanismFacet[]).map((key) => (
            <label key={key}>
              <span>{mechanismFacetLabels[key]}</span>
              <select
                aria-label={`Filter mechanism ${mechanismFacetLabels[key].toLowerCase()}`}
                value={filters[key] ?? ''}
                onChange={(event) => update(key, event.target.value)}
              >
                <option value="">All</option>
                {choices.facets[key].map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={!option.count && option.value !== filters[key]}
                  >
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <fieldset className="mechanism-catalog-lead">
          <legend>Screw lead · mm per revolution</legend>
          <div>
            {(['min', 'max'] as const).map((bound) => (
              <label key={bound}>
                <span>{bound === 'min' ? 'Minimum' : 'Maximum'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`${bound === 'min' ? 'Minimum' : 'Maximum'} screw lead`}
                  aria-invalid={range.errors.length > 0}
                  aria-describedby={range.errors.length ? rangeErrorId : undefined}
                  placeholder={bound === 'min' ? 'From' : 'To'}
                  value={filters.lead?.[bound] ?? ''}
                  onChange={(event) =>
                    setConstraints((previous) => ({
                      ...previous,
                      lead: {
                        min: previous.lead?.min ?? '',
                        max: previous.lead?.max ?? '',
                        [bound]: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {range.errors.length > 0 && (
            <p id={rangeErrorId} role="alert">
              {range.errors.map(numericRangeErrorMessage).join(' ')}
            </p>
          )}
        </fieldset>
      </details>
      <FilterChips
        label="Active mechanism filters"
        items={[
          ...(query.trim()
            ? [
                {
                  id: 'query',
                  label: `Search: ${query}`,
                  removeLabel: 'Clear mechanism search',
                  onRemove: () => onQueryChange(''),
                },
              ]
            : []),
          ...(Object.keys(mechanismFacetLabels) as MechanismFacet[]).flatMap((key) =>
            filters[key]
              ? [
                  {
                    id: key,
                    label:
                      choices.facets[key].find((item) => item.value === filters[key])?.label ??
                      filters[key]!,
                    removeLabel: `Clear mechanism ${mechanismFacetLabels[key].toLowerCase()} filter`,
                    onRemove: () => update(key, ''),
                  },
                ]
              : [],
          ),
          ...(filters.lead?.min || filters.lead?.max
            ? [
                {
                  id: 'lead',
                  label: `Lead: ${filters.lead.min || '…'}–${filters.lead.max || '…'} mm/rev`,
                  removeLabel: 'Clear screw lead filter',
                  onRemove: () =>
                    setConstraints((previous) => ({ ...previous, lead: { min: '', max: '' } })),
                },
              ]
            : []),
        ]}
      />
      <div className="mechanism-catalog-count">
        <span role="status" aria-live="polite">
          {matches.length} of {parts.length} executions
        </span>
        <button
          type="button"
          disabled={!filtered}
          onClick={() => {
            setConstraints(emptyMechanismFilters());
            onQueryChange('');
          }}
        >
          <RotateCcw size={11} aria-hidden="true" />
          Clear filters
        </button>
      </div>
      {!currentMatches && (
        <details className="mechanism-catalog-pinned">
          <summary>Current configuration is outside these filters.</summary>
          {executionCard(selectedPart, true)}
        </details>
      )}
      <ul
        className="mechanism-catalog-results"
        aria-label="Ready mechanism executions"
        ref={results}
      >
        {matches.map((part) => (
          <li key={part.id}>{executionCard(part)}</li>
        ))}
      </ul>
      {!matches.length && (
        <p className="mechanism-catalog-empty">No executions match. Adjust or clear the filters.</p>
      )}
    </section>
  );
}
