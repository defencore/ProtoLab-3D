import { Check, ChevronDown, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { catalogFilterErrors, catalogValue, matchesCatalogFilters } from '../core/catalog-models';
import type { CatalogModelFilters } from '../core/catalog-models';
import type { ParameterDefinition, PartDefinition, Preset } from '../core/types';
import './CatalogModelPicker.css';

interface Props {
  part: PartDefinition;
  presetId: string;
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
  return Object.values(filter ?? {}).some((value) => value !== undefined && value !== '');
}

export default function CatalogModelPicker({ part, presetId, onSelect }: Props) {
  const fields = part.catalogFilterFields ?? [];
  const [filters, setFilters] = useState<CatalogModelFilters>({});
  const [query, setQuery] = useState('');
  const groups = [...new Set(fields.map((field) => field.group))];
  const summaryFields = fields.filter((field) => field.catalogSummary);
  const conditionFields = fields.filter((field) => field.catalogCondition);
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return part.presets.filter(
      (preset) =>
        matchesCatalogFilters(preset, part.catalogFilterFields ?? [], filters) &&
        (!search ||
          [preset.name, preset.catalog?.manufacturer, preset.catalog?.designation]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase()
            .includes(search)),
    );
  }, [part, filters, query]);
  const selectedOutsideResults = !!presetId && !matches.some((preset) => preset.id === presetId);
  const selectedPreset = part.presets.find((preset) => preset.id === presetId);
  const activeCount = fields.filter((field) => isActive(filters[field.key])).length;

  function changeFilter(key: string, property: 'min' | 'max' | 'value', value: string) {
    setFilters((current) => ({
      ...current,
      [key]: { ...current[key], [property]: value },
    }));
  }

  return (
    <section className="catalog-model-picker" aria-label="Catalog model selection">
      <p className="catalog-model-hint">
        Choose a manufactured model. Filters narrow the selection; product dimensions stay fixed.
      </p>
      <label className="catalog-model-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search catalog models"
          placeholder="Model or manufacturer…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
                  const options =
                    field.options ??
                    [...new Set(part.presets.map((preset) => catalogValue(preset, field.key)))]
                      .filter((value) => value !== undefined && value !== '')
                      .map((value) => ({
                        value: String(value),
                        label: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
                      }))
                      .sort((left, right) => left.label.localeCompare(right.label));
                  return (
                    <div className="catalog-model-filter" key={field.key}>
                      <div className="catalog-model-filter-label">
                        <span>{field.label}</span>
                        {field.unit && <span>{field.unit}</span>}
                      </div>
                      {field.type === 'number' ? (
                        <div className="catalog-model-range">
                          <input
                            type="number"
                            aria-label={`Minimum ${field.label.toLowerCase()}`}
                            aria-invalid={!!errors.length || undefined}
                            placeholder="Min"
                            step="any"
                            value={filter.min ?? ''}
                            onChange={(event) => changeFilter(field.key, 'min', event.target.value)}
                          />
                          <span aria-hidden="true">–</span>
                          <input
                            type="number"
                            aria-label={`Maximum ${field.label.toLowerCase()}`}
                            aria-invalid={!!errors.length || undefined}
                            placeholder="Max"
                            step="any"
                            value={filter.max ?? ''}
                            onChange={(event) => changeFilter(field.key, 'max', event.target.value)}
                          />
                        </div>
                      ) : (
                        <select
                          aria-label={`Filter ${field.label.toLowerCase()}`}
                          value={filter.value ?? ''}
                          onChange={(event) => changeFilter(field.key, 'value', event.target.value)}
                        >
                          <option value="">Any</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.length ? (
                        <small className="catalog-model-range-error" role="alert">
                          {errors.join(' ')}
                        </small>
                      ) : field.description ? (
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
      <div className="catalog-model-count">
        <strong aria-live="polite" aria-atomic="true">
          {matches.length} of {part.presets.length} models
        </strong>
        <button
          type="button"
          disabled={!activeCount && !query}
          onClick={() => {
            setFilters({});
            setQuery('');
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
      <div className="catalog-model-results">
        {matches.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={`catalog-model-result${preset.id === presetId ? ' selected' : ''}`}
            aria-label={`Select ${preset.name}`}
            aria-pressed={preset.id === presetId}
            onClick={() => onSelect(preset)}
          >
            <span className="catalog-model-manufacturer">
              <span>{preset.catalog?.manufacturer ?? preset.catalog?.sourceName}</span>
              {preset.id === presetId && <Check size={14} aria-hidden="true" />}
            </span>
            <strong>{preset.name}</strong>
            {!!summaryFields.length && (
              <span className="catalog-model-summary">
                {summaryFields.map((field) => (
                  <span className="catalog-model-metric" key={field.key}>
                    <span>{field.label}</span>
                    <b>{displayValue(preset, field)}</b>
                    {preset.catalog?.attributeConditions?.[field.key] && (
                      <small>{preset.catalog.attributeConditions[field.key]}</small>
                    )}
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
        ))}
        {!matches.length && (
          <p className="catalog-model-empty" role="status">
            No models match these filters. Change the ranges or clear filters to see all models.
          </p>
        )}
      </div>
    </section>
  );
}
