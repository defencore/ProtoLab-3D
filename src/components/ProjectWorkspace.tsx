import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Parameters, PartDefinition } from '../core/types';
import type {
  DesignDocument,
  DesignProject,
  ManufacturingDefinition,
  ProcurementDefinition,
  ProductConfiguration,
  ProductOccurrence,
  SupplyKind,
} from '../core/product-types';
import {
  addProduct,
  createDocument,
  createProject,
  designDocumentKinds,
  forkOccurrenceDesign,
  manufacturingProcesses,
  projectReadiness,
  removeOccurrence,
  serializeProject,
  specificationCsv,
  specificationRows,
  supplyRows,
  validateProject,
} from '../core/design-project';
import { readProjects, storedProjectText, storeProjects } from '../core/project-storage';
import { createProjectImporter, mergeImportedProject } from '../core/project-import';
import { downloadFile } from '../core/download';
import type { GeometryMode } from '../core/geometry-mode';
import { requestProjectOutput } from './requestWorkerOutput';
import './ProjectWorkspace.css';

type WorkspaceTab = 'structure' | 'specification' | 'exports' | 'review';
type ProductTab = 'properties' | 'supply' | 'documents';
interface RemovalUndo {
  project: DesignProject;
  name: string;
  count: number;
  selectedId: string;
  expanded: string[];
  specificationId: string;
  productTab: ProductTab;
}
interface MacroExportJob {
  project: DesignProject;
  parts: PartDefinition[];
  mode: GeometryMode;
  controller: AbortController;
}

function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = tabs.indexOf(event.currentTarget);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].click();
  tabs[next].focus();
}

export interface ProjectWorkspaceProps {
  parts: PartDefinition[];
  currentPart: PartDefinition;
  parameters: Parameters;
  state: string;
  presetId?: string;
  geometryMode?: GeometryMode;
  onSelect?: (part: PartDefinition, parameters: Parameters, state: string) => void;
}

