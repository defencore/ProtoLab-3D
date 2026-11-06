import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type {
  DiscoveryCandidate,
  DiscoveryChoices,
  DiscoveryFilters,
  DiscoverySuggestion,
} from '../core/discovery-types';
import { discoveryTraitLabel } from '../core/discovery-traits';

export interface LibraryDiscoveryPanelProps {
  query: string;
  filters: DiscoveryFilters;
  choices: DiscoveryChoices;
  suggestions: DiscoverySuggestion[];
  candidates: DiscoveryCandidate[];
  total: number;
  errors: string[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  onSuggestion: (suggestion: DiscoverySuggestion) => void;
  onSelect: (candidate: DiscoveryCandidate) => void;
  onShowMore?: () => void;
  activeSuggestion?: number;
  suggestionListId: string;
  pending?: boolean;
}

function candidateHighlights(candidate: DiscoveryCandidate) {
  const first = candidate.traits.filter(
    (trait, index, all) => all.findIndex((item) => item.kind === trait.kind) === index,
  );
  return [...first, ...candidate.traits.filter((trait) => !first.includes(trait))].slice(0, 4);
}

/** Discovery refines known characteristics; only a result click selects a configuration. */
export default function LibraryDiscoveryPanel({
  query,
  filters,
  choices,
  suggestions,
  candidates,
  total,
  errors,
  expanded,
  onExpandedChange,
  onFiltersChange,
  onSuggestion,
  onSelect,
  onShowMore,
  activeSuggestion,
  suggestionListId,
  pending = false,
}: LibraryDiscoveryPanelProps) {
  const fieldsId = `${suggestionListId}-characteristics`;
  const errorId = `${suggestionListId}-errors`;
  const hasWidth = !!filters.width.min.trim() || !!filters.width.max.trim();
  const active = !!filters.power || !!filters.bearing || !!filters.widthKind || hasWidth;
  const showCandidates = !!query.trim() || active || candidates.length > 0;
  const optionLabel = (key: keyof DiscoveryChoices, value: string) =>
    choices[key].find((option) => option.value === value)?.label ?? value;
  const chips = [
    ...(filters.power
      ? [
          {
            key: 'power',
            label: `Power: ${optionLabel('power', filters.power)}`,
            remove: () => onFiltersChange({ ...filters, power: '' }),
          },
        ]
      : []),
    ...(filters.bearing
      ? [
          {
            key: 'bearing',
            label: `Bearing: ${optionLabel('bearing', filters.bearing)}`,
            remove: () => onFiltersChange({ ...filters, bearing: '' }),
          },
        ]
      : []),
    ...(filters.widthKind
      ? [
          {
            key: 'width-kind',
            label: `Width: ${optionLabel('widthKind', filters.widthKind)}`,
            remove: () => onFiltersChange({ ...filters, widthKind: '' }),
          },
        ]
      : []),
    ...(hasWidth
      ? [
          {
            key: 'width-range',
            label: `Width: ${filters.width.min || '…'}–${filters.width.max || '…'} mm`,
            remove: () => onFiltersChange({ ...filters, width: { min: '', max: '' } }),
          },
        ]
      : []),
  ];

  return (
    <section className="library-discovery" aria-label="Find by characteristics" aria-busy={pending}>
      <button
        type="button"
        className="library-discovery-toggle"
        aria-expanded={expanded}
        aria-controls={fieldsId}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={13} aria-hidden="true" />
        ) : (
          <ChevronRight size={13} aria-hidden="true" />
        )}
        <span>Choose characteristics</span>
        <small>Power · bearing · width</small>
      </button>
      {expanded && (
        <div className="library-discovery-fields" id={fieldsId}>
          <p>Combine what you know, then select a configuration to preview it.</p>
          {(['power', 'bearing'] as const).map((key) => (
            <label key={key}>
              <span>{key === 'power' ? 'Power' : 'Bearing'}</span>
              <select
                aria-label={key === 'power' ? 'Filter by power' : 'Filter by bearing'}
                value={filters[key]}
                onChange={(event) => onFiltersChange({ ...filters, [key]: event.target.value })}
              >
                <option value="">{key === 'power' ? 'Any power' : 'Any bearing'}</option>
                {choices[key]
                  .filter(
                    (option) =>
                      key !== 'bearing' || option.count > 0 || option.value === filters.bearing,
                  )
                  .map((option) => (
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
          <label>
            <span>Width meaning</span>
            <select
              aria-label="Width meaning"
              value={filters.widthKind}
              onChange={(event) => onFiltersChange({ ...filters, widthKind: event.target.value })}
            >
              <option value="">Any documented width</option>
              {choices.widthKind.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={!option.count && option.value !== filters.widthKind}
                >
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <div className="library-discovery-width">
            {(['min', 'max'] as const).map((bound) => (
              <label key={bound}>
                <span>
                  {bound === 'min' ? 'Minimum width' : 'Maximum width'} <small>mm</small>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={bound === 'min' ? 'Minimum width' : 'Maximum width'}
                  aria-invalid={errors.length > 0}
                  aria-describedby={errors.length ? errorId : undefined}
                  placeholder={bound === 'min' ? 'From' : 'To'}
                  value={filters.width[bound]}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      width: { ...filters.width, [bound]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      )}
      {chips.length > 0 && (
        <div
          className="library-discovery-chips"
          role="group"
          aria-label="Active characteristic filters"
        >
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={`Remove ${chip.label}`}
            >
              {chip.label}
              <X size={11} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {errors.length > 0 && (
        <div className="library-discovery-errors" id={errorId} role="alert">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="library-discovery-suggestions">
          <h3>Suggestions</h3>
          <ul id={suggestionListId} role="listbox" aria-label="Search suggestions">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <li key={suggestion.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${suggestionListId}-${index}`}
                  aria-selected={index === activeSuggestion}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSuggestion(suggestion)}
                >
                  <span>
                    <strong>{suggestion.label}</strong>
                    <small>{suggestion.detail}</small>
                  </span>
                  <small className="library-discovery-suggestion-count">{suggestion.count}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showCandidates && (
        <section className="library-discovery-matches" aria-label="Matching configurations">
          <div className="library-discovery-results-heading">
            <h3>Matching configurations</h3>
            <span>{pending ? '…' : total}</span>
          </div>
          {candidates.length > 0 && !errors.length ? (
            <ul aria-label="Configuration choices">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="library-discovery-candidate"
                    aria-label={`Preview ${candidate.preset.name}`}
                    disabled={pending}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(candidate)}
                  >
                    <span className="library-discovery-candidate-type">
                      {candidate.family.label} ·{' '}
                      {candidate.preset.catalog ? 'Catalog' : 'Prototype'}
                    </span>
                    <strong>{candidate.preset.name}</strong>
                    <span className="library-discovery-traits">
                      {candidateHighlights(candidate).map((trait, index) => (
                        <span key={`${trait.kind}:${trait.key}:${index}`}>
                          {discoveryTraitLabel(trait)}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !errors.length ? (
            <p className="library-discovery-empty">
              {pending
                ? 'Searching configurations…'
                : 'No configuration matches these characteristics.'}
            </p>
          ) : null}
          {onShowMore && candidates.length < total && !errors.length && !pending && (
            <button type="button" className="library-discovery-more" onClick={onShowMore}>
              Show more configurations · {candidates.length} of {total}
            </button>
          )}
        </section>
      )}
    </section>
  );
}
