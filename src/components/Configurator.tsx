import {
  BookmarkPlus,
  RotateCcw,
  ChevronDown,
  SlidersHorizontal,
  Info,
  Check,
  AlertCircle,
  Search,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReferenceSpecifications } from './ReferenceSpecifications';
import QuickPicks from './QuickPicks';
import { modelEvidence } from '../core/model-evidence';
import CatalogModelPicker from './CatalogModelPicker';
import { hasCatalogQuickSize, quickPickFields } from '../core/quick-picks';
import type { QuickPickFilters } from '../core/quick-picks';
import type { Parameters, PartDefinition, ParameterDefinition, Preset } from '../core/types';

interface Props {
  part: PartDefinition;
  parameters: Parameters;
  modelState: string;
  presetId: string;
  errors: string[];
  onChange: (key: string, value: number | string | boolean) => void;
  onState: (state: string) => void;
  onBrowse: (filters?: QuickPickFilters) => void;
  onFindMatching: () => void;
  onReset: () => void;
  onSave: () => void;
  onPreset: (preset: Preset) => void;
}

function ParameterField({
  field,
  value,
  onChange,
}: {
  field: ParameterDefinition;
  value: number | string | boolean;
  onChange: Props['onChange'];
}) {
  return (
    <div
      className={`parameter-field ${field.type === 'boolean' ? 'boolean-field' : ''} ${field.type === 'select' ? 'select-field' : ''}`}
    >
      <label htmlFor={`parameter-${field.key}`}>
        <span>{field.label}</span>
        {field.symbol && <span className="dimension-symbol">{field.symbol}</span>}
        {field.description && (
          <span className="field-tooltip" title={field.description} aria-label={field.description}>
            <Info size={12} />
          </span>
        )}
      </label>
      {field.type === 'number' && (
        <div className="number-input">
          <input
            id={`parameter-${field.key}`}
            type="number"
            step={field.step ?? 0.1}
            min={field.min}
            max={field.max}
            value={String(value)}
            onChange={(event) =>
              onChange(field.key, event.target.value === '' ? '' : Number(event.target.value))
            }
          />
          <span>{field.unit ?? 'mm'}</span>
        </div>
      )}
      {field.type === 'select' && (
        <div className="select-wrap">
          <select
            id={`parameter-${field.key}`}
            value={String(value)}
            onChange={(event) => onChange(field.key, event.target.value)}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
      )}
      {field.type === 'boolean' && (
        <input
          id={`parameter-${field.key}`}
          className="switch-input"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(field.key, event.target.checked)}
        />
      )}
    </div>
  );
}