export default function ProjectWorkspace({
  parts,
  currentPart,
  parameters,
  state,
  presetId,
  geometryMode = 'simple',
  onSelect,
}: ProjectWorkspaceProps) {
  const [loaded] = useState(() => readProjects(parts));
  const [projects, setProjects] = useState<DesignProject[]>(() =>
    loaded.projects.length ? loaded.projects : [createProject()],
  );
  const [projectId, setProjectId] = useState(() => projects[0].id);
  const latestProjects = useRef(projects);
  latestProjects.current = projects;
  const [projectImporter] = useState(createProjectImporter);
  useLayoutEffect(() => () => projectImporter.cancel(), [projectImporter, parts]);
  const [selectedId, setSelectedId] = useState<string>();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [specificationId, setSpecificationId] = useState<string>('');
  const [notice, setNotice] = useState<{ text: string; tone: 'status' | 'error' }>({
    text: '',
    tone: 'status',
  });
  const message = notice.text;
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('structure');
  const [productTab, setProductTab] = useState<ProductTab>('properties');
  const [exportGeometryMode, setExportGeometryMode] = useState<GeometryMode>(geometryMode);
  const [macroPending, setMacroPending] = useState(false);
  const macroJob = useRef<MacroExportJob | undefined>(undefined);
  const [removalUndo, setRemovalUndo] = useState<RemovalUndo>();
  const [saveStatus, setSaveStatus] = useState<'local' | 'saved' | 'unsaved' | 'recovery'>(() =>
    loaded.errors.length ? 'recovery' : loaded.projects.length ? 'saved' : 'local',
  );
  const workspaceId = useId();
  const importInput = useRef<HTMLInputElement>(null);
  const treeButtons = useRef(new Map<string, HTMLButtonElement>());
  const undoButton = useRef<HTMLButtonElement>(null);
  const macroButton = useRef<HTMLButtonElement>(null);
  const macroCancelButton = useRef<HTMLButtonElement>(null);
  const activeProductTab = useRef<HTMLButtonElement>(null);
  const activeWorkspaceTab = useRef<HTMLButtonElement>(null);
  const focusRequest = useRef<'undo' | 'product' | 'macro' | undefined>(undefined);
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const macroContext = useRef({ project, parts, mode: exportGeometryMode });
  macroContext.current = { project, parts, mode: exportGeometryMode };
  useLayoutEffect(() => {
    setMacroPending(false);
    return () => {
      const job = macroJob.current;
      macroJob.current = undefined;
      job?.controller.abort();
    };
  }, [project, parts, exportGeometryMode]);
  useLayoutEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = undefined;
    if (request === 'undo') undoButton.current?.focus();
    if (request === 'product')
      (treeButtons.current.get(selectedId ?? '') ?? activeProductTab.current)?.focus();
    if (request === 'macro') (macroButton.current ?? activeWorkspaceTab.current)?.focus();
  });
  const selected = project.occurrences.find((item) => item.id === selectedId);
  const configuration = project.configurations.find(
    (item) => item.id === selected?.configurationId,
  );
  const childrenByParent = useMemo(() => {
    const children = new Map<string | null, ProductOccurrence[]>();
    for (const occurrence of project.occurrences) {
      const siblings = children.get(occurrence.parentId) ?? [];
      siblings.push(occurrence);
      children.set(occurrence.parentId, siblings);
    }
    for (const siblings of children.values())
      siblings.sort((a, b) => a.position.localeCompare(b.position, 'en', { numeric: true }));
    return children;
  }, [project.occurrences]);
  const definition = parts.find((item) => item.id === configuration?.libraryId);
  const readiness = useMemo(() => projectReadiness(project, parts), [project, parts]);
  const structuralErrors = useMemo(() => validateProject(project, parts), [project, parts]);
  const assemblyOccurrences = project.occurrences.filter((occurrence) => {
    const configured = project.configurations.find(
      (item) => item.id === occurrence.configurationId,
    );
    const part = parts.find((item) => item.id === configured?.libraryId);
    return part && ['assembly', 'complex', 'kit'].includes(part.product.kind);
  });
  const selectedCanContain =
    !!definition && ['assembly', 'complex', 'kit'].includes(definition.product.kind);
  const specificationTarget =
    specificationId && project.occurrences.some((item) => item.id === specificationId)
      ? specificationId
      : null;
  const rows = useMemo(
    () => (structuralErrors.length ? [] : specificationRows(project, parts, specificationTarget)),
    [project, parts, structuralErrors.length, specificationTarget],
  );

  function setMessage(text: string, tone: 'status' | 'error' = 'status') {
    setNotice({ text, tone });
  }
  function commit(nextProjects: DesignProject[]) {
    cancelMacroExport();
    setRemovalUndo(undefined);
    latestProjects.current = nextProjects;
    setProjects(nextProjects);
    if (loaded.errors.length) {
      setSaveStatus('recovery');
      setMessage(
        'Stored project errors require recovery. Draft changes remain in this window; download JSON to keep them.',
      );
      return false;
    }
    try {
      storeProjects(nextProjects, parts);
      setSaveStatus('saved');
      setMessage('Saved in this browser.');
      return true;
    } catch (error) {
      setSaveStatus('unsaved');
      setMessage(`Not saved: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return false;
    }
  }
  function update(next: DesignProject) {
    commit(projects.map((item) => (item.id === project.id ? next : item)));
  }
  function removeSelectedProduct() {
    if (!selected || !configuration) return;
    try {
      const next = removeOccurrence(project, selected.id);
      const errors = validateProject(next, parts);
      if (errors.length) throw new Error(errors.join(' '));
      const undo: RemovalUndo = {
        project: structuredClone(project),
        name: configuration.name,
        count: project.occurrences.length - next.occurrences.length,
        selectedId: selected.id,
        expanded: [...expanded],
        specificationId,
        productTab,
      };
      update(next);
      setRemovalUndo(undo);
      focusRequest.current = 'undo';
      setSelectedId(undefined);
      const remainingIds = new Set(next.occurrences.map((item) => item.id));
      setExpanded((items) => items.filter((id) => remainingIds.has(id)));
      if (!remainingIds.has(specificationId)) setSpecificationId('');
    } catch (error) {
      setMessage(
        `Could not remove product: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }
  function undoRemoval() {
    if (!removalUndo || removalUndo.project.id !== project.id) return;
    update(removalUndo.project);
    setSelectedId(removalUndo.selectedId);
    setExpanded(removalUndo.expanded);
    setSpecificationId(removalUndo.specificationId);
    setWorkspaceTab('structure');
    setProductTab(removalUndo.productTab);
    focusRequest.current = 'product';
  }
  function configure(changes: Partial<ProductConfiguration>) {
    if (!configuration) return;
    update({
      ...project,
      configurations: project.configurations.map((item) =>
        item.id === configuration.id ? { ...item, ...changes } : item,
      ),
    });
  }
  function occurrence(changes: Partial<ProductOccurrence>) {
    if (!selected) return;
    update({
      ...project,
      occurrences: project.occurrences.map((item) =>
        item.id === selected.id ? { ...item, ...changes } : item,
      ),
    });
  }
  function manufacture(changes: Partial<ManufacturingDefinition>) {
    configure({
      manufacturing: {
        material: '',
        blank: '',
        processes: [],
        requirements: [],
        ...configuration?.manufacturing,
        ...changes,
      },
    });
  }
  function procure(changes: Partial<ProcurementDefinition>) {
    configure({
      procurement: {
        designation: '',
        manufacturer: '',
        source: '',
        ...configuration?.procurement,
        ...changes,
      },
    });
  }
  function add(parentId: string | null) {
    try {
      const result = addProduct(
        project,
        parts,
        { part: currentPart, parameters, state, presetId },
        parentId,
      );
      update(result.project);
      setSelectedId(result.occurrenceId);
      setWorkspaceTab('structure');
      setProductTab('properties');
      setExpanded((items) => [
        ...new Set([...items, result.occurrenceId, ...(parentId ? [parentId] : [])]),
      ]);
      focusRequest.current = 'product';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error), 'error');
    }
  }
  function changeSupply(supply: SupplyKind) {
    if (!configuration || !definition) return;
    const next = { ...configuration, supply };
    delete next.manufacturing;
    delete next.procurement;
    if (supply === 'manufactured')
      next.manufacturing = {
        material: '',
        blank: '',
        processes: [...definition.product.processes],
        requirements: [],
      };
    if (supply === 'purchased' || supply === 'standard')
      next.procurement = { designation: configuration.designation, manufacturer: '', source: '' };
    update({
      ...project,
      configurations: project.configurations.map((item) => (item.id === next.id ? next : item)),
    });
  }
  function documentChange(document: DesignDocument, changes: Partial<DesignDocument>) {
    update({
      ...project,
      documents: project.documents.map((item) =>
        item.id === document.id ? { ...item, ...changes } : item,
      ),
    });
  }
  function reorderSection(index: number, direction: -1 | 1) {
    const order = [...project.documentationRules.sectionOrder];
    const destination = index + direction;
    if (destination < 0 || destination >= order.length) return;
    [order[index], order[destination]] = [order[destination], order[index]];
    update({
      ...project,
      documentationRules: { ...project.documentationRules, sectionOrder: order },
    });
  }
  function cancelMacroExport() {
    const job = macroJob.current;
    if (!job) return;
    macroJob.current = undefined;
    job.controller.abort();
    setMacroPending(false);
  }
  function isCurrentMacroJob(job: MacroExportJob) {
    const context = macroContext.current;
    return (
      macroJob.current === job &&
      !job.controller.signal.aborted &&
      context.project === job.project &&
      context.parts === job.parts &&
      context.mode === job.mode
    );
  }
  async function downloadMacro() {
    if (macroJob.current || structuralErrors.length || !project.occurrences.length) return;
    const job: MacroExportJob = {
      project,
      parts,
      mode: exportGeometryMode,
      controller: new AbortController(),
    };
    macroJob.current = job;
    setMacroPending(true);
    try {
      const output = await requestProjectOutput(job.project, job.mode, job.controller.signal);
      if (!isCurrentMacroJob(job)) return;
      if (!output.script) throw new Error('The FreeCAD macro is empty.');
      const filename = (
        job.project.designation ||
        job.project.name ||
        'engineering-project'
      ).replace(/[^a-zA-Z0-9._-]+/g, '-');
      downloadFile(output.script, `${filename}-${job.mode}.FCMacro`, 'text/x-python');
      setMessage('FreeCAD macro downloaded. Draft exports retain unresolved requirements.');
    } catch (error) {
      if (!isCurrentMacroJob(job)) return;
      setMessage(
        `CAD export failed: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    } finally {
      if (macroJob.current === job) {
        if (document.activeElement === macroCancelButton.current) focusRequest.current = 'macro';
        macroJob.current = undefined;
        setMacroPending(false);
      }
    }
  }
  function download(kind: 'project' | 'specification' | 'purchased' | 'manufactured') {
    try {
      const filename = (project.designation || project.name || 'engineering-project').replace(
        /[^a-zA-Z0-9._-]+/g,
        '-',
      );
      if (kind === 'project')
        downloadFile(
          serializeProject(project, parts),
          `${filename}.project.json`,
          'application/json',
        );
      else
        downloadFile(
          specificationCsv(
            kind === 'specification' ? rows : supplyRows(project, parts, kind),
            project.documentationRules,
          ),
          `${filename}-${kind}.csv`,
          'text/csv;charset=utf-8',
        );
      setMessage('Downloaded. Draft exports retain unresolved requirements.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error), 'error');
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (importInput.current) importInput.current.value = '';
    await projectImporter.read(
      file,
      parts,
      (imported) => {
        const saved = commit(mergeImportedProject(latestProjects.current, imported));
        setProjectId(imported.id);
        setSelectedId(undefined);
        setSpecificationId('');
        setWorkspaceTab('structure');
        setProductTab('properties');
        if (saved)
          setMessage(
            'Project imported. Review its unresolved documentation and engineering requirements.',
          );
      },
      (error) =>
        setMessage(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        ),
    );
  }
  function selectProduct(id: string) {
    setSelectedId(id);
    setProductTab('properties');
  }
  function navigateTree(id: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    const current = project.occurrences.find((item) => item.id === id)!;
    const children = childrenByParent.get(id) ?? [];
    const open = expanded.includes(id);
    let destination: string | undefined;
    if (event.key === 'ArrowRight') {
      if (children.length && !open) setExpanded((items) => [...items, id]);
      else destination = children[0]?.id;
    } else if (event.key === 'ArrowLeft') {
      if (children.length && open) setExpanded((items) => items.filter((item) => item !== id));
      else destination = current.parentId ?? undefined;
    } else {
      const visible: string[] = [];
      function visit(parentId: string | null, path: string[] = []) {
        if (path.length > 128) return;
        for (const occurrence of childrenByParent.get(parentId) ?? []) {
          if (path.includes(occurrence.id)) continue;
          visible.push(occurrence.id);
          if (expanded.includes(occurrence.id)) visit(occurrence.id, [...path, occurrence.id]);
        }
      }
      visit(null);
      const index = visible.indexOf(id);
      destination =
        event.key === 'Home'
          ? visible[0]
          : event.key === 'End'
            ? visible.at(-1)
            : visible[index + (event.key === 'ArrowDown' ? 1 : -1)];
    }
    if (destination) {
      selectProduct(destination);
      treeButtons.current.get(destination)?.focus();
    }
  }
  function renderTree(parentId: string | null, ancestors: string[] = []): React.ReactNode {
    if (ancestors.length > 128) return null;
    return (childrenByParent.get(parentId) ?? []).map((item) => {
      if (ancestors.includes(item.id)) return null;
      const configured = project.configurations.find((entry) => entry.id === item.configurationId);
      const children = childrenByParent.has(item.id);
      const open = expanded.includes(item.id);
      return (
        <li key={item.id}>
          <div className={`project-tree-row${selectedId === item.id ? ' selected' : ''}`}>
            {children ? (
              <button
                className="project-tree-toggle"
                aria-label={`${open ? 'Collapse' : 'Expand'} ${configured?.name ?? 'product'}`}
                aria-expanded={open}
                aria-controls={`${workspaceId}-children-${item.id}`}
                onClick={() =>
                  setExpanded((items) =>
                    open ? items.filter((id) => id !== item.id) : [...items, item.id],
                  )
                }
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="project-tree-leaf" aria-hidden="true">
                ·
              </span>
            )}
            <button
              className="project-tree-select"
              aria-current={selectedId === item.id ? 'true' : undefined}
              ref={(node) => {
                if (node) treeButtons.current.set(item.id, node);
                else treeButtons.current.delete(item.id);
              }}
              onKeyDown={(event) => navigateTree(item.id, event)}
              onClick={() => selectProduct(item.id)}
            >
              <span>{item.position}</span>
              <strong>{configured?.designation || configured?.name || 'Missing product'}</strong>
              <small>×{item.quantity}</small>
            </button>
          </div>
          {children && (
            <ul id={`${workspaceId}-children-${item.id}`} hidden={!open}>
              {open && renderTree(item.id, [...ancestors, item.id])}
            </ul>
          )}
        </li>
      );
    });
  }

  return (
    <div className="project-workspace">
      <div className="project-toolbar">
        <label className="project-choice">
          <span>Project</span>
          <select
            aria-label="Current engineering project"
            value={project.id}
            onChange={(event) => {
              cancelMacroExport();
              setProjectId(event.target.value);
              setSelectedId(undefined);
              setSpecificationId('');
              setWorkspaceTab('structure');
              setProductTab('properties');
            }}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.designation ? `${item.designation} — ` : ''}
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          onClick={() => {
            const next = createProject();
            commit([...projects, next]);
            setProjectId(next.id);
            setSelectedId(undefined);
            setSpecificationId('');
            setWorkspaceTab('structure');
            setProductTab('properties');
          }}
        >
          <FolderPlus size={15} />
          New project
        </button>
        <button className="secondary-button" onClick={() => importInput.current?.click()}>
          <Upload size={15} />
          Import project
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </div>

      <div className="project-overview">
        <div>
          <span className="project-eyebrow">ENGINEERING PROJECT</span>
          <h3>
            {project.designation ? `${project.designation} · ` : ''}
            {project.name || 'Untitled project'}
          </h3>
          <p>
            {project.occurrences.length} {project.occurrences.length === 1 ? 'product' : 'products'}{' '}
            · revision {project.revision || '—'}
          </p>
        </div>
        <div className="project-overview-status">
          <span className={`project-save-chip ${saveStatus}`}>
            {saveStatus === 'saved' && <Check size={13} aria-hidden="true" />}
            {saveStatus === 'saved'
              ? 'Saved in browser'
              : saveStatus === 'local'
                ? 'Local draft'
                : saveStatus === 'recovery'
                  ? 'Recovery needed'
                  : 'Changes not saved'}
          </span>
          <button className="project-review-link" onClick={() => setWorkspaceTab('review')}>
            {readiness.complete
              ? 'Documentation complete'
              : `${readiness.issues.length} ${readiness.issues.length === 1 ? 'item' : 'items'} to review`}
          </button>
        </div>
      </div>
      <p
        className={`project-save-status${notice.tone === 'error' || saveStatus === 'unsaved' || saveStatus === 'recovery' ? ' warning' : ''}`}
        role={notice.tone === 'error' ? 'alert' : 'status'}
        aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {message ||
          'Saved projects stay in this browser. Export project JSON for backup and handoff.'}
      </p>
      {macroPending && (
        <div className="project-export-status" role="status">
          <span>
            <LoaderCircle size={16} className="busy-spinner" aria-hidden="true" />
            Preparing {exportGeometryMode === 'simple' ? 'Simple' : 'Full'} FreeCAD macro… Editing
            the project cancels this export.
          </span>
          <button
            ref={macroCancelButton}
            className="secondary-button"
            onClick={() => {
              cancelMacroExport();
              setMessage('CAD export cancelled.');
              focusRequest.current = 'macro';
            }}
          >
            Cancel export
          </button>
        </div>
      )}
      {removalUndo?.project.id === project.id && (
        <div className="project-undo-notice" role="status">
          <span>
            <strong>{removalUndo.name}</strong> was removed
            {removalUndo.count > 1
              ? ` with ${removalUndo.count - 1} nested ${removalUndo.count === 2 ? 'item' : 'items'}`
              : ''}
            .
          </span>
          <button ref={undoButton} className="secondary-button" onClick={undoRemoval}>
            <RotateCcw size={15} aria-hidden="true" /> Undo removal
          </button>
          <small>Available until the next project change.</small>
        </div>
      )}
      {loaded.errors.length > 0 && (
        <div className="project-alert" role="alert">
          <strong>Stored project data needs recovery; automatic saving is paused.</strong>
          {loaded.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
          <button
            className="secondary-button"
            onClick={() => {
              try {
                downloadFile(
                  storedProjectText() ?? '[]',
                  'stored-projects-recovery.json',
                  'application/json',
                );
              } catch (error) {
                setMessage(String(error), 'error');
              }
            }}
          >
            Download stored records for recovery
          </button>
        </div>
      )}

      <details className="project-settings">
        <summary>Project details and enterprise rules</summary>
        <div className="project-settings-body">
          <div className="project-fields project-heading-fields">
            <label>
              Project name
              <input
                value={project.name}
                onChange={(event) => update({ ...project, name: event.target.value })}
              />
            </label>
            <label>
              Designation
              <input
                value={project.designation}
                placeholder="Enterprise designation"
                onChange={(event) => update({ ...project, designation: event.target.value })}
              />
            </label>
            <label>
              Revision
              <input
                value={project.revision}
                onChange={(event) => update({ ...project, revision: event.target.value })}
              />
            </label>
            <label>
              Documentation policy
              <select
                value={project.documentationPolicy}
                onChange={(event) =>
                  update({
                    ...project,
                    documentationPolicy: event.target.value as DesignProject['documentationPolicy'],
                  })
                }
              >
                <option value="enterprise-eskd">Enterprise ESKD structure</option>
                <option value="dstu-eskd">DSTU ESKD — verify adopted editions</option>
                <option value="gost-eskd">GOST ESKD — verify adopted editions</option>
              </select>
            </label>
          </div>
          <p className="project-policy-note">
            The policy defines the documentation structure. Final forms, designations and applicable
            standard editions require your enterprise rules and engineering review.
          </p>
          <details className="project-enterprise-rules">
            <summary>Enterprise documentation rules</summary>
            <div className="project-rules-body">
              <p className="project-policy-note">
                Edit specification section names and order, the designation rule and additional
                required documents for manufactured products. These rules are saved with the
                project.
              </p>
              <label className="project-textarea-label">
                Designation pattern
                <input
                  value={project.documentationRules.designationPattern}
                  placeholder="^PL\\.[0-9]{4}$"
                  onChange={(event) =>
                    update({
                      ...project,
                      documentationRules: {
                        ...project.documentationRules,
                        designationPattern: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <p className="project-policy-note">
                Leave empty for unrestricted designations. Use ^ and $, character classes and fixed
                repetitions such as {'{4}'}. Groups and alternatives are rejected; at most one * or
                + repetition is allowed.
              </p>
              <div className="project-rule-sections">
                {project.documentationRules.sectionOrder.map((section, index) => (
                  <div key={section}>
                    <label>
                      {section.replaceAll('-', ' ')}
                      <input
                        value={project.documentationRules.sectionLabels[section]}
                        onChange={(event) =>
                          update({
                            ...project,
                            documentationRules: {
                              ...project.documentationRules,
                              sectionLabels: {
                                ...project.documentationRules.sectionLabels,
                                [section]: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </label>
                    <button
                      className="icon-button"
                      disabled={index === 0}
                      aria-label={`Move ${section} earlier`}
                      onClick={() => reorderSection(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="icon-button"
                      disabled={index === project.documentationRules.sectionOrder.length - 1}
                      aria-label={`Move ${section} later`}
                      onClick={() => reorderSection(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
              <fieldset className="project-processes">
                <legend>Additional required document kinds</legend>
                {designDocumentKinds.map((kind) => (
                  <label key={kind}>
                    <input
                      type="checkbox"
                      checked={project.documentationRules.requiredDocuments.includes(kind)}
                      onChange={(event) =>
                        update({
                          ...project,
                          documentationRules: {
                            ...project.documentationRules,
                            requiredDocuments: event.target.checked
                              ? [...project.documentationRules.requiredDocuments, kind]
                              : project.documentationRules.requiredDocuments.filter(
                                  (item) => item !== kind,
                                ),
                          },
                        })
                      }
                    />
                    {kind.replaceAll('-', ' ')}
                  </label>
                ))}
              </fieldset>
            </div>
          </details>
        </div>
      </details>
      <div className="project-workspace-tabs" role="tablist" aria-label="Project workspace">
        {(
          [
            ['structure', 'Structure'],
            ['specification', 'Specification'],
            ['exports', 'Exports'],
            ['review', 'Review'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            ref={workspaceTab === tab ? activeWorkspaceTab : undefined}
            id={`${workspaceId}-tab-${tab}`}
            role="tab"
            aria-selected={workspaceTab === tab}
            aria-controls={`${workspaceId}-${tab}`}
            tabIndex={workspaceTab === tab ? 0 : -1}
            onKeyDown={navigateTabs}
            onClick={() => setWorkspaceTab(tab)}
          >
            {label}
            {tab === 'review' && !!readiness.issues.length && (
              <span className="project-tab-badge">{readiness.issues.length}</span>
            )}
          </button>
        ))}
      </div>
      {(['structure', 'specification', 'exports', 'review'] as const)
        .filter((tab) => tab !== workspaceTab)
        .map((tab) => (
          <div
            key={tab}
            id={`${workspaceId}-${tab}`}
            role="tabpanel"
            aria-labelledby={`${workspaceId}-tab-${tab}`}
            hidden
          />
        ))}
      {workspaceTab === 'structure' && (
        <div
          className="project-main"
          id={`${workspaceId}-structure`}
          role="tabpanel"
          aria-labelledby={`${workspaceId}-tab-structure`}
        >
          <section className="project-structure">
            <div className="project-section-heading">
              <h3>Products</h3>
              <small>
                {project.occurrences.length} {project.occurrences.length === 1 ? 'item' : 'items'}
              </small>
            </div>
            <p className="project-current-model">
              Ready to add: <strong>{currentPart.name}</strong>
            </p>
            {!!project.occurrences.length && (
              <div className="project-add-actions">
                <button className="secondary-button" onClick={() => add(null)}>
                  <Plus size={14} />
                  Add product
                </button>
                <button
                  className="secondary-button"
                  disabled={!selectedCanContain}
                  onClick={() => add(selected!.id)}
                >
                  <Plus size={14} />
                  Add inside selected
                </button>
              </div>
            )}
            <p id={`${workspaceId}-tree-help`} className="project-tree-help">
              Select a product to edit it. Arrow keys move through the structure.
            </p>
            <ul
              className="project-tree"
              aria-label="Product structure"
              aria-describedby={`${workspaceId}-tree-help`}
            >
              {renderTree(null)}
            </ul>
            {!project.occurrences.length && (
              <div className="project-empty project-empty-card">
                <FolderPlus size={28} aria-hidden="true" />
                <h3>Start your product structure</h3>
                <p>
                  {['assembly', 'complex', 'kit'].includes(currentPart.product.kind)
                    ? `Add ${currentPart.name}. Its declared library parts become a nested structure.`
                    : `Start with ${currentPart.name}, then add the other products your project needs.`}
                </p>
                <button className="secondary-button" onClick={() => add(null)}>
                  <Plus size={15} /> Add this model
                </button>
              </div>
            )}
          </section>

          <section className="project-editor" aria-label="Selected product">
            {selected && configuration && definition ? (
              <>
                <div className="project-section-heading">
                  <div>
                    <h3>{configuration.name}</h3>
                    <small>
                      {definition.product.kind} · revision {configuration.revision || '—'}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove selected product and its children"
                    onClick={removeSelectedProduct}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="project-product-tabs" role="tablist" aria-label="Product records">
                  {(
                    [
                      ['properties', 'Properties'],
                      ['supply', 'Make / buy'],
                      ['documents', 'Documents'],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      ref={productTab === tab ? activeProductTab : undefined}
                      id={`${workspaceId}-product-tab-${tab}`}
                      role="tab"
                      aria-selected={productTab === tab}
                      aria-controls={`${workspaceId}-product-${tab}`}
                      tabIndex={productTab === tab ? 0 : -1}
                      onKeyDown={navigateTabs}
                      onClick={() => setProductTab(tab)}
                    >
                      {label}
                      {tab === 'documents' && (
                        <span className="project-tab-badge">
                          {
                            project.documents.filter(
                              (item) => item.configurationId === configuration.id,
                            ).length
                          }
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="project-policy-note">
                  Changes to this design apply wherever it is used. Position, quantity and placement
                  apply here.
                </p>
                {onSelect && (
                  <button
                    className="text-button project-open-library"
                    onClick={() =>
                      onSelect(definition, configuration.parameters, configuration.state)
                    }
                  >
                    Open this configuration in the library
                  </button>
                )}
                {(['properties', 'supply', 'documents'] as const)
                  .filter((tab) => tab !== productTab)
                  .map((tab) => (
                    <div
                      key={tab}
                      id={`${workspaceId}-product-${tab}`}
                      role="tabpanel"
                      aria-labelledby={`${workspaceId}-product-tab-${tab}`}
                      hidden
                    />
                  ))}
                {productTab === 'properties' && (
                  <div
                    className="project-product-panel"
                    id={`${workspaceId}-product-properties`}
                    role="tabpanel"
                    aria-labelledby={`${workspaceId}-product-tab-properties`}
                  >
                    <div className="project-fields">
                      <label>
                        Designation
                        <input
                          value={configuration.designation}
                          onChange={(event) => configure({ designation: event.target.value })}
                        />
                      </label>
                      <label>
                        Name
                        <input
                          value={configuration.name}
                          onChange={(event) => configure({ name: event.target.value })}
                        />
                      </label>
                      <label>
                        Revision
                        <input
                          value={configuration.revision}
                          onChange={(event) => configure({ revision: event.target.value })}
                        />
                      </label>
                      <label>
                        Position in parent
                        <input
                          value={selected.position}
                          onChange={(event) => occurrence({ position: event.target.value })}
                        />
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={selected.quantity}
                          onChange={(event) => occurrence({ quantity: Number(event.target.value) })}
                        />
                      </label>
                      <label className="project-wide-field">
                        Parent assembly
                        <select
                          value={selected.parentId ?? ''}
                          onChange={(event) => occurrence({ parentId: event.target.value || null })}
                        >
                          <option value="">Project root</option>
                          {assemblyOccurrences
                            .filter((item) => item.id !== selected.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {
                                  project.configurations.find(
                                    (entry) => entry.id === item.configurationId,
                                  )?.name
                                }{' '}
                                · position {item.position}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="project-wide-field">
                        Installation notes
                        <input
                          value={selected.notes}
                          onChange={(event) => occurrence({ notes: event.target.value })}
                        />
                      </label>
                    </div>
                    <details className="project-advanced">
                      <summary>Placement and independent design</summary>
                      <div className="project-advanced-body">
                        <div className="project-placement">
                          {(['translation', 'rotation'] as const).map((key) => (
                            <fieldset key={key}>
                              <legend>
                                {key === 'translation'
                                  ? 'Local position (mm)'
                                  : 'Local rotation (degrees)'}
                              </legend>
                              {['X', 'Y', 'Z'].map((axis, index) => (
                                <label key={axis}>
                                  {axis}
                                  <input
                                    aria-label={`${key} ${axis}`}
                                    type="number"
                                    step="any"
                                    value={selected.placement[key][index]}
                                    onChange={(event) => {
                                      const values = [...selected.placement[key]] as [
                                        number,
                                        number,
                                        number,
                                      ];
                                      values[index] = Number(event.target.value);
                                      occurrence({
                                        placement: { ...selected.placement, [key]: values },
                                      });
                                    }}
                                  />
                                </label>
                              ))}
                            </fieldset>
                          ))}
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            try {
                              update(forkOccurrenceDesign(project, parts, selected.id));
                              setMessage(
                                'Independent design created. Assign its designation and document records before handoff.',
                              );
                            } catch (error) {
                              setMessage(String(error), 'error');
                            }
                          }}
                        >
                          Create independent design
                        </button>
                      </div>
                    </details>
                  </div>
                )}
                {productTab === 'supply' && (
                  <div
                    className="project-product-panel"
                    id={`${workspaceId}-product-supply`}
                    role="tabpanel"
                    aria-labelledby={`${workspaceId}-product-tab-supply`}
                  >
                    <p className="project-policy-note">
                      Choose how this design is supplied, then complete its manufacturing or
                      purchasing record. Changes apply wherever this design is used.
                    </p>
                    <div className="project-fields">
                      <label>
                        Supply
                        <select
                          value={configuration.supply}
                          disabled={definition.product.kind === 'reference'}
                          onChange={(event) => changeSupply(event.target.value as SupplyKind)}
                        >
                          {definition.product.kind === 'reference' ? (
                            <option value="reference">Reference only</option>
                          ) : (
                            <>
                              <option value="manufactured">Manufacture</option>
                              <option value="standard">Standard product</option>
                              <option value="purchased">Purchased product</option>
                            </>
                          )}
                        </select>
                      </label>
                    </div>
                    {configuration.supply === 'manufactured' && (
                      <div className="project-manufacturing">
                        <h4>Manufacturing record</h4>
                        <div className="project-fields">
                          <label>
                            Material
                            <input
                              value={configuration.manufacturing?.material ?? ''}
                              placeholder="Grade, condition and applicable standard"
                              onChange={(event) => manufacture({ material: event.target.value })}
                            />
                          </label>
                          <label>
                            Blank / stock
                            <input
                              value={configuration.manufacturing?.blank ?? ''}
                              placeholder="Stock section and dimensions"
                              onChange={(event) => manufacture({ blank: event.target.value })}
                            />
                          </label>
                        </div>
                        <fieldset className="project-processes">
                          <legend>Manufacturing route</legend>
                          {manufacturingProcesses.map((process) => (
                            <label key={process}>
                              <input
                                type="checkbox"
                                checked={
                                  configuration.manufacturing?.processes.includes(process) ?? false
                                }
                                onChange={(event) => {
                                  const current = configuration.manufacturing?.processes ?? [];
                                  manufacture({
                                    processes: event.target.checked
                                      ? [...current, process]
                                      : current.filter((item) => item !== process),
                                  });
                                }}
                              />
                              {process}
                            </label>
                          ))}
                        </fieldset>
                        <label className="project-textarea-label">
                          Manufacturing and inspection requirements
                          <textarea
                            value={configuration.manufacturing?.requirements.join('\n') ?? ''}
                            placeholder="One requirement per line: tolerances, fit, finish, inspection…"
                            onChange={(event) =>
                              manufacture({ requirements: event.target.value.split('\n') })
                            }
                          />
                        </label>
                      </div>
                    )}
                    {['standard', 'purchased'].includes(configuration.supply) && (
                      <div className="project-manufacturing">
                        <h4>Procurement record</h4>
                        <div className="project-fields">
                          {(['designation', 'manufacturer', 'source', 'standard'] as const).map(
                            (key) => (
                              <label key={key}>
                                {key === 'designation'
                                  ? 'Supplier designation'
                                  : key === 'source'
                                    ? 'Source / ordering record'
                                    : key === 'standard'
                                      ? 'Product standard'
                                      : 'Manufacturer'}
                                <input
                                  value={configuration.procurement?.[key] ?? ''}
                                  onChange={(event) => procure({ [key]: event.target.value })}
                                />
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {configuration.supply === 'reference' && (
                      <p className="project-empty">
                        Reference geometry supports inspection and is excluded from manufacturing
                        and purchasing lists.
                      </p>
                    )}
                  </div>
                )}
                {productTab === 'documents' && (
                  <div
                    className="project-product-panel"
                    id={`${workspaceId}-product-documents`}
                    role="tabpanel"
                    aria-labelledby={`${workspaceId}-product-tab-documents`}
                  >
                    <div className="project-documents">
                      <div className="project-section-heading">
                        <h4>Design documents</h4>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            update({
                              ...project,
                              documents: [...project.documents, createDocument(configuration)],
                            })
                          }
                        >
                          <FilePlus2 size={14} />
                          Add document
                        </button>
                      </div>
                      {project.documents
                        .filter((item) => item.configurationId === configuration.id)
                        .map((document) => (
                          <div className="project-document" key={document.id}>
                            <div className="project-fields">
                              <label>
                                Kind
                                <select
                                  value={document.kind}
                                  onChange={(event) =>
                                    documentChange(document, {
                                      kind: event.target.value as DesignDocument['kind'],
                                    })
                                  }
                                >
                                  {designDocumentKinds.map((kind) => (
                                    <option value={kind} key={kind}>
                                      {kind.replaceAll('-', ' ')}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Designation
                                <input
                                  value={document.designation}
                                  onChange={(event) =>
                                    documentChange(document, { designation: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Name
                                <input
                                  value={document.name}
                                  onChange={(event) =>
                                    documentChange(document, { name: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Revision
                                <input
                                  value={document.revision}
                                  onChange={(event) =>
                                    documentChange(document, { revision: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Format
                                <input
                                  value={document.format}
                                  onChange={(event) =>
                                    documentChange(document, { format: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                File / document link
                                <input
                                  value={document.file}
                                  onChange={(event) =>
                                    documentChange(document, { file: event.target.value })
                                  }
                                />
                              </label>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Remove document"
                              onClick={() =>
                                update({
                                  ...project,
                                  documents: project.documents.filter(
                                    (item) => item.id !== document.id,
                                  ),
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      {!project.documents.some(
                        (item) => item.configurationId === configuration.id,
                      ) && (
                        <p className="project-empty">
                          Record the drawings, models and instructions that define this design.
                          Files are referenced, not uploaded.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="project-empty project-empty-card project-editor-empty">
                <FilePlus2 size={32} aria-hidden="true" />
                <h3>
                  {project.occurrences.length
                    ? 'Choose a product to continue'
                    : 'Build your project, one product at a time'}
                </h3>
                <p>
                  {project.occurrences.length
                    ? 'Select a product in the structure to edit its identity, supply record and documents.'
                    : 'Add the current library model. You can then define its parts, documents and purchasing records.'}
                </p>
                {project.occurrences.length ? (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      selectProduct(
                        project.occurrences.find((item) => item.parentId === null)?.id ??
                          project.occurrences[0].id,
                      )
                    }
                  >
                    Select first product
                  </button>
                ) : (
                  <button className="secondary-button" onClick={() => add(null)}>
                    <Plus size={15} /> Add {currentPart.name}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {workspaceTab === 'specification' && (
        <section
          className="project-specification project-panel"
          id={`${workspaceId}-specification`}
          role="tabpanel"
          aria-labelledby={`${workspaceId}-tab-specification`}
        >
          <div className="project-section-heading">
            <h3>Specification</h3>
            <select
              aria-label="Specification assembly"
              value={specificationTarget ?? ''}
              onChange={(event) => setSpecificationId(event.target.value)}
            >
              <option value="">Project root products</option>
              {assemblyOccurrences.map((item) => (
                <option value={item.id} key={item.id}>
                  {project.configurations.find((entry) => entry.id === item.configurationId)?.name}{' '}
                  · position {item.position}
                </option>
              ))}
            </select>
          </div>
          <p className="project-policy-note">
            Each specification lists its direct children. Procurement and manufacturing lists
            multiply quantities through the complete structure.
          </p>
          <div className="project-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Position</th>
                  <th>Designation</th>
                  <th>Name</th>
                  <th>Revision</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="project-table-empty">
                      {structuralErrors.length
                        ? 'Resolve structural issues in Review to build a specification.'
                        : 'Add products or select an assembly to see its specification.'}
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <tr key={`${row.configurationId ?? 'document'}-${index}`}>
                    <td>{project.documentationRules.sectionLabels[row.section]}</td>
                    <td>{row.position}</td>
                    <td>{row.designation || '—'}</td>
                    <td>{row.name}</td>
                    <td>{row.revision}</td>
                    <td>{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="secondary-button project-inline-export"
            disabled={!!structuralErrors.length}
            onClick={() => download('specification')}
          >
            <ArrowDownToLine size={15} /> Download this specification CSV
          </button>
        </section>
      )}
      {workspaceTab === 'exports' && (
        <section
          className="project-panel project-export-panel"
          id={`${workspaceId}-exports`}
          role="tabpanel"
          aria-labelledby={`${workspaceId}-tab-exports`}
        >
          <div className="project-section-heading">
            <h3>Export and hand off</h3>
            <small>Draft records preserve unresolved requirements</small>
          </div>
          <div className="project-export-grid">
            <article className="project-export-card">
              <h4>Project backup</h4>
              <p>
                Complete product structure, revisions, enterprise rules and document links. Import
                this JSON to continue work.
              </p>
              <button
                className="secondary-button"
                disabled={!!structuralErrors.length}
                onClick={() => download('project')}
              >
                <ArrowDownToLine size={15} /> Project JSON
              </button>
            </article>
            <article className="project-export-card project-cad-export">
              <h4>FreeCAD assembly</h4>
              <p>
                Configured library parts, nested placements and design records. Choose the thread
                detail for this export.
              </p>
              <fieldset className="project-geometry-options">
                <legend>Thread detail</legend>
                {(['simple', 'full'] as const).map((mode) => (
                  <label key={mode} className={exportGeometryMode === mode ? 'selected' : ''}>
                    <input
                      type="radio"
                      name={`${workspaceId}-export-mode`}
                      value={mode}
                      aria-label={mode === 'simple' ? 'Simple' : 'Full'}
                      aria-describedby={`${workspaceId}-export-description-${mode}`}
                      checked={exportGeometryMode === mode}
                      onChange={() => {
                        cancelMacroExport();
                        setExportGeometryMode(mode);
                      }}
                    />
                    <span>
                      <strong>{mode === 'simple' ? 'Simple' : 'Full'}</strong>
                      <small id={`${workspaceId}-export-description-${mode}`}>
                        {mode === 'simple'
                          ? 'Smooth thread surfaces; lighter geometry'
                          : 'Detailed threads; more geometry'}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                ref={macroButton}
                className="secondary-button"
                disabled={!!structuralErrors.length || !project.occurrences.length || macroPending}
                aria-busy={macroPending}
                onClick={() => void downloadMacro()}
              >
                {macroPending ? (
                  <>
                    <LoaderCircle size={15} className="busy-spinner" aria-hidden="true" /> Preparing
                    macro…
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={15} /> FreeCAD macro ·{' '}
                    {exportGeometryMode === 'simple' ? 'Simple' : 'Full'}
                  </>
                )}
              </button>
            </article>
            <article className="project-export-card">
              <h4>Purchasing list</h4>
              <p>
                Bought and standard products with supplier records. Nested quantities are
                multiplied; supplied internals are counted once.
              </p>
              <button
                className="secondary-button"
                disabled={!!structuralErrors.length}
                onClick={() => download('purchased')}
              >
                <ArrowDownToLine size={15} /> Purchasing CSV
              </button>
            </article>
            <article className="project-export-card">
              <h4>Manufacturing list</h4>
              <p>
                Custom products with materials, stock, process routes and inspection requirements,
                aggregated across the project.
              </p>
              <button
                className="secondary-button"
                disabled={!!structuralErrors.length}
                onClick={() => download('manufactured')}
              >
                <ArrowDownToLine size={15} /> Manufacturing CSV
              </button>
            </article>
          </div>
          <p className="project-policy-note">
            Need an assembly specification? Select its scope in the Specification tab and download
            the CSV there.
          </p>
          {!!structuralErrors.length && (
            <p className="project-alert">Resolve structural issues in Review before exporting.</p>
          )}
        </section>
      )}
      {workspaceTab === 'review' && (
        <section
          className={`project-readiness project-panel${readiness.complete ? ' complete' : ''}`}
          id={`${workspaceId}-review`}
          role="tabpanel"
          aria-labelledby={`${workspaceId}-tab-review`}
          tabIndex={0}
        >
          <h3>
            {readiness.complete
              ? 'Documentation fields are complete'
              : `${readiness.issues.length} unresolved documentation or design issues`}
          </h3>
          <p>
            Completeness does not approve a design for fabrication, purchasing or machine operation.
          </p>
          {readiness.issues.length > 0 && (
            <ul>
              {(showAllIssues ? readiness.issues : readiness.issues.slice(0, 12)).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {readiness.issues.length > 12 && (
            <button className="text-button" onClick={() => setShowAllIssues(!showAllIssues)}>
              {showAllIssues ? 'Show fewer issues' : `Show all ${readiness.issues.length} issues`}
            </button>
          )}
          {readiness.reviewRequirements.length > 0 && (
            <details>
              <summary>
                Engineering review requirements ({readiness.reviewRequirements.length})
              </summary>
              <ul>
                {readiness.reviewRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
