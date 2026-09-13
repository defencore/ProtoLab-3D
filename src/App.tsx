import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Expand,
  FileCode2,
  FileJson,
  Grid2X2,
  Keyboard,
  Layers3,
  Menu,
  MousePointer2,
  Move,
  Rotate3D,
  Ruler,
  Settings2,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import Catalog from './components/Catalog';
import Configurator from './components/Configurator';
import ModelViewer from './components/ModelViewer';
import Modal from './components/Modal';
import PresetBrowser from './components/PresetBrowser';
import { Brand, PartIcon } from './components/PartIcon';
import { parts } from './parts';
import { generateScript, consoleCommand } from './core/freecad';
import { validateParameters } from './core/validation';
import { parseConfiguration } from './core/configuration';
import { downloadFile, downloadStl } from './core/download';
import { readPresets, storePresets, type SavedPreset } from './core/storage';
import type { Parameters, PartDefinition, Preset } from './core/types';
import type { QuickPickFilters } from './core/quick-picks';
import { emptyPresetFilters, fieldId, type PresetFilters } from './core/preset-search';
import {
  defaultPartSelection,
  matchingPresetId,
  reconcilePartSelection,
} from './core/part-selection';

type DisplayMode = 'solid' | 'wireframe' | 'xray';
type View = 'isometric' | 'front' | 'top' | 'right';
type Dialog = 'script' | 'guide' | 'presets' | 'save' | 'catalog' | null;

export default function App() {
  if (!parts.length)
    return (
      <main className="empty-presets" role="status">
        <Brand />
        <h1>The part library is empty.</h1>
        <p>Add a part module to load its configurator and preview.</p>
      </main>
    );
  return <PartWorkspace parts={parts} />;
}

