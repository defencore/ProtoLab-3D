import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Search,
  X,
} from 'lucide-react';
import type { AssemblyComponent } from '../core/product-types';
import type { Parameters, PartDefinition } from '../core/types';
import { assemblyBomRows } from '../core/assembly-bom';
import { configurationLink } from '../core/configuration-link';
import './AssemblyStructurePanel.css';

export interface AssemblyStructurePanelProps {
  part: PartDefinition;
  libraryParts: readonly PartDefinition[];
  parameters: Parameters;
  referenceComponents?: readonly AssemblyComponent[];
  selectedComponentId: string | null;
  hiddenComponentIds: readonly string[];
  onSelectComponent?: (component: AssemblyComponent | null) => void;
  onToggleComponentVisibility?: (component: AssemblyComponent) => void;
  onShowAll?: () => void;
}

interface ComponentNode {
  component: AssemblyComponent;
  key: string;
  position: string;
  depth: number;
  children: ComponentNode[];
}

type PanelTab = 'components' | 'bom';
const panelTabs: { id: PanelTab; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'bom', label: 'BOM' },
];

function componentNodes(
  components: readonly AssemblyComponent[],
  parentKey: string,
  parentPosition = '',
  depth = 0,
): ComponentNode[] {
  return components.map((component, index) => {
    const key = `${parentKey}/${encodeURIComponent(component.id)}`;
    const position = parentPosition ? `${parentPosition}.${index + 1}` : String(index + 1);
    const children =
      component.supply === 'purchased' || component.supply === 'standard'
        ? []
        : (component.children ?? []);
    return {
      component,
      key,
      position,
      depth,
      children: componentNodes(children, key, position, depth + 1),
    };
  });
}

function flattenNodes(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function supplyLabel(component: AssemblyComponent): { label: string; kind: string } {
  if (component.supply === 'purchased') return { label: 'Buy', kind: 'buy' };
  if (component.supply === 'standard') return { label: 'Standard', kind: 'buy' };
  if (component.supply === 'reference') return { label: 'Reference', kind: 'reference' };
  const processes = component.manufacturing?.processes ?? [];
  if (processes.includes('printing')) return { label: 'Print', kind: 'make' };
  if (processes.some((process) => ['turning', 'milling', 'drilling'].includes(process))) {
    return { label: 'Machine', kind: 'make' };
  }
  if (processes.includes('cutting')) return { label: 'Cut', kind: 'make' };
  if (processes.includes('assembly')) return { label: 'Assemble', kind: 'make' };
  return { label: 'Make', kind: 'make' };
}

function componentDescription(component: AssemblyComponent): string {
  if (component.procurement) {
    return [component.procurement.designation, component.procurement.manufacturer]
      .filter((value) => value && value !== component.name)
      .join(' · ');
  }
  return component.manufacturing?.material ?? '';
}

function filterNodes(nodes: ComponentNode[], query: string): ComponentNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, query);
    const matches = [
      node.component.name,
      componentDescription(node.component),
      supplyLabel(node.component).label,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query);
    return matches || children.length
      ? [{ ...node, children: matches ? node.children : children }]
      : [];
  });
}

function countComponents(
  nodes: ComponentNode[],
  multiplier = 1,
): { total: number; make: number; buy: number } {
  return nodes.reduce(
    (counts, node) => {
      const quantity = node.component.quantity * multiplier;
      if (node.children.length) {
        const children = countComponents(node.children, quantity);
        return {
          total: counts.total + children.total,
          make: counts.make + children.make,
          buy: counts.buy + children.buy,
        };
      }
      const kind = supplyLabel(node.component).kind;
      return {
        total: counts.total + quantity,
        make: counts.make + (kind === 'make' ? quantity : 0),
        buy: counts.buy + (kind === 'buy' ? quantity : 0),
      };
    },
    { total: 0, make: 0, buy: 0 },
  );
}

