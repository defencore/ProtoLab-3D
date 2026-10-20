import { useRef, useState, useEffect, useLayoutEffect, useMemo, useDeferredValue } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Search,
  X,
  ArrowUpRight,
  FolderOpen,
} from 'lucide-react';
import type { PartDefinition } from '../core/types';
import { groupBrowseFamilies, type BrowseFamily } from '../core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../core/library-search';
import { PartIcon } from './PartIcon';
import {
  productLibraryViewLabels,
  supplyKindLabels,
  type ProductLibraryView,
} from '../core/product-library';
import { librarySubgroups } from '../core/library';
import {
  libraryAreas,
  libraryArea,
  libraryLabel,
  libraryNavigationGroups,
  type LibraryArea,
} from '../core/library-navigation';

interface Props {
  parts: PartDefinition[];
  selected: PartDefinition;
  onSelect: (part: PartDefinition, query?: string) => void;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const branchStorageKey = 'protolab.library-open-branches';
const branchKey = (...path: string[]) => JSON.stringify(path);

function readOpenBranches(): Set<string> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(branchStorageKey) ?? '[]');
    return new Set(
      Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export default function Catalog({
  parts,
  selected,
  onSelect,
  onClose,
  query,
  onQueryChange,
}: Props) {
  const [view, setView] = useState<ProductLibraryView>(() => {
    try {
      const saved = localStorage.getItem('protolab.library-view');
      return saved && Object.hasOwn(productLibraryViewLabels, saved)
        ? (saved as ProductLibraryView)
        : 'engineering';
    } catch {
      return 'engineering';
    }
  });
  const [area, setArea] = useState<LibraryArea>(() => libraryArea(selected.category));
  const [searchArea, setSearchArea] = useState<LibraryArea | 'all'>('all');
  const [openBranches, setOpenBranches] = useState(readOpenBranches);
  const deferredQuery = useDeferredValue(query);
  const searching = !!query.trim();
  const pending = query !== deferredQuery;
  const entries = useMemo(() => groupBrowseFamilies(parts), [parts]);
  const scoped = useMemo(
    () => entries.filter((entry) => libraryArea(entry.category) === area),
    [entries, area],
  );
  const groups = useMemo(() => libraryNavigationGroups(scoped, view), [scoped, view]);
  const searchIndex = useMemo(() => buildLibrarySearchIndex(entries), [entries]);
  const allMatches = useMemo(
    () => searchLibrary(searchIndex, deferredQuery),
    [searchIndex, deferredQuery],
  );
  const matches = useMemo(
    () =>
      searchArea === 'all'
        ? allMatches
        : allMatches.filter((match) => libraryArea(match.family.category) === searchArea),
    [allMatches, searchArea],
  );
  const search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const revealed = useRef('');

  useEffect(() => {
    if (!searching) setSearchArea('all');
  }, [searching]);

  useLayoutEffect(() => {
    const list = scroll.current;
    if (!list) return;
    const context = searching ? branchKey('search', searchArea) : branchKey(area, view);
    list.scrollTop = scrollPositions.current.get(context) ?? 0;
    const remember = () => scrollPositions.current.set(context, list.scrollTop);
    list.addEventListener('scroll', remember);
    return () => list.removeEventListener('scroll', remember);
  }, [area, view, searching, searchArea]);

  useLayoutEffect(() => {
    if (searching && scroll.current) scroll.current.scrollTop = 0;
  }, [deferredQuery, searching]);

  useEffect(() => {
    setArea(libraryArea(selected.category));
  }, [selected.id, selected.category]);
  useEffect(() => {
    const group = groups.find((group) =>
      group.entries.some((entry) => entry.members.some((part) => part.id === selected.id)),
    );
    const selection = branchKey(selected.id, view);
    if (!group || revealed.current === selection) return;
    revealed.current = selection;
    setOpenBranches(
      (current) =>
        new Set([
          ...current,
          branchKey(area, view, group.id),
          branchKey(area, view, group.id, selected.subgroup),
        ]),
    );
  }, [selected.id, selected.category, selected.subgroup, area, view, groups]);
  useEffect(() => {
    try {
      sessionStorage.setItem(branchStorageKey, JSON.stringify([...openBranches]));
    } catch {
      /* Open branches still remain available while the library is mounted. */
    }
  }, [openBranches]);
  useEffect(() => {
    try {
      localStorage.setItem('protolab.library-view', view);
    } catch {
      /* Grouping still applies for this session. */
    }
  }, [view]);
  // Follow a selected product once; expanding another branch must never pull the scroll back.
  useEffect(() => {
    if (deferredQuery.trim()) return;
    const frame = requestAnimationFrame(() => {
      scroll.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected.id, view, deferredQuery]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !document.querySelector('dialog[open]') &&
        !(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        )
      ) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function choose(entry: BrowseFamily) {
    onSelect(
      entry.members.find((part) => part.id === selected.id) ?? entry.primary,
      searching ? matches.find((match) => match.family.id === entry.id)?.articleQuery : '',
    );
    onClose();
  }
  function toggleBranch(key: string) {
    setOpenBranches((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function collapseBranches() {
    const keys = new Set(
      groups.flatMap((group) => [
        branchKey(area, view, group.id),
        ...group.entries.map((entry) => branchKey(area, view, group.id, entry.subgroup)),
      ]),
    );
    setOpenBranches((current) => new Set([...current].filter((key) => !keys.has(key))));
  }
  function entryButton(entry: BrowseFamily, subtitle?: string) {
    const current = entry.members.some((part) => part.id === selected.id);
    return (
      <button
        key={entry.id}
        className={`part-button ${current ? 'selected' : ''}`}
        onClick={() => choose(entry)}
        aria-current={current ? 'true' : undefined}
      >
        <PartIcon type={entry.icon} size={15} />
        <span className="library-entry-label">
          <span>{entry.label}</span>
          {subtitle && <small className="product-source-label">{subtitle}</small>}
        </span>
        {current && <span className="selected-indicator" />}
      </button>
    );
  }
  function groupContents(group: (typeof groups)[number]) {
    if (view !== 'engineering')
      return group.entries.map((entry) => {
        const supply = [...new Set(entry.members.map((part) => part.product.supply))];
        return entryButton(
          entry,
          supply.length === 1 ? supplyKindLabels[supply[0]] : 'Multiple supply options',
        );
      });
    if (group.entries.length <= 4)
      return group.entries.map((entry) =>
        entryButton(entry, entry.grouped ? undefined : libraryLabel(entry.subgroup)),
      );
    const subgroups = librarySubgroups(
      group.entries.flatMap((entry) => entry.members),
      group.id,
    );
    return subgroups.map((name) => {
      const items = group.entries.filter((entry) => entry.subgroup === name);
      // A heading with a single child adds a click without helping the choice.
      if (items.length === 1)
        return entryButton(items[0], items[0].grouped ? undefined : libraryLabel(name));
      const key = branchKey(area, view, group.id, name);
      const open = openBranches.has(key);
      return (
        <div key={key} className="subgroup">
          <button
            className="subgroup-button"
            onClick={() => toggleBranch(key)}
            aria-expanded={open}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{libraryLabel(name)}</span>
            <small>{items.length}</small>
          </button>
          {open && items.map((entry) => entryButton(entry))}
        </div>
      );
    });
  }
  const collection = libraryAreas.find((item) => item.id === area)!;
  const searchCollection = libraryAreas.find((item) => item.id === searchArea);
  return (
    <aside className="catalog" aria-label="Part library">
      <div className="panel-label">
        <span>PART LIBRARY</span>
        <span className="count-label">{entries.length}</span>
        <button
          className="icon-button mobile-close"
          onClick={onClose}
          aria-label="Close part library"
        >
          <X size={18} />
        </button>
      </div>
      <div className="search-box">
        <Search size={17} />
        <input
          ref={search}
          aria-label="Search parts"
          placeholder="Search all collections…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onQueryChange('');
            if (event.key === 'ArrowDown' && searching && !pending) {
              event.preventDefault();
              scroll.current?.querySelector<HTMLButtonElement>('.part-button')?.focus();
            }
            if (event.key === 'Enter' && searching && !pending && matches[0])
              choose(matches[0].family);
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              search.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>
      {searching && (
        <button
          type="button"
          className="library-search-scope"
          aria-pressed={searchArea === 'all'}
          onClick={() => setSearchArea('all')}
        >
          <Search size={13} />
          <span>All collections</span>
          <small>{allMatches.length}</small>
        </button>
      )}
      <nav className="library-areas" aria-label="Library collections">
        {libraryAreas.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            title={item.description}
            aria-pressed={searching ? searchArea === item.id : area === item.id}
            onClick={() => {
              setArea(item.id);
              if (searching) setSearchArea(item.id);
            }}
          >
            <PartIcon type={item.icon} size={15} />
            <span>{item.label}</span>
            <small aria-hidden="true">
              {searching
                ? allMatches.filter((match) => libraryArea(match.family.category) === item.id)
                    .length
                : entries.filter((entry) => libraryArea(entry.category) === item.id).length}
            </small>
          </button>
        ))}
      </nav>
      {!searching && (
        <div className="library-view-picker">
          <label htmlFor="library-view">Group by</label>
          <select
            id="library-view"
            value={view}
            onChange={(event) => setView(event.target.value as ProductLibraryView)}
          >
            {Object.entries(productLibraryViewLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="catalog-scroll" ref={scroll} aria-busy={searching && pending}>
        <div className="library-heading">
          <span>
            {searching
              ? searchArea === 'all'
                ? 'Search all collections'
                : `Search in ${searchCollection!.label}`
              : collection.label}
          </span>
          <span>{searching ? (pending ? '…' : matches.length) : scoped.length}</span>
          {!searching && (
            <button
              type="button"
              className="icon-button library-collapse"
              onClick={collapseBranches}
              aria-label={`Collapse open groups in ${collection.label}`}
              title="Collapse open groups"
            >
              <ChevronsDownUp size={14} />
            </button>
          )}
        </div>
        {!searching && <p className="library-collection-description">{collection.description}</p>}
        {searching ? (
          <div className="library-search-results">
            <div className="search-count" role="status">
              {pending
                ? 'Searching…'
                : `${matches.length} ${matches.length === 1 ? 'result' : 'results'} found`}
            </div>
            {!pending &&
              matches.map(({ family }) =>
                entryButton(
                  family,
                  `${libraryLabel(family.category)} › ${libraryLabel(family.subgroup)}`,
                ),
              )}
            {!pending && !matches.length && (
              <div className="empty-catalog">
                <Search size={24} />
                <strong>No matching parts</strong>
                <p>Try a name, designation or size, such as “jig” or “M3 × 10”.</p>
                {searchArea !== 'all' && (
                  <button className="text-button" onClick={() => setSearchArea('all')}>
                    Search all collections
                  </button>
                )}
                <button className="text-button" onClick={() => onQueryChange('')}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        ) : (
          groups.map((group) => {
            // A collection with one category does not repeat the same heading.
            if (groups.length === 1)
              return (
                <div className="library-direct-group" key={group.id}>
                  {view !== 'engineering' && (
                    <div className="library-group-label">{group.label}</div>
                  )}
                  {groupContents(group)}
                </div>
              );
            const key = branchKey(area, view, group.id);
            const open = openBranches.has(key);
            const current = group.entries.some((entry) =>
              entry.members.some((part) => part.id === selected.id),
            );
            return (
              <div className="category" key={group.id}>
                <button
                  className={`category-button ${current ? 'current-category' : ''}`}
                  onClick={() => toggleBranch(key)}
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <PartIcon type={group.icon} size={17} />
                  <span>{group.label}</span>
                  <small>{group.entries.length}</small>
                </button>
                {open && <div className="category-content">{groupContents(group)}</div>}
              </div>
            );
          })
        )}
      </div>
      <div className="catalog-footer">
        <div>
          <FolderOpen size={16} />
          <strong>Choose a product, then a size.</strong>
        </div>
        <a
          href="https://github.com/defencore/ProtoLab-3D#adding-a-part"
          target="_blank"
          rel="noreferrer"
        >
          Create a part module <ArrowUpRight size={14} />
        </a>
      </div>
    </aside>
  );
}