function PartWorkspace({ parts }: { parts: PartDefinition[] }) {
  const initialPart = parts.find((item) => item.defaultSelection) ?? parts[0];
  const [selectedPartId, setSelectedPartId] = useState(initialPart.id);
  const part = parts.find((item) => item.id === selectedPartId) ?? initialPart;
  const [storedParameters, setParameters] = useState<Parameters>({ ...initialPart.defaults });
  const [storedModelState, setModelState] = useState(initialPart.states?.[0]?.id ?? 'default');
  const [storedPresetId, setPresetId] = useState(() => defaultPartSelection(initialPart).presetId);
  const loadedDefinition = useRef(part);
  const moduleChanged = loadedDefinition.current !== part;
  const selection = moduleChanged
    ? reconcilePartSelection(part, loadedDefinition.current, {
        partId: selectedPartId,
        parameters: storedParameters,
        modelState: storedModelState,
        presetId: storedPresetId,
      })
    : {
        partId: selectedPartId,
        parameters: storedParameters,
        modelState: storedModelState,
        presetId: storedPresetId,
      };
  const { parameters, modelState, presetId } = selection;
  if (moduleChanged) {
    loadedDefinition.current = part;
    setSelectedPartId(selection.partId);
    setParameters(parameters);
    setModelState(modelState);
    setPresetId(presetId);
  }
  const [displayMode, setDisplayMode] = useState<DisplayMode>('solid');
  const [view, setView] = useState<View>('isometric');
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [catalogMode, setCatalogMode] = useState<'all' | 'browse' | 'match'>('browse');
  const [catalogFilters, setCatalogFilters] = useState<PresetFilters>();
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [savedPresets, setSavedPresets] = useState(() => readPresets(parts));
  const availableSavedPresets = savedPresets.filter((preset) =>
    parts.some((item) => item.id === preset.partId),
  );
  const [presetName, setPresetName] = useState('');
  const [toast, setToast] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'library' | 'config' | null>(null);
  const [viewerError, setViewerError] = useState('');
  const exportMenu = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const errors = useMemo(
    () => validateParameters(part, parameters, modelState),
    [part, parameters, modelState],
  );
  const validPreview = useRef({ part, parameters, modelState });
  if (!errors.length) validPreview.current = { part, parameters, modelState };
  const preview = validPreview.current;
  const dimensions = useMemo(
    () => preview.part.dimensions(preview.parameters, preview.modelState),
    [preview.part, preview.parameters, preview.modelState],
  );
  const script = useMemo(
    () => (errors.length ? '' : generateScript(part, parameters, modelState)),
    [part, parameters, modelState, errors.length],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!exportMenu.current?.contains(event.target as Node)) setExportOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportOpen(false);
        setMobilePanel(null);
        setDialog((current) => (current === 'catalog' ? null : current));
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', key);
    };
  }, []);

  function selectPart(
    next: PartDefinition,
    values = next.defaults,
    state = next.states?.[0].id ?? 'default',
  ) {
    loadedDefinition.current = next;
    setSelectedPartId(next.id);
    setParameters({ ...values });
    setModelState(state);
    setViewerError('');
    setPresetId(matchingPresetId(next, values));
    setFitToken((token) => token + 1);
  }
  function openPresetBrowser(mode: 'all' | 'browse' | 'match', quickFilters?: QuickPickFilters) {
    setCatalogMode(mode);
    const next = quickFilters ? emptyPresetFilters(part) : undefined;
    if (next && quickFilters)
      for (const field of part.parameters) {
        const value = quickFilters[field.key];
        if (value)
          next.parameters[fieldId(field)] =
            field.type === 'number' ? { min: value, max: value } : { value };
      }
    setCatalogFilters(next);
    setCatalogRevision((revision) => revision + 1);
    setDialog('catalog');
    setMobilePanel(null);
  }
  function applyPreset(next: PartDefinition, preset: Preset) {
    const state =
      next.id === part.id && !validateParameters(next, preset.parameters, modelState).length
        ? modelState
        : (next.states?.[0].id ?? 'default');
    selectPart(next, preset.parameters, state);
    setPresetId(preset.id);
  }
  function openMobilePanel(panel: 'library' | 'config') {
    setDialog((current) => (current === 'catalog' ? null : current));
    setMobilePanel(panel);
  }
  async function copyScript() {
    if (errors.length) return;
    try {
      await navigator.clipboard.writeText(consoleCommand(script));
      setToast('Script copied. Paste into the FreeCAD Python console.');
    } catch {
      setDialog('script');
      setToast('Select and copy the console command in the script window.');
    }
  }
  function exportPart(format: 'macro' | 'stl' | 'json') {
    if (errors.length) return;
    try {
      if (format === 'macro') downloadFile(script, `${part.id}.FCMacro`, 'text/x-python');
      if (format === 'stl') downloadStl(part, parameters, modelState);
      if (format === 'json')
        downloadFile(
          JSON.stringify(
            { version: 1, part: part.id, state: modelState, units: 'mm', parameters },
            null,
            2,
          ),
          `${part.id}.json`,
          'application/json',
        );
      setToast(`${format === 'macro' ? 'FreeCAD macro' : format.toUpperCase()} downloaded.`);
    } catch (error) {
      setToast(
        `Export failed: ${error instanceof Error ? error.message : 'Please check the parameters.'}`,
      );
    }
    setExportOpen(false);
  }
  function savePreset() {
    if (!presetName.trim() || errors.length) return;
    const preset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      partId: part.id,
      parameters: { ...parameters },
      state: modelState,
    };
    try {
      const next = [...savedPresets, preset];
      storePresets(next);
      setSavedPresets(next);
      setDialog(null);
      setToast('Preset saved in this browser.');
    } catch {
      setToast('This browser could not save the preset. Download parameters to keep a copy.');
    }
  }
  async function importConfiguration(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Choose a parameters file smaller than 100 KB.');
      const config = parseConfiguration(await file.text(), parts);
      selectPart(config.part, config.parameters, config.state);
      setDialog(null);
      setToast('Configuration imported. Use Save preset to keep it in this browser.');
    } catch (error) {
      setToast(`Import failed: ${error instanceof Error ? error.message : 'Invalid JSON file.'}`);
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }
  function removePreset(id: string) {
    const next = savedPresets.filter((preset) => preset.id !== id);
    try {
      storePresets(next);
      setSavedPresets(next);
    } catch {
      setToast('This browser could not update saved presets.');
    }
  }
  const formatDimension = (value: number) => Number(value.toFixed(2));

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="header-divider" />
        <nav className="main-nav" aria-label="Main navigation">
          <button className="active" onClick={() => setDialog(null)}>
            <Box size={16} />
            Part library
          </button>
          <button onClick={() => openPresetBrowser('all')}>
            <Search size={16} />
            Find presets
          </button>
          <button onClick={() => setDialog('presets')}>
            <Bookmark size={16} />
            My presets
            {availableSavedPresets.length > 0 && (
              <span className="nav-count">{availableSavedPresets.length}</span>
            )}
          </button>
        </nav>
        <div className="header-end">
          <span className="local-badge">
            <ShieldCheck size={14} />
            Runs in your browser
          </span>
          <button
            className="help-button"
            aria-label="Quick guide"
            onClick={() => setDialog('guide')}
          >
            <BookOpen size={16} />
            <span>Quick guide</span>
          </button>
          <a
            className="github-button"
            href="https://github.com/defencore/ProtoLab-3D"
            target="_blank"
            rel="noreferrer"
            title="View source on GitHub"
            aria-label="View source on GitHub"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.57.11.78-.25.78-.55v-2.14c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.28-1.67-1.28-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.74 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.54-.29-5.22-1.27-5.22-5.66 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a11.04 11.04 0 0 1 5.76 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.12 3.04.73.8 1.18 1.83 1.18 3.08 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.05.78 2.12v3.15c0 .3.21.67.79.55A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
          </a>
        </div>
      </header>
      <div className="action-bar">
        <button
          className="icon-button library-toggle"
          onClick={() => openMobilePanel('library')}
          aria-label="Open part library"
        >
          <Menu size={20} />
        </button>
        <div className="breadcrumbs">
          <span>Library</span>
          <ChevronRight size={13} />
          <span>{part.category}</span>
          <ChevronRight size={13} />
          <strong>{part.subgroup}</strong>
        </div>
        <div className="action-buttons">
          <button
            className="secondary-button script-button"
            onClick={() => setDialog('script')}
            disabled={!!errors.length}
          >
            <Code2 size={16} />
            <span>View script</span>
          </button>
          <button className="primary-button" onClick={copyScript} disabled={!!errors.length}>
            <Copy size={15} />
            <span>Copy Python</span>
          </button>
          <div className="export-container" ref={exportMenu}>
            <button
              className={`secondary-button export-button ${exportOpen ? 'pressed' : ''}`}
              onClick={() => setExportOpen(!exportOpen)}
              aria-expanded={exportOpen}
              disabled={!!errors.length}
            >
              <ArrowDownToLine size={16} />
              <span>Download</span>
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="dropdown-menu export-menu">
                <span className="menu-label">EXPORT CURRENT STATE</span>
                <button onClick={() => exportPart('macro')}>
                  <FileCode2 size={18} />
                  <span>
                    <strong>FreeCAD macro</strong>
                    <small>Solid CAD geometry · .FCMacro</small>
                  </span>
                </button>
                <button onClick={() => exportPart('stl')}>
                  <Box size={18} />
                  <span>
                    <strong>STL mesh</strong>
                    <small>Preview mesh · millimeters</small>
                  </span>
                </button>
                <button onClick={() => exportPart('json')}>
                  <FileJson size={18} />
                  <span>
                    <strong>Parameters</strong>
                    <small>Configuration data · .json</small>
                  </span>
                </button>
                <p>Need STEP? Run the macro in FreeCAD, select the part, then use File → Export.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className={`workspace ${mobilePanel ? `show-${mobilePanel}` : ''} ${dialog === 'catalog' ? 'preset-browser-open' : ''}`}
      >
        {mobilePanel && (
          <button
            className="panel-scrim"
            aria-label="Close side panel"
            onClick={() => setMobilePanel(null)}
          />
        )}
        {dialog === 'catalog' ? (
          <PresetBrowser
            key={catalogRevision}
            parts={parts}
            currentPart={part}
            currentParameters={parameters}
            currentPresetId={presetId}
            initialMode={catalogMode}
            initialFilters={catalogFilters}
            onApply={applyPreset}
            onClose={() => setDialog(null)}
          />
        ) : (
          <Catalog
            parts={parts}
            selected={part}
            onSelect={(next) => selectPart(next)}
            onClose={() => setMobilePanel(null)}
          />
        )}
        <main className="model-workspace">
          <div className="part-heading">
            <div className="part-eyebrow">
              <span className="part-type-icon">
                <PartIcon type={part.icon} size={17} />
              </span>
              <span>PARAMETRIC COMPONENT</span>
              <span className="part-revision">/ {part.id.toUpperCase()}</span>
            </div>
            <h1>{part.name}</h1>
            <p>{part.description}</p>
            <div className="part-badges">
              <span>
                <span className="small-status-dot" />
                {part.complexity}
              </span>
              {part.standard && <span>{part.standard}</span>}
              <span>mm</span>
            </div>
          </div>
          <div className="viewport-area">
            <ModelViewer
              part={preview.part}
              parameters={preview.parameters}
              modelState={preview.modelState}
              displayMode={displayMode}
              showGrid={showGrid}
              showDimensions={showDimensions}
              view={view}
              fitToken={fitToken}
              onError={setViewerError}
              onViewChange={setView}
            />
            <div className="viewport-top">
              <div className="view-select">
                <Rotate3D size={14} />
                <select
                  aria-label="Camera view"
                  value={view}
                  onChange={(event) => {
                    setView(event.target.value as View);
                    setFitToken((token) => token + 1);
                  }}
                >
                  <option value="isometric">Isometric</option>
                  <option value="front">Front</option>
                  <option value="top">Top</option>
                  <option value="right">Right</option>
                </select>
                <ChevronDown size={12} />
              </div>
              <div className="viewport-label">
                <span />
                LIVE PREVIEW
              </div>
            </div>
            {errors.length > 0 && (
              <div className="preview-warning">Showing last valid configuration</div>
            )}
            {viewerError && <div className="viewer-error">{viewerError}</div>}
            <div className="viewport-toolbar">
              <div className="display-switch" role="group" aria-label="Display mode">
                <button
                  title="Solid shading"
                  aria-label="Solid shading"
                  aria-pressed={displayMode === 'solid'}
                  className={displayMode === 'solid' ? 'active' : ''}
                  onClick={() => setDisplayMode('solid')}
                >
                  <Box size={17} />
                  <span>Solid</span>
                </button>
                <button
                  title="Wireframe"
                  aria-label="Wireframe"
                  aria-pressed={displayMode === 'wireframe'}
                  className={displayMode === 'wireframe' ? 'active' : ''}
                  onClick={() => setDisplayMode('wireframe')}
                >
                  <Layers3 size={17} />
                </button>
                <button
                  title="X-ray"
                  aria-label="X-ray"
                  aria-pressed={displayMode === 'xray'}
                  className={displayMode === 'xray' ? 'active' : ''}
                  onClick={() => setDisplayMode('xray')}
                >
                  <ScanIcon />
                </button>
              </div>
              <span className="tool-divider" />
              <button
                className={showGrid ? 'active-tool' : ''}
                title="Toggle grid"
                aria-label="Toggle grid"
                aria-pressed={showGrid}
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                className={showDimensions ? 'active-tool' : ''}
                title="Toggle dimensions"
                aria-label="Toggle dimensions"
                aria-pressed={showDimensions}
                onClick={() => setShowDimensions(!showDimensions)}
              >
                <Ruler size={18} />
              </button>
              <span className="tool-divider" />
              <button
                title="Fit model to view"
                aria-label="Fit model to view"
                onClick={() => setFitToken((token) => token + 1)}
              >
                <Expand size={17} />
              </button>
            </div>
          </div>
          <div className="model-summary">
            <div className="summary-symbol">
              <PartIcon type={part.icon} size={25} />
            </div>
            <div className="summary-item">
              <span>BOUNDING SIZE</span>
              <strong>
                {dimensions.map(formatDimension).join(' × ')}
                <small> mm</small>
              </strong>
            </div>
            <div className="summary-item summary-state">
              <span>CONFIGURATION</span>
              <strong>
                {presetId === 'custom'
                  ? 'Custom'
                  : part.presets.find((preset) => preset.id === presetId)?.name}
              </strong>
            </div>
            <div className="summary-item summary-export">
              <span>FREECAD EXPORT</span>
              <strong>
                <Check size={13} />
                Solid geometry
              </strong>
            </div>
          </div>
          <footer className="viewport-footer">
            <span>
              <MousePointer2 size={13} />
              Drag to orbit
            </span>
            <span>
              <Move size={13} />
              Right drag to pan
            </span>
            <span>Scroll to zoom</span>
            <span className="precision-note">1 unit = 1 mm</span>
          </footer>
        </main>
        <div className="config-wrapper">
          <button
            className="icon-button mobile-close config-close"
            onClick={() => setMobilePanel(null)}
            aria-label="Close configurator"
          >
            <X size={18} />
          </button>
          <Configurator
            key={part.id}
            part={part}
            parameters={parameters}
            modelState={modelState}
            presetId={presetId}
            errors={errors}
            onPreset={(preset) => applyPreset(part, preset)}
            onChange={(key, value) => {
              setParameters((current) => {
                const next = { ...current, [key]: value };
                for (const field of part.parameters) {
                  if (
                    field.type === 'number' &&
                    field.visibleWhen &&
                    !field.visibleWhen(next) &&
                    (typeof next[field.key] !== 'number' || !Number.isFinite(next[field.key]))
                  ) {
                    next[field.key] = part.defaults[field.key];
                  }
                }
                const numbersReady = part.parameters.every(
                  (field) =>
                    field.type !== 'number' ||
                    (typeof next[field.key] === 'number' && Number.isFinite(next[field.key])),
                );
                return numbersReady && part.updateParameters
                  ? part.updateParameters(next, key)
                  : next;
              });
              setPresetId('custom');
            }}
            onState={setModelState}
            onBrowse={(filters) => openPresetBrowser('browse', filters)}
            onFindMatching={() => openPresetBrowser('match')}
            onReset={() => selectPart(part)}
            onSave={() => {
              setPresetName(`${part.name} — custom`);
              setDialog('save');
            }}
          />
        </div>
      </div>
      <div className="mobile-toolbar">
        <button onClick={() => openMobilePanel('library')}>
          <Box size={17} />
          Part library
        </button>
        <button onClick={() => openMobilePanel('config')}>
          <Settings2 size={17} />
          Configure part
        </button>
      </div>
      <footer className="app-footer">
        <span>
          <span className="footer-mark">P</span>ProtoLab <span className="version">v1.0</span>
        </span>
        <span>Less drawing. More building.</span>
        <span>
          Made for FreeCAD <ArrowUpRight size={12} />
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {dialog === 'script' && (
        <Modal
          title="Bring it into FreeCAD"
          subtitle={`${part.name} · ${part.states?.find((state) => state.id === modelState)?.label ?? 'Default state'}`}
          wide
          onClose={() => setDialog(null)}
        >
          <div className="script-instructions">
            <span className="step-number">1</span>
            <p>
              Open <strong>View → Panels → Python console</strong> in FreeCAD.
            </p>
          </div>
          <div className="script-instructions">
            <span className="step-number">2</span>
            <p>
              Paste the console command and press <kbd>Enter</kbd>. The part is added to your active
              document.
            </p>
          </div>
          <label className="section-label" htmlFor="console-command">
            CONSOLE COMMAND
          </label>
          <textarea
            id="console-command"
            className="console-command"
            readOnly
            value={consoleCommand(script)}
            onFocus={(event) => event.currentTarget.select()}
            rows={3}
          />
          <details className="source-details">
            <summary>
              <Code2 size={15} />
              Preview Python source <ChevronDown size={14} />
            </summary>
            <pre>{script}</pre>
          </details>
          <div className="modal-note">
            <InfoIcon />
            Multi-component models create an expandable assembly with separate, movable parts.
            Single bodies remain individual solid features. Use FreeCAD’s File menu to save STEP or
            FCStd.
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => exportPart('macro')}>
              <ArrowDownToLine size={16} />
              Download macro
            </button>
            <button className="primary-button" onClick={copyScript}>
              <Copy size={15} />
              Copy console command
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'guide' && (
        <Modal
          title="From parameter to prototype."
          subtitle="A short path from a part idea to your FreeCAD project."
          onClose={() => setDialog(null)}
        >
          <div className="guide-steps">
            {[
              [
                'Find your component',
                'Browse the library or press / to search by name, type or size.',
              ],
              [
                'Make it fit',
                'Use Find presets to search by designation, type and size range. Find matching uses your current dimensions as editable filters. Apply a result, then customize it.',
              ],
              [
                'Bring it into your project',
                'Copy Python, open View → Panels → Python console in FreeCAD, paste and press Enter.',
              ],
              [
                'Keep what works',
                'Save a preset in this browser, download an STL mesh, or export STEP from FreeCAD.',
              ],
            ].map(([title, description], index) => (
              <div className="guide-step" key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="guide-shortcuts">
            <Keyboard size={18} />
            <span>
              <kbd>/</kbd> Search
            </span>
            <span>
              <kbd>Esc</kbd> Close panels
            </span>
          </div>
          <div className="modal-note">
            <InfoIcon />
            These are prototype geometries. Simplifications and configuration limits are listed with
            each part.
          </div>
          <button className="primary-button full-button" onClick={() => setDialog(null)}>
            Start building <ArrowUpRight size={16} />
          </button>
        </Modal>
      )}
      {dialog === 'save' && (
        <Modal
          title="Save your configuration"
          subtitle="Presets are stored locally in this browser."
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              savePreset();
            }}
          >
            <label className="form-label" htmlFor="preset-name">
              Preset name
            </label>
            <input
              id="preset-name"
              className="text-input"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              maxLength={80}
              required
              autoFocus
            />
            <div className="save-part-preview">
              <PartIcon type={part.icon} size={25} />
              <div>
                <strong>{part.name}</strong>
                <p>{dimensions.map(formatDimension).join(' × ')} mm</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                <Bookmark size={16} />
                Save preset
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'presets' && (
        <Modal
          title="My presets"
          subtitle="Your go-to configurations, ready for the next build."
          onClose={() => setDialog(null)}
        >
          {!availableSavedPresets.length ? (
            <div className="empty-presets">
              <Bookmark size={34} />
              <h3>A place for your favorite parts.</h3>
              <p>Configure a part and use the bookmark button beside Preset to save it here.</p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Explore the library
              </button>
            </div>
          ) : (
            <div className="saved-preset-list">
              {availableSavedPresets.map((preset) => {
                const savedPart = parts.find((part) => part.id === preset.partId)!;
                return (
                  <div className="saved-preset" key={preset.id}>
                    <PartIcon type={savedPart.icon} size={22} />
                    <button
                      onClick={() => {
                        selectPart(savedPart, preset.parameters, preset.state);
                        setDialog(null);
                        setToast(`Loaded “${preset.name}”.`);
                      }}
                    >
                      <strong>{preset.name}</strong>
                      <span>{savedPart.name}</span>
                    </button>
                    <button
                      className="icon-button delete-preset"
                      title={`Delete ${preset.name}`}
                      aria-label={`Delete ${preset.name}`}
                      onClick={() => removePreset(preset.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="modal-note">
            <InfoIcon />
            Saved on this device. Export and import parameters to move configurations between
            browsers.
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Import configuration file"
            onChange={(event) => void importConfiguration(event.target.files?.[0])}
          />
          <button
            className="secondary-button full-button"
            onClick={() => importInput.current?.click()}
          >
            <FileJson size={16} />
            Import parameters
          </button>
        </Modal>
      )}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5m13-5v5h-5M7 8l5-3 5 3v8l-5 3-5-3zM7 8l5 3 5-3m-5 3v8" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </svg>
  );
}