export default function AssemblyStructurePanel({
  part,
  libraryParts,
  parameters,
  referenceComponents,
  selectedComponentId,
  hiddenComponentIds,
  onSelectComponent,
  onToggleComponentVisibility,
  onShowAll,
}: AssemblyStructurePanelProps) {
  const panelId = useId();
  const [activeTab, setActiveTab] = useState<PanelTab>('components');
  const tabRefs = useRef<Partial<Record<PanelTab, HTMLButtonElement>>>({});
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const assembly = useMemo(() => {
    try {
      const components = part.composition?.(parameters).components ?? [];
      return {
        components,
        nodes: componentNodes(components, part.id),
        error: false,
      };
    } catch {
      return { components: [], nodes: [], error: true };
    }
  }, [part, parameters]);
  const nodes = useMemo(
    () => [
      ...componentNodes(referenceComponents ?? [], part.id).map((node) => ({
        ...node,
        position: '—',
      })),
      ...assembly.nodes,
    ],
    [part.id, referenceComponents, assembly.nodes],
  );
  const referenceCount = referenceComponents?.length ?? 0;
  const allNodes = useMemo(() => flattenNodes(nodes), [nodes]);
  const counts = useMemo(() => countComponents(assembly.nodes), [assembly.nodes]);
  const hiddenIds = useMemo(() => new Set(hiddenComponentIds), [hiddenComponentIds]);
  const hiddenCount = allNodes.filter((node) => hiddenIds.has(node.component.id)).length;
  const filteredNodes = useMemo(
    () => filterNodes(nodes, query.trim().toLocaleLowerCase()),
    [nodes, query],
  );
  const bom = useMemo(() => {
    if (activeTab !== 'bom') return { rows: [], error: '' };
    try {
      return { rows: assemblyBomRows(assembly.components, libraryParts), error: '' };
    } catch (error) {
      return {
        rows: [],
        error:
          error instanceof Error ? error.message : 'The bill of materials could not be loaded.',
      };
    }
  }, [activeTab, assembly.components, libraryParts]);
  const filteredBom = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return bom.rows.filter((row) =>
      [
        row.component.name,
        componentDescription(row.component),
        row.libraryEntryId,
        supplyLabel(row.component).label,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [bom.rows, query]);

  useEffect(() => {
    setQuery('');
    setExpanded({});
    setCopiedKey(null);
    setCopyError(false);
  }, [part.id]);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  async function copyName(node: ComponentNode) {
    try {
      await navigator.clipboard.writeText(node.component.name);
      setCopiedKey(node.key);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  if (!part.composition || (!nodes.length && !assembly.error)) return null;

  function renderNode(node: ComponentNode, ancestorHidden = false) {
    const { component } = node;
    const isSelected = selectedComponentId === component.id;
    const isHidden = ancestorHidden || hiddenIds.has(component.id);
    const isExpanded = expanded[node.key] ?? (Boolean(query.trim()) || node.depth === 0);
    const childrenId = `${panelId}-${node.key}`;
    const supply = supplyLabel(component);
    const description = componentDescription(component);
    const label =
      component.supply === 'reference'
        ? `reference: ${component.name}`
        : `component ${node.position}: ${component.name}`;
    return (
      <li key={node.key}>
        <div
          className={`assembly-structure-row${isSelected ? ' is-selected' : ''}${isHidden ? ' is-hidden' : ''}`}
          style={{ paddingLeft: `${8 + node.depth * 16}px` }}
        >
          {node.children.length ? (
            <button
              type="button"
              className="assembly-structure-icon assembly-structure-toggle"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
              aria-expanded={isExpanded}
              aria-controls={childrenId}
              onClick={() => setExpanded((current) => ({ ...current, [node.key]: !isExpanded }))}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="assembly-structure-toggle-spacer" />
          )}
          <button
            type="button"
            className="assembly-structure-component"
            aria-label={`Select ${label}`}
            aria-pressed={isSelected}
            onClick={(event) => {
              const selection = window.getSelection();
              if (selection?.toString() && selection.containsNode(event.currentTarget, true))
                return;
              onSelectComponent?.(isSelected ? null : component);
            }}
            title={description ? `${component.name} · ${description}` : component.name}
          >
            <span className="assembly-structure-position">{node.position}</span>
            <span className="assembly-structure-name">{component.name}</span>
            <span className="assembly-structure-quantity">×{component.quantity}</span>
          </button>
          <span className={`assembly-structure-supply is-${supply.kind}`}>{supply.label}</span>
          <button
            type="button"
            className="assembly-structure-icon"
            aria-label={`Copy name of ${label}`}
            title={copiedKey === node.key ? 'Name copied' : 'Copy component name'}
            onClick={() => void copyName(node)}
          >
            {copiedKey === node.key ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {onToggleComponentVisibility && (
            <button
              type="button"
              className="assembly-structure-icon"
              aria-label={
                ancestorHidden
                  ? `${label} is hidden with its assembly`
                  : `${isHidden ? 'Show' : 'Hide'} ${label}`
              }
              aria-pressed={!isHidden}
              disabled={ancestorHidden}
              title={
                ancestorHidden
                  ? 'Show its parent assembly first'
                  : isHidden
                    ? 'Show component'
                    : 'Hide component'
              }
              onClick={() => onToggleComponentVisibility(component)}
            >
              {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {component.supply !== 'reference' && (
            <a
              className="assembly-structure-icon assembly-structure-open"
              aria-label={`Open ${label} in library (new tab)`}
              title="Open in new tab"
              href={configurationLink(component)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowUpRight size={16} />
            </a>
          )}
        </div>
        {node.children.length > 0 && (
          <ul id={childrenId} hidden={!isExpanded}>
            {node.children.map((child) => renderNode(child, isHidden))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <section className="assembly-structure" aria-labelledby={`${panelId}-title`}>
      <div className="assembly-structure-heading">
        <div>
          <h3 id={`${panelId}-title`}>Assembly components</h3>
          {!assembly.error && !(activeTab === 'bom' && bom.error) && (
            <p>
              {activeTab === 'bom' ? (
                <>
                  {bom.rows.length} unique {bom.rows.length === 1 ? 'element' : 'elements'}
                </>
              ) : (
                <>
                  {counts.total} {counts.total === 1 ? 'item' : 'items'}
                  {counts.make > 0 && <> · {counts.make} make</>}
                  {counts.buy > 0 && <> · {counts.buy} buy</>}
                  {referenceCount > 0 && (
                    <>
                      {' '}
                      · {referenceCount} {referenceCount === 1 ? 'reference' : 'references'}
                    </>
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <div className="assembly-structure-actions">
          {selectedComponentId && onSelectComponent && (
            <button type="button" onClick={() => onSelectComponent(null)}>
              Clear selection
            </button>
          )}
          {hiddenCount > 0 && onShowAll && (
            <button type="button" onClick={onShowAll}>
              Show all ({hiddenCount} hidden)
            </button>
          )}
        </div>
      </div>
      {!assembly.error && (
        <div className="assembly-structure-tabs" role="tablist" aria-label="Assembly information">
          {panelTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current[tab.id] = element;
              }}
              type="button"
              role="tab"
              id={`${panelId}-tab-${tab.id}`}
              aria-controls={`${panelId}-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === 'ArrowRight') next = (index + 1) % panelTabs.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + panelTabs.length - 1) % panelTabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = panelTabs.length - 1;
                else return;
                event.preventDefault();
                const nextTab = panelTabs[next].id;
                setActiveTab(nextTab);
                tabRefs.current[nextTab]?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {assembly.error ? (
        <p className="assembly-structure-empty" role="status">
          The component list could not be loaded.
        </p>
      ) : (
        <>
          {(Boolean(query) ||
            (activeTab === 'bom' ? bom.rows.length > 8 : allNodes.length > 8)) && (
            <div className="assembly-structure-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder={activeTab === 'bom' ? 'Find a BOM element…' : 'Find a component…'}
                aria-label={
                  activeTab === 'bom' ? 'Find a BOM element' : 'Find an assembly component'
                }
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear component search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <div
            role="tabpanel"
            id={`${panelId}-panel-components`}
            aria-labelledby={`${panelId}-tab-components`}
            hidden={activeTab !== 'components'}
            tabIndex={0}
          >
            {filteredNodes.length ? (
              <div className="assembly-structure-scroll">
                <ul className="assembly-structure-tree" aria-label="Assembly components">
                  {filteredNodes.map((node) => renderNode(node))}
                </ul>
              </div>
            ) : (
              <p className="assembly-structure-empty" role="status">
                No matching components.
              </p>
            )}
            <p className="assembly-structure-help">
              {copyError
                ? 'Could not copy. Select the component name and copy it manually.'
                : 'Select a component to inspect it. Copy its name with the copy button, or select the text. Use ↗ to open its library model in a new tab.'}
            </p>
          </div>
          <div
            role="tabpanel"
            id={`${panelId}-panel-bom`}
            aria-labelledby={`${panelId}-tab-bom`}
            hidden={activeTab !== 'bom'}
            tabIndex={0}
          >
            {bom.error ? (
              <p className="assembly-structure-empty" role="status">
                {bom.error}
              </p>
            ) : filteredBom.length ? (
              <div className="assembly-structure-scroll">
                <table className="assembly-bom-table" aria-label="Bill of materials">
                  <thead>
                    <tr>
                      <th scope="col">Element</th>
                      <th scope="col" className="assembly-bom-supply">
                        Type
                      </th>
                      <th scope="col" className="assembly-bom-quantity">
                        Qty
                      </th>
                      <th scope="col" className="assembly-bom-actions">
                        <span className="assembly-structure-copy-status">Library</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBom.map((row) => {
                      const supply = supplyLabel(row.component);
                      const description = componentDescription(row.component);
                      return (
                        <tr key={row.key}>
                          <td>
                            <span className="assembly-bom-name">{row.component.name}</span>
                            {description && (
                              <span className="assembly-bom-description">{description}</span>
                            )}
                            <code className="assembly-bom-id">{row.libraryEntryId}</code>
                          </td>
                          <td className="assembly-bom-supply">
                            <span className={`assembly-structure-supply is-${supply.kind}`}>
                              {supply.label}
                            </span>
                          </td>
                          <td className="assembly-bom-quantity">{row.quantity}</td>
                          <td className="assembly-bom-actions">
                            <a
                              className="assembly-structure-icon assembly-structure-open"
                              aria-label={`Open BOM element: ${row.component.name} in library (new tab)`}
                              title="Open in new tab"
                              href={configurationLink(row.component)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ArrowUpRight size={16} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="assembly-structure-empty" role="status">
                {query.trim() ? 'No matching BOM elements.' : 'No physical components.'}
              </p>
            )}
            {!bom.error && (
              <p className="assembly-structure-help">
                Totals include nested subassemblies and their components. Purchased assemblies
                remain one supplied unit. Engineering references are excluded.
              </p>
            )}
          </div>
          <span className="assembly-structure-copy-status" role="status" aria-live="polite">
            {copyError
              ? 'Could not copy. Select the component name and copy it manually.'
              : copiedKey
                ? 'Component name copied.'
                : ''}
          </span>
        </>
      )}
    </section>
  );
}