export default function Configurator({
  part,
  parameters,
  modelState,
  presetId,
  errors,
  onChange,
  onState,
  onBrowse,
  onFindMatching,
  onReset,
  onSave,
  onPreset,
}: Props) {
  const evidence = modelEvidence(part, parameters, presetId);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const pickFields = quickPickFields(part);
  const [customMode, setCustomMode] = useState(() => !hasCatalogQuickSize(part, parameters));
  useEffect(() => {
    if (!part.catalogSelectionOnly && !hasCatalogQuickSize(part, parameters)) setCustomMode(true);
  }, [part, parameters]);
  const [pickerReset, setPickerReset] = useState(0);
  const selectedPreset = part.presets.find((preset) => preset.id === presetId);
  const visibleFields = part.parameters.filter(
    (field) =>
      (!field.visibleWhen || field.visibleWhen(parameters, modelState)) &&
      (!part.catalogSelectionOnly ||
        !part.catalogSelection?.some((selection) => selection.key === field.key)) &&
      (part.catalogSelectionOnly ||
        customMode ||
        (field.type !== 'number' && !pickFields.some((pick) => pick.key === field.key))),
  );
  return (
    <aside className="configurator">
      <div className="config-heading">
        <SlidersHorizontal size={17} />
        <h2>{part.catalogSelectionOnly ? 'Select model & pose' : 'Configure part'}</h2>
        <span className="live-label">
          <span />
          Live
        </span>
      </div>
      <div className="config-scroll">
        <section className="preset-section">
          <div className="field-title">
            <span className="preset-field-label">
              {part.catalogSelectionOnly ? 'MODEL CATALOG' : 'SIZE & CATALOG'}
              {part.presets.length > 0
                ? ` · ${part.presets.length.toLocaleString('en-US')} AVAILABLE`
                : ''}
            </span>
            <button
              className="icon-button"
              title="Save current parameters as a preset"
              aria-label="Save preset"
              onClick={onSave}
              disabled={!!errors.length}
            >
              <BookmarkPlus size={17} />
            </button>
          </div>
          {!part.catalogSelectionOnly && part.presets.length > 0 && (
            <div className="preset-finder-actions">
              <button onClick={() => onBrowse()}>
                <Search size={14} />
                {part.presets.some((preset) => preset.catalog)
                  ? 'Choose a catalog preset'
                  : 'Choose a prototype preset'}
              </button>
            </div>
          )}
          {!part.catalogSelectionOnly &&
            pickFields.length === 0 &&
            part.presets.length > 0 &&
            part.presets.length <= 100 && (
              <div className="parameter-field select-field">
                <label htmlFor="part-preset">Starting configuration</label>
                <div className="select-wrap">
                  <select
                    id="part-preset"
                    value={selectedPreset?.id ?? ''}
                    onChange={(event) => {
                      const preset = part.presets.find((item) => item.id === event.target.value);
                      if (preset) onPreset(preset);
                    }}
                  >
                    <option value="" disabled>
                      Custom configuration
                    </option>
                    {part.presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
            )}
          {!part.catalogSelectionOnly && pickFields.length > 0 && (
            <div className="configuration-mode" aria-label="Configuration mode">
              <button
                className={!customMode ? 'active' : ''}
                aria-pressed={!customMode}
                onClick={() => setCustomMode(false)}
              >
                Catalog sizes
              </button>
              <button
                className={customMode ? 'active' : ''}
                aria-pressed={customMode}
                onClick={() => setCustomMode(true)}
              >
                Custom dimensions
              </button>
            </div>
          )}
          {part.catalogSelectionOnly ? (
            <CatalogModelPicker
              key={`${part.id}-${pickerReset}`}
              part={part}
              presetId={presetId}
              onSelect={onPreset}
            />
          ) : !customMode ? (
            <QuickPicks
              key={`${part.id}-${pickerReset}`}
              part={part}
              parameters={parameters}
              presetId={presetId}
              onSelect={onPreset}
              onBrowse={onBrowse}
            />
          ) : null}
          <details className="model-evidence">
            <summary>{evidence.label}</summary>
            <p>{evidence.summary}</p>
            <p>{evidence.limitations}</p>
            {evidence.source && (
              <a href={evidence.source} target="_blank" rel="noreferrer">
                Geometry reference <ArrowUpRight size={12} />
              </a>
            )}
          </details>
          <details
            className="preset-reference-details"
            open={(!part.catalogSelectionOnly && customMode) || undefined}
          >
            <summary>{selectedPreset?.name ?? 'Current configuration'} · details</summary>
            <div className="current-preset">
              <strong>{selectedPreset?.name ?? 'Custom configuration'}</strong>
              <span>
                {selectedPreset?.catalog
                  ? selectedPreset.catalog.sourceKind === 'attachment'
                    ? 'Reference dimensions'
                    : 'Catalog dimensions'
                  : selectedPreset
                    ? 'Prototype example'
                    : 'Your dimensions, ready to refine'}
              </span>
            </div>
            {!part.catalogSelectionOnly && (
              <div className="preset-finder-actions">
                <button onClick={() => onBrowse()}>
                  <Search size={14} />
                  Browse presets
                </button>
                <button onClick={onFindMatching}>
                  <Filter size={14} />
                  Find matching
                </button>
              </div>
            )}
            {selectedPreset?.catalog?.sourceUrl && (
              <a
                className="current-preset-source"
                href={selectedPreset.catalog.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {selectedPreset.catalog.sourceKind === 'attachment'
                  ? 'Attached reference'
                  : `${selectedPreset.catalog.sourceName} reference`}{' '}
                <ArrowUpRight size={12} />
              </a>
            )}
            <p>
              {selectedPreset?.description ??
                'Search by size or use your current parameters as filters.'}
            </p>
            <ReferenceSpecifications catalog={selectedPreset?.catalog} />
          </details>
        </section>
        {part.states && (
          <section className="state-section">
            <div className="section-label">MODEL STATE</div>
            <div className={`state-options${part.states.length > 3 ? ' state-options-grid' : ''}`}>
              {part.states.map((state) => (
                <button
                  key={state.id}
                  className={state.id === modelState ? 'active' : ''}
                  onClick={() => onState(state.id)}
                  aria-pressed={state.id === modelState}
                  title={state.description}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </section>
        )}
        {[...new Set(visibleFields.map((field) => field.group))].map((group, index) => (
          <section className="parameter-group" key={group}>
            <button
              className="group-heading"
              aria-expanded={!collapsed.includes(group)}
              onClick={() =>
                setCollapsed((current) =>
                  current.includes(group)
                    ? current.filter((item) => item !== group)
                    : [...current, group],
                )
              }
            >
              <span className="group-number">0{index + 1}</span>
              <span>{group}</span>
              <ChevronDown size={14} className={collapsed.includes(group) ? 'collapsed' : ''} />
            </button>
            {!collapsed.includes(group) && (
              <div className="parameter-fields">
                {visibleFields
                  .filter((field) => field.group === group)
                  .map((field) => (
                    <ParameterField
                      key={`${part.id}-${field.key}`}
                      field={field}
                      value={parameters[field.key]}
                      onChange={onChange}
                    />
                  ))}
              </div>
            )}
          </section>
        ))}
        {!errors.length && !!part.assessment?.(parameters).length && (
          <section className="config-note" aria-label="Design assessment">
            {part.assessment(parameters).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        )}
        {errors.length > 0 ? (
          <div className="validation-error" role="alert">
            <AlertCircle size={16} />
            <div>
              <strong>Check your dimensions</strong>
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          </div>
        ) : (
          <details className="config-note">
            <summary>
              <Info size={15} /> Modeling notes
            </summary>
            <p>
              {part.notes ??
                'Dimensions are in millimeters. Configure your part, then copy the script into the FreeCAD Python console.'}
            </p>
          </details>
        )}
        {!!part.sources?.some((source) => source.url) && (
          <details className="reference-sources">
            <summary>Reference dimensions & sources</summary>
            {part.sources
              .filter((source) => source.url)
              .map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
              ))}
          </details>
        )}
      </div>
      <div className="config-bottom">
        <div className={errors.length ? 'geometry-status invalid' : 'geometry-status'}>
          {errors.length ? <AlertCircle size={14} /> : <Check size={14} />}
          <span>
            {errors.length ? 'Parameters need attention' : 'Parameters valid · ready to export'}
          </span>
        </div>
        <button
          className="reset-button"
          onClick={() => {
            onReset();
            setPickerReset((value) => value + 1);
          }}
        >
          <RotateCcw size={15} />
          Reset parameters
        </button>
      </div>
    </aside>
  );
}
