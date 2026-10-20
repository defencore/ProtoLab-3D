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
  LoaderCircle,
  Menu,
  Maximize2,
  Minimize2,
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
import ProjectWorkspace from './components/ProjectWorkspace';
import Configurator from './components/Configurator';
import ModelViewer, { type NavigationMode } from './components/ModelViewer';
import { useAssemblyPreview } from './components/useAssemblyPreview';
import { useLibraryOutputs } from './components/useLibraryOutputs';
import GeometryModeSwitch from './components/GeometryModeSwitch';
import { usePreviewFullscreen } from './components/usePreviewFullscreen';
import Modal from './components/Modal';
import PresetBrowser from './components/PresetBrowser';
import { Brand, PartIcon } from './components/PartIcon';
import { parts } from './parts';
import { consoleCommand } from './core/freecad';
import { withGeometryMode, type GeometryMode } from './core/geometry-mode';
import { validateParameters } from './core/validation';
import { parseConfiguration } from './core/configuration';
import { downloadFile } from './core/download';
import { productKindLabels, supplyKindLabels } from './core/product-library';
import { familyId, familyLabel, familyMembers } from './core/browse-families';
import { createPresetId, readPresets, storePresets, type SavedPreset } from './core/storage';
import type { Parameters, PartDefinition, Preset } from './core/types';
import type { QuickPickFilters } from './core/quick-picks';
import {
  emptyPresetFilters,
  fieldId,
  seedCurrentFilters,
  type PresetFilters,
} from './core/preset-search';
import {
  defaultPartSelection,
  availableModelState,
  matchingPresetId,
  parametersForPreset,
  reconcilePartSelection,
} from './core/part-selection';

type DisplayMode = 'solid' | 'wireframe' | 'xray';
type View = 'isometric' | 'front' | 'top' | 'right';
type Dialog = 'script' | 'guide' | 'presets' | 'save' | 'catalog' | 'project' | null;

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
  const browseId = familyId(part);
  const browseParts = useMemo(() => familyMembers(parts, part), [parts, browseId]);
  const [browseQuery, setBrowseQuery] = useState({ query: '', revision: 0 });
  const [libraryQuery, setLibraryQuery] = useState('');
  const [storedParameters, setParameters] = useState<Parameters>({ ...initialPart.defaults });
  const [storedModelState, setModelState] = useState(initialPart.states?.[0]?.id ?? 'default');
  const [storedPresetId, setPresetId] = useState(() => defaultPartSelection(initialPart).presetId);
  const loadedDefinition = useRef(part);
  const definitionVersion = useRef(0);
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
  const { parameters } = selection;
  const modelState = availableModelState(part, parameters, selection.modelState);
  useEffect(() => {
    if (storedModelState !== modelState) setModelState(modelState);
  }, [storedModelState, modelState]);
  const presetId = part.catalogSelectionOnly
    ? matchingPresetId(part, parameters)
    : selection.presetId;
  if (moduleChanged) {
    definitionVersion.current++;
    loadedDefinition.current = part;
    setSelectedPartId(selection.partId);
    setParameters(parameters);
    setModelState(modelState);
    setPresetId(presetId);
  }
  const [displayMode, setDisplayMode] = useState<DisplayMode>('solid');
  const [geometryMode, setGeometryMode] = useState<GeometryMode>(() => {
    try {
      return localStorage.getItem('protolab.geometry-mode') === 'full' ? 'full' : 'simple';
    } catch {
      return 'simple';
    }
  });
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('orbit');
  const { previewRef, expanded: previewExpanded, toggle: togglePreview } = usePreviewFullscreen();
  const [view, setView] = useState<View>('isometric');
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [catalogMode, setCatalogMode] = useState<'all' | 'browse' | 'match'>('browse');
  const [catalogFilters, setCatalogFilters] = useState<PresetFilters>(() => emptyPresetFilters());
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [savedPresets, setSavedPresets] = useState(() => readPresets(parts));
  const availableSavedPresets = savedPresets.filter((preset) =>
    parts.some((item) => item.id === preset.partId),
  );
  const [presetName, setPresetName] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' }>();
  const toast = notice?.message ?? '';
  function setToast(message: string, tone: 'success' | 'error' = 'success') {
    setNotice(message ? { message, tone } : undefined);
  }
  const [mobilePanel, setMobilePanel] = useState<'library' | 'config' | null>(null);
  const [viewerError, setViewerError] = useState('');
  const exportMenu = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const consoleInput = useRef<HTMLTextAreaElement>(null);
  const errors = useMemo(
    () => validateParameters(part, parameters, modelState),
    [part, parameters, modelState],
  );
  const validPreview = useRef({ part, parameters, modelState });
  if (!errors.length) validPreview.current = { part, parameters, modelState };
  const preview = validPreview.current;
  const assembly = useAssemblyPreview(
    preview.part.preview === 'worker' ? preview.part.id : undefined,
    preview.parameters,
    preview.modelState,
    presetId,
    geometryMode,
    definitionVersion.current,
  );
  const measurement = useMemo(() => {
    try {
      const value = assembly.enabled
        ? (assembly.dimensions ?? [0, 0, 0])
        : withGeometryMode(geometryMode, () =>
            preview.part.dimensions(preview.parameters, preview.modelState),
          );
      return { dimensions: value as [number, number, number], error: '' };
    } catch (cause) {
      return {
        dimensions: [0, 0, 0] as [number, number, number],
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [preview.part, preview.parameters, preview.modelState, geometryMode, assembly.dimensions]);
  const dimensions = measurement.dimensions;
  const outputs = useLibraryOutputs(
    {
      partId: part.id,
      parameters,
      state: modelState,
      presetId,
      geometryMode,
    },
    definitionVersion.current,
  );
  const script = errors.length ? '' : (outputs.script ?? '');
  useEffect(() => {
    if (dialog === 'script' && !errors.length) void outputs.prepare('script').catch(() => {});
    if (dialog !== 'script') setSourceOpen(false);
  }, [dialog, outputs.key, errors.length, outputs.prepare]);
  useEffect(() => {
    try {
      localStorage.setItem('protolab.geometry-mode', geometryMode);
    } catch {
      /* Session preference still applies. */
    }
    setViewerError('');
  }, [geometryMode]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
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
  function openPresetBrowser(
    mode: 'all' | 'browse' | 'match',
    quickFilters?: QuickPickFilters,
    query = '',
    scope = part,
  ) {
    setCatalogMode(mode);
    const next =
      mode === 'match'
        ? seedCurrentFilters(scope, parameters)
        : quickFilters || query || mode === 'browse'
          ? emptyPresetFilters(scope)
          : undefined;
    if (next && mode !== 'match') next.query = query;
    if (next && quickFilters)
      for (const field of scope.parameters) {
        const value = quickFilters[field.key];
        if (value)
          next.parameters[fieldId(field)] =
            field.type === 'number' ? { min: value, max: value } : { value };
      }
    if (next) setCatalogFilters(next);
    setCatalogRevision((revision) => revision + 1);
    setDialog('catalog');
    setMobilePanel(null);
  }
  function applyPreset(next: PartDefinition, preset: Preset) {
    const values = parametersForPreset(next, preset, next.id === part.id ? parameters : undefined);
    const state =
      next.id === part.id && !validateParameters(next, values, modelState).length
        ? modelState
        : (next.states?.[0].id ?? 'default');
    selectPart(next, values, state);
    setPresetId(preset.id);
  }
  function openMobilePanel(panel: 'library' | 'config') {
    setDialog((current) => (current === 'catalog' ? null : current));
    setMobilePanel(panel);
  }
  async function copyScript() {
    if (errors.length || outputs.pending) return;
    try {
      const prepared = await outputs.prepare('script');
      if (!prepared.script) throw new Error('The FreeCAD script is empty.');
      try {
        await navigator.clipboard.writeText(consoleCommand(prepared.script));
        setToast(
          `${geometryMode === 'simple' ? 'Simple' : 'Full'} script copied. Paste into the FreeCAD Python console.`,
        );
      } catch {
        setDialog('script');
        setToast('Select and copy the console command in the FreeCAD window.');
        requestAnimationFrame(() => {
          consoleInput.current?.focus();
          consoleInput.current?.select();
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setDialog('script');
      setToast(
        `Could not prepare FreeCAD code: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }
  async function exportPart(format: 'macro' | 'stl' | 'json') {
    if (errors.length || outputs.pending) return;
    setExportOpen(false);
    try {
      if (format === 'macro') {
        const prepared = await outputs.prepare('script');
        if (!prepared.script) throw new Error('The FreeCAD script is empty.');
        downloadFile(prepared.script, `${part.id}-${geometryMode}.FCMacro`, 'text/x-python');
      }
      if (format === 'stl') {
        const prepared = await outputs.prepare('stl');
        if (!prepared.stl) throw new Error('The STL mesh is empty.');
        downloadFile(prepared.stl, `${part.id}-${modelState}.stl`, 'model/stl');
      }
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
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast(
        `Export failed: ${error instanceof Error ? error.message : 'Please check the parameters.'}`,
        'error',
      );
    }
    setExportOpen(false);
  }
  function savePreset() {
    if (!presetName.trim() || errors.length) return;
    try {
      const preset = {
        id: createPresetId(),
        name: presetName.trim(),
        partId: part.id,
        parameters: { ...parameters },
        state: modelState,
      };
      const next = [...savedPresets, preset];
      storePresets(next);
      setSavedPresets(next);
      setDialog(null);
      setToast('Preset saved in this browser.');
    } catch {
      setToast(
        'This browser could not save the preset. Download parameters to keep a copy.',
        'error',
      );
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
      setToast(
        `Import failed: ${error instanceof Error ? error.message : 'Invalid JSON file.'}`,
        'error',
      );
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
      setToast('This browser could not update saved presets.', 'error');
    }
  }
  const formatDimension = (value: number) => Number(value.toFixed(2));

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="header-divider" />
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={!dialog || dialog === 'script' ? 'active' : ''}
            onClick={() => setDialog(null)}
          >
            <Box size={16} />
            Part library
          </button>
          <button
            className={dialog === 'catalog' ? 'active' : ''}
            onClick={() => openPresetBrowser('all')}
          >
            <Search size={16} />
            Find presets
          </button>
          <button
            className={dialog === 'presets' ? 'active' : ''}
            onClick={() => setDialog('presets')}
          >
            <Bookmark size={16} />
            My presets
            {availableSavedPresets.length > 0 && (
              <span className="nav-count">{availableSavedPresets.length}</span>
            )}
          </button>
          <button
            className={dialog === 'project' ? 'active' : ''}
            onClick={() => setDialog('project')}
          >
            <Layers3 size={16} />
            Design projects
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
            <span>FreeCAD options</span>
          </button>
          <button
            className="primary-button"
            onClick={copyScript}
            disabled={!!errors.length || outputs.pending}
          >
            {outputs.pending ? (
              <LoaderCircle size={15} className="busy-spinner" />
            ) : (
              <Copy size={15} />
            )}
            <span>{outputs.pending ? 'Preparing export…' : 'Copy for FreeCAD'}</span>
          </button>
          <div className="export-container" ref={exportMenu}>
            <button
              className={`secondary-button export-button ${exportOpen ? 'pressed' : ''}`}
              onClick={() => setExportOpen(!exportOpen)}
              aria-expanded={exportOpen}
              disabled={!!errors.length || outputs.pending}
            >
              <ArrowDownToLine size={16} />
              <span>Download</span>
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="dropdown-menu export-menu">
                <span className="menu-label">CURRENT ITEM · {geometryMode.toUpperCase()}</span>
                <button onClick={() => exportPart('macro')}>
                  <FileCode2 size={18} />
                  <span>
                    <strong>FreeCAD macro</strong>
                    <small>
                      {geometryMode === 'simple'
                        ? 'Without threads · TechDraw'
                        : 'With helical threads'}{' '}
                      · .FCMacro
                    </small>
                  </span>
                </button>
                <button onClick={() => exportPart('stl')}>
                  <Box size={18} />
                  <span>
                    <strong>STL mesh</strong>
                    <small>Simple mesh · no thread relief · mm</small>
                  </span>
                </button>
                <button onClick={() => exportPart('json')}>
                  <FileJson size={18} />
                  <span>
                    <strong>Parameters</strong>
                    <small>Configuration data · .json</small>
                  </span>
                </button>
                {part.fabricationFiles?.(parameters).map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      downloadFile(file.content, file.name, file.type);
                      setExportOpen(false);
                      setToast(file.label + ' downloaded.');
                    }}
                  >
                    <FileCode2 size={18} />
                    <span>
                      <strong>{file.label}</strong>
                      <small>{file.description}</small>
                    </span>
                  </button>
                ))}
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
            filters={catalogFilters}
            onFiltersChange={setCatalogFilters}
            onApply={applyPreset}
            onClose={() => setDialog(null)}
          />
        ) : (
          <Catalog
            parts={parts}
            selected={part}
            query={libraryQuery}
            onQueryChange={setLibraryQuery}
            onSelect={(next, query) => {
              if (next.id !== part.id) selectPart(next);
              const nextQuery = query ?? '';
              if (familyId(next) !== browseId || nextQuery !== browseQuery.query)
                setBrowseQuery((current) => ({ query: nextQuery, revision: current.revision + 1 }));
            }}
            onClose={() => setMobilePanel(null)}
          />
        )}
        <main className="model-workspace">
          <div className="part-heading">
            <div className="part-eyebrow">
              <span className="part-type-icon">
                <PartIcon type={part.icon} size={17} />
              </span>
              <span>{productKindLabels[part.product.kind]}</span>
              <span className="part-revision">/ {supplyKindLabels[part.product.supply]}</span>
            </div>
            <h1>{familyLabel(part)}</h1>
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
          <div className="workspace-detail-bar">
            <GeometryModeSwitch value={geometryMode} onChange={setGeometryMode} compact />
            <button
              className="secondary-button add-project-button"
              onClick={() => setDialog('project')}
            >
              <Layers3 size={16} />
              <span>Add to project</span>
            </button>
          </div>
          <div
            ref={previewRef}
            className={`viewport-area${previewExpanded ? ' viewport-area--expanded' : ''}`}
            role={previewExpanded ? 'dialog' : 'region'}
            aria-modal={previewExpanded || undefined}
            aria-label={`${part.name} model preview`}
          >
            <ModelViewer
              key={preview.part.id}
              preparedModel={assembly.enabled ? (assembly.model ?? null) : undefined}
              preparedDimensions={assembly.dimensions}
              pending={assembly.pending}
              loadError={assembly.error || measurement.error}
              part={preview.part}
              parameters={preview.parameters}
              modelState={preview.modelState}
              geometryMode={geometryMode}
              displayMode={displayMode}
              navigationMode={navigationMode}
              showGrid={showGrid}
              showDimensions={showDimensions}
              view={view}
              fitToken={fitToken}
              onError={setViewerError}
              onViewChange={setView}
              onNavigationModeChange={setNavigationMode}
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
              <div className="preview-actions">
                <div className="navigation-switch" role="group" aria-label="Mouse navigation">
                  <button
                    title="Orbit: drag to rotate (O)"
                    aria-label="Orbit mode"
                    aria-pressed={navigationMode === 'orbit'}
                    onClick={() => setNavigationMode('orbit')}
                  >
                    <Rotate3D size={15} />
                    <span>Orbit</span>
                  </button>
                  <button
                    title="Pan: drag to move (P)"
                    aria-label="Pan mode"
                    aria-pressed={navigationMode === 'pan'}
                    onClick={() => setNavigationMode('pan')}
                  >
                    <Move size={15} />
                    <span>Pan</span>
                  </button>
                </div>
                <button
                  className="preview-fullscreen-toggle"
                  title={previewExpanded ? 'Exit full screen (Esc)' : 'Full screen preview'}
                  aria-label={previewExpanded ? 'Exit full screen preview' : 'Full screen preview'}
                  aria-expanded={previewExpanded}
                  onClick={() => void togglePreview()}
                >
                  {previewExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
            </div>
            {previewExpanded && (
              <div className="preview-navigation-hint">
                Drag to {navigationMode === 'pan' ? 'pan' : 'orbit'} · Scroll to zoom · Esc to exit
              </div>
            )}
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
                {assembly.pending ? 'Building…' : dimensions.map(formatDimension).join(' × ')}
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
                {outputs.pending ? (
                  <LoaderCircle size={13} className="busy-spinner" />
                ) : (
                  <Check size={13} />
                )}
                {outputs.pending
                  ? 'Preparing…'
                  : geometryMode === 'simple'
                    ? 'Simple · no threads'
                    : 'Full · with threads'}
              </strong>
            </div>
          </div>
          <footer className="viewport-footer">
            <span>
              <MousePointer2 size={13} />
              Drag to {navigationMode === 'pan' ? 'pan' : 'orbit'}
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
            key={browseId}
            part={part}
            familyParts={browseParts}
            browseQuery={browseQuery}
            onBrowseQueryChange={(query) => setBrowseQuery((current) => ({ ...current, query }))}
            parameters={parameters}
            modelState={modelState}
            presetId={presetId}
            errors={errors}
            previewPending={assembly.pending}
            previewError={assembly.error || measurement.error || viewerError}
            onPreset={(preset) => applyPreset(part, preset)}
            onSelectModel={(next, preset, values) => {
              if (
                !values ||
                Object.entries(preset.parameters).every(([key, value]) => values[key] === value)
              )
                applyPreset(next, preset);
              else selectPart(next, values);
            }}
            onChange={(key, value) => {
              setParameters((current) => {
                const next = { ...current, [key]: value };
                for (const field of part.parameters) {
                  if (
                    field.type === 'number' &&
                    field.visibleWhen &&
                    !field.visibleWhen(next, modelState) &&
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
            onBrowse={(filters, query) => openPresetBrowser('browse', filters, query)}
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
        <div
          className={`toast${notice?.tone === 'error' ? ' toast--error' : ''}`}
          role={notice?.tone === 'error' ? 'alert' : 'status'}
        >
          {notice?.tone === 'error' ? <X size={17} /> : <Check size={17} />}
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {dialog === 'project' && (
        <Modal
          title="Design project"
          subtitle="Product structure, documentation and specifications"
          className="project-dialog"
          wide
          onClose={() => setDialog(null)}
        >
          <ProjectWorkspace
            parts={parts}
            currentPart={part}
            parameters={parameters}
            state={modelState}
            presetId={presetId}
            geometryMode={geometryMode}
            onSelect={(next, values, nextState) => {
              selectPart(next, values, nextState);
              setDialog(null);
            }}
          />
        </Modal>
      )}
      {dialog === 'script' && (
        <Modal
          title="Open in FreeCAD"
          subtitle={`${part.name} · ${part.states?.find((state) => state.id === modelState)?.label ?? 'Default state'}`}
          wide
          onClose={() => setDialog(null)}
        >
          <GeometryModeSwitch value={geometryMode} onChange={setGeometryMode} />
          <div
            className="export-preparation-status"
            role={!outputs.pending && outputs.error && !script ? 'alert' : 'status'}
          >
            {outputs.pending ? (
              <>
                <LoaderCircle size={16} className="busy-spinner" />
                Preparing {geometryMode} geometry…
              </>
            ) : outputs.error && !script ? (
              <>
                <span className="export-error">{outputs.error}</span>
                <button
                  className="secondary-button"
                  disabled={!!errors.length || outputs.pending}
                  onClick={() => {
                    consoleInput.current?.focus();
                    void outputs.prepare('script').catch(() => {});
                  }}
                >
                  Try again
                </button>
              </>
            ) : (
              'Choose the detail level, then copy the command or download the macro.'
            )}
          </div>
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
            ref={consoleInput}
            id="console-command"
            className="console-command"
            readOnly
            value={script ? consoleCommand(script) : ''}
            placeholder={outputs.pending ? 'Preparing FreeCAD code…' : 'Code will appear here.'}
            onFocus={(event) => event.currentTarget.select()}
            rows={3}
          />
          <details
            className="source-details"
            onToggle={(event) => setSourceOpen(event.currentTarget.open)}
          >
            <summary>
              <Code2 size={15} />
              Preview Python source <ChevronDown size={14} />
            </summary>
            {sourceOpen && <pre>{script}</pre>}
          </details>
          <div className="modal-note">
            <InfoIcon />
            Multi-component models create an expandable assembly with separate, movable parts.
            Single bodies remain individual solid features. Use FreeCAD’s File menu to save STEP or
            FCStd.
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => void exportPart('macro')}
              disabled={!script || outputs.pending}
            >
              <ArrowDownToLine size={16} />
              Download macro
            </button>
            <button
              className="primary-button"
              onClick={copyScript}
              disabled={!script || outputs.pending}
            >
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
                'Choose your detail level',
                'Simple hides threads and exports lighter geometry for TechDraw. Full shows threads and includes helical thread geometry in FreeCAD. Switch above the preview or in FreeCAD options.',
              ],
              [
                'Build a project or open FreeCAD',
                'Add to project to manage the product structure, documents and specification. Copy for FreeCAD, then paste into View → Panels → Python console in FreeCAD.',
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
              <kbd>P</kbd> Pan · <kbd>O</kbd> Orbit · <kbd>F</kbd> Fit (preview focused)
            </span>
            <span>
              <kbd>Esc</kbd> Exit full screen / close panels
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
                <p>
                  {assembly.pending ? 'Building…' : dimensions.map(formatDimension).join(' × ')} mm
                </p>
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
