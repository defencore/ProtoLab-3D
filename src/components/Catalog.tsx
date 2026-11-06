import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useDeferredValue,
  useId,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Search,
  X,
  ArrowUpRight,
  FolderOpen,
} from 'lucide-react';
import type { PartDefinition, Preset } from '../core/types';
import type {
  DiscoveryCandidate,
  DiscoveryFilters,
  DiscoverySuggestion,
} from '../core/discovery-types';
import {
  buildDiscoveryIndex,
  discoveryChoices,
  discoveryFamilyMatches,
  discoverySuggestions,
  emptyDiscoveryFilters,
  filterDiscoveryCandidates,
  hasDiscoveryFilters,
  parseDiscoveryQuery,
} from '../core/library-discovery';
import { numericRangeErrorMessage, parseNumericRange } from '../core/numeric-range';
import LibraryDiscoveryPanel from './LibraryDiscoveryPanel';
import { groupBrowseFamilies, type BrowseFamily } from '../core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../core/library-search';
import { resolveLibraryEntry } from '../core/library-identity';
import { PartIcon } from './PartIcon';
import LibraryBreadcrumbs from './LibraryBreadcrumbs';
import {
  productLibraryViewLabels,
  supplyKindLabels,
  type ProductLibraryView,
} from '../core/product-library';
import { librarySubgroups } from '../core/library';
import { libraryLabel } from '../core/library-labels';
import {
  libraryAreas,
  libraryArea,
  libraryNavigationGroups,
  filterLibraryLocation,
  libraryLocationContains,
  libraryLocationLabel,
  type LibraryArea,
  type LibraryLocation,
} from '../core/library-navigation';

interface Props {
  parts: PartDefinition[];
  selected: PartDefinition;
  onSelect: (part: PartDefinition, query?: string) => void;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  location?: LibraryLocation;
  locationRevision?: number;
  onLocationChange?: (location?: LibraryLocation) => void;
  onSelectPreset?: (part: PartDefinition, preset: Preset) => void;
  discoveryFilters?: DiscoveryFilters;
  onDiscoveryFiltersChange?: (filters: DiscoveryFilters) => void;
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
  location,
  locationRevision = 0,
  onLocationChange,
  onSelectPreset,
  discoveryFilters,
  onDiscoveryFiltersChange,
}: Props) {
  const discoveryEnabled = !!onSelectPreset;
  const [localFilters, setLocalFilters] = useState(emptyDiscoveryFilters);
  const filters = discoveryFilters ?? localFilters;
  const [discoveryExpanded, setDiscoveryExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [candidateLimit, setCandidateLimit] = useState(4);
  const suggestionListId = useId();
  const filterKey = JSON.stringify(filters);
  function updateDiscoveryFilters(next: DiscoveryFilters) {
    setSuggestionsDismissed(false);
    if (onDiscoveryFiltersChange) onDiscoveryFiltersChange(next);
    else setLocalFilters(next);
  }
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
  const searching = !!query.trim() || (discoveryEnabled && hasDiscoveryFilters(filters));
  const discoveryActive = discoveryEnabled && searching;
  const pending = query !== deferredQuery;
  const entries = useMemo(() => groupBrowseFamilies(parts), [parts]);
  const locationKey = JSON.stringify(location);
  const locationEntries = useMemo(
    () => filterLibraryLocation(entries, location),
    [entries, location],
  );
  const scoped = useMemo(
    () => entries.filter((entry) => libraryArea(entry.category) === area),
    [entries, area],
  );
  const groups = useMemo(() => libraryNavigationGroups(scoped, view), [scoped, view]);
  const searchIndex = useMemo(() => buildLibrarySearchIndex(entries), [entries]);
  const discoveryIndex = useMemo(
    () => (discoveryEnabled ? buildDiscoveryIndex(searchIndex) : []),
    [searchIndex, discoveryEnabled],
  );
  const locationCandidates = useMemo(
    () => discoveryIndex.filter((candidate) => libraryLocationContains(candidate.family, location)),
    [discoveryIndex, location],
  );
  const candidateMatches = useMemo(
    () =>
      discoveryActive ? filterDiscoveryCandidates(locationCandidates, deferredQuery, filters) : [],
    [discoveryActive, locationCandidates, deferredQuery, filterKey],
  );
  const contextCandidates = useMemo(
    () =>
      location || searchArea === 'all'
        ? locationCandidates
        : locationCandidates.filter(
            (candidate) => libraryArea(candidate.family.category) === searchArea,
          ),
    [locationCandidates, location, searchArea],
  );
  const visibleCandidates = useMemo(() => {
    const scopedCandidates =
      location || searchArea === 'all'
        ? candidateMatches
        : candidateMatches.filter(
            (candidate) => libraryArea(candidate.family.category) === searchArea,
          );
    const seen = new Set<string>();
    const first: DiscoveryCandidate[] = [],
      rest: DiscoveryCandidate[] = [];
    for (const candidate of scopedCandidates) {
      if (seen.has(candidate.part.id)) rest.push(candidate);
      else {
        seen.add(candidate.part.id);
        first.push(candidate);
      }
    }
    return [...first, ...rest];
  }, [candidateMatches, location, searchArea]);
  const choices = useMemo(
    () =>
      discoveryEnabled && discoveryExpanded
        ? discoveryChoices(contextCandidates, deferredQuery, filters)
        : {
            power: [],
            bearing: [],
            widthKind: filters.widthKind
              ? [
                  {
                    value: filters.widthKind,
                    label: (() => {
                      try {
                        return JSON.parse(filters.widthKind)[1] as string;
                      } catch {
                        return filters.widthKind;
                      }
                    })(),
                    count: 0,
                  },
                ]
              : [],
          },
    [discoveryEnabled, discoveryExpanded, contextCandidates, deferredQuery, filterKey],
  );
  const discoveryErrors = [
    ...parseNumericRange(filters.width).errors,
    ...parseNumericRange(parseDiscoveryQuery(query).width).errors,
  ].map(numericRangeErrorMessage);
  const suggestions = useMemo(
    () =>
      discoveryEnabled &&
      !suggestionsDismissed &&
      query === deferredQuery &&
      !discoveryErrors.length &&
      (searchFocused || (discoveryActive && visibleCandidates.length === 0))
        ? discoverySuggestions(contextCandidates, deferredQuery, filters)
        : [],
    [
      discoveryEnabled,
      searchFocused,
      contextCandidates,
      query,
      deferredQuery,
      filterKey,
      discoveryActive,
      visibleCandidates.length,
      discoveryErrors.length,
      suggestionsDismissed,
    ],
  );
  const allMatches = useMemo(() => {
    const discovered = discoveryActive
      ? discoveryFamilyMatches(candidateMatches, deferredQuery)
      : [];
    const constraints =
      discoveryActive &&
      (hasDiscoveryFilters(filters) || parseDiscoveryQuery(deferredQuery).hasConstraints);
    const navigation = constraints ? [] : searchLibrary(searchIndex, deferredQuery);
    const families = new Map(navigation.map((match) => [match.family.id, match]));
    for (const match of discovered)
      if (!families.has(match.family.id)) families.set(match.family.id, match);
    return [...families.values()].filter((match) =>
      libraryLocationContains(match.family, location),
    );
  }, [searchIndex, deferredQuery, location, discoveryActive, candidateMatches, filterKey]);
  const matches = useMemo(
    () =>
      location || searchArea === 'all'
        ? allMatches
        : allMatches.filter((match) => libraryArea(match.family.category) === searchArea),
    [allMatches, searchArea, location],
  );
  const search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const revealed = useRef('');

  useEffect(() => {
    setActiveSuggestion(-1);
    setCandidateLimit(4);
  }, [deferredQuery, filterKey, locationKey, searchArea]);
  useEffect(() => {
    if (activeSuggestion >= 0)
      document
        .getElementById(`${suggestionListId}-${activeSuggestion}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [activeSuggestion, suggestionListId]);

  useEffect(() => {
    if (!searching) setSearchArea('all');
  }, [searching]);

  useLayoutEffect(() => {
    if (location && scroll.current) scroll.current.scrollTop = 0;
  }, [locationKey, locationRevision]);

  useLayoutEffect(() => {
    const list = scroll.current;
    if (!list) return;
    const context = location
      ? branchKey('location', locationKey)
      : searching
        ? branchKey('search', searchArea)
        : branchKey(area, view);
    list.scrollTop = location ? 0 : (scrollPositions.current.get(context) ?? 0);
    const remember = () => scrollPositions.current.set(context, list.scrollTop);
    list.addEventListener('scroll', remember);
    return () => list.removeEventListener('scroll', remember);
  }, [area, view, searching, searchArea, locationKey]);

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
    if (location || discoveryActive || discoveryExpanded || deferredQuery.trim()) return;
    const frame = requestAnimationFrame(() => {
      scroll.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected.id, view, deferredQuery, locationKey, discoveryActive, discoveryExpanded]);
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
    const exact = resolveLibraryEntry(entry.members, query);
    if (exact) {
      if (exact.preset && onSelectPreset) onSelectPreset(exact.part, exact.preset);
      else onSelect(exact.part, exact.preset ? query.trim() : '');
      onClose();
      return;
    }
    const articleQuery = searching
      ? matches.find((match) => match.family.id === entry.id)?.articleQuery
      : '';
    if (
      discoveryActive &&
      (hasDiscoveryFilters(filters) || parseDiscoveryQuery(query).hasConstraints || articleQuery)
    ) {
      const compatible = visibleCandidates.filter((candidate) => candidate.family.id === entry.id);
      const candidate = compatible.find((item) => item.part.id === selected.id) ?? compatible[0];
      if (candidate) {
        chooseCandidate(candidate);
        return;
      }
    }
    onSelect(entry.members.find((part) => part.id === selected.id) ?? entry.primary, articleQuery);
    onClose();
  }
  function chooseCandidate(candidate: DiscoveryCandidate) {
    if (pending || discoveryErrors.length) return;
    onSelectPreset?.(candidate.part, candidate.preset);
    setSearchFocused(false);
    onClose();
  }
  function chooseSuggestion(suggestion: DiscoverySuggestion) {
    setSuggestionsDismissed(false);
    updateDiscoveryFilters({ ...filters, ...suggestion.filters });
    onQueryChange(suggestion.query);
    setActiveSuggestion(-1);
    search.current?.focus();
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
        onMouseDown={discoveryActive ? (event) => event.preventDefault() : undefined}
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
          role={discoveryEnabled ? 'combobox' : undefined}
          aria-autocomplete={discoveryEnabled ? 'list' : undefined}
          aria-expanded={discoveryEnabled ? suggestions.length > 0 : undefined}
          aria-controls={suggestions.length ? suggestionListId : undefined}
          aria-activedescendant={
            activeSuggestion >= 0 && suggestions[activeSuggestion]
              ? `${suggestionListId}-${activeSuggestion}`
              : undefined
          }
          placeholder={
            location
              ? `Search in ${libraryLocationLabel(location)}…`
              : discoveryEnabled
                ? 'Name, 12 V, bearing F68, width…'
                : 'Search all collections…'
          }
          value={query}
          onChange={(event) => {
            setSearchFocused(true);
            setSuggestionsDismissed(false);
            onQueryChange(event.target.value);
          }}
          onFocus={() => {
            setSearchFocused(true);
            setSuggestionsDismissed(false);
          }}
          onClick={() => {
            setSearchFocused(true);
            setSuggestionsDismissed(false);
          }}
          onBlur={() => {
            setSearchFocused(false);
            setActiveSuggestion(-1);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowDown' &&
              discoveryEnabled &&
              suggestionsDismissed &&
              query.trim()
            ) {
              event.preventDefault();
              event.stopPropagation();
              setSearchFocused(true);
              setSuggestionsDismissed(false);
              setActiveSuggestion(0);
              return;
            }
            if (event.key === 'Escape') {
              if (suggestions.length) {
                setSearchFocused(false);
                setSuggestionsDismissed(true);
                setActiveSuggestion(-1);
              } else onQueryChange('');
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (
              (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
              suggestions.length &&
              !pending
            ) {
              event.preventDefault();
              event.stopPropagation();
              setActiveSuggestion((current) =>
                event.key === 'ArrowDown'
                  ? (current + 1) % suggestions.length
                  : current <= 0
                    ? suggestions.length - 1
                    : current - 1,
              );
              return;
            }
            if (
              event.key === 'Enter' &&
              activeSuggestion >= 0 &&
              suggestions[activeSuggestion] &&
              !pending
            ) {
              event.preventDefault();
              event.stopPropagation();
              chooseSuggestion(suggestions[activeSuggestion]);
              return;
            }
            if (event.key === 'Enter' && discoveryActive) {
              event.preventDefault();
              setSearchFocused(false);
              setSuggestionsDismissed(true);
              return;
            }
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
      {searching && !location && !discoveryActive && (
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
      {discoveryActive ? (
        !location && (
          <label className="library-discovery-collection">
            <span>Collection</span>
            <select
              aria-label="Search collection"
              value={searchArea}
              onChange={(event) => setSearchArea(event.target.value as LibraryArea | 'all')}
            >
              <option value="all">All collections ({allMatches.length})</option>
              {libraryAreas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} (
                  {
                    allMatches.filter((match) => libraryArea(match.family.category) === item.id)
                      .length
                  }
                  )
                </option>
              ))}
            </select>
          </label>
        )
      ) : (
        <nav className="library-areas" aria-label="Library collections">
          {libraryAreas.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.description}
              aria-pressed={!location && (searching ? searchArea === item.id : area === item.id)}
              onClick={() => {
                setArea(item.id);
                if (location) {
                  onLocationChange?.(undefined);
                  onQueryChange('');
                  setSearchArea('all');
                } else if (searching) setSearchArea(item.id);
              }}
            >
              <PartIcon type={item.icon} size={15} />
              <span>{item.label}</span>
              <small aria-hidden="true">
                {searching && !location
                  ? allMatches.filter((match) => libraryArea(match.family.category) === item.id)
                      .length
                  : entries.filter((entry) => libraryArea(entry.category) === item.id).length}
              </small>
            </button>
          ))}
        </nav>
      )}
      {location && (
        <div className="library-location">
          <LibraryBreadcrumbs
            location={location}
            label="Library scope"
            className="library-scope-path"
            onNavigate={(next) => {
              onLocationChange?.(next);
              onQueryChange('');
              setSearchArea('all');
            }}
          />
          <button
            type="button"
            className="library-location-clear"
            onClick={() => {
              onLocationChange?.(undefined);
              onQueryChange('');
              setSearchArea('all');
            }}
          >
            Browse collections
          </button>
        </div>
      )}
      {!searching && !location && (
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
        {discoveryEnabled && (
          <LibraryDiscoveryPanel
            query={query}
            filters={filters}
            choices={choices}
            suggestions={suggestions}
            candidates={pending ? [] : visibleCandidates.slice(0, candidateLimit)}
            total={visibleCandidates.length}
            errors={discoveryErrors}
            expanded={discoveryExpanded}
            onExpandedChange={setDiscoveryExpanded}
            onFiltersChange={updateDiscoveryFilters}
            onSuggestion={chooseSuggestion}
            onSelect={chooseCandidate}
            suggestionListId={suggestionListId}
            activeSuggestion={activeSuggestion}
            pending={pending}
            onShowMore={
              visibleCandidates.length > candidateLimit
                ? () => setCandidateLimit((count) => count + 8)
                : undefined
            }
          />
        )}
        <div className="library-heading">
          <span>
            {location
              ? `${searching ? 'Search in ' : ''}${libraryLocationLabel(location)}`
              : searching
                ? searchArea === 'all'
                  ? 'Search all collections'
                  : `Search in ${searchCollection!.label}`
                : collection.label}
          </span>
          <span>
            {searching
              ? pending
                ? '…'
                : matches.length
              : location
                ? locationEntries.length
                : scoped.length}
          </span>
          {!searching && !location && (
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
        {!searching && !location && (
          <p className="library-collection-description">{collection.description}</p>
        )}
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
                {searchArea !== 'all' && !location && (
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
        ) : location ? (
          <div className="library-location-results">
            <div className="search-count" role="status">
              {locationEntries.length} products in this level
            </div>
            {locationEntries.map((entry) =>
              entryButton(
                entry,
                location.level === 'subgroup'
                  ? undefined
                  : `${libraryLabel(entry.category)} › ${libraryLabel(entry.subgroup)}`,
              ),
            )}
            {!locationEntries.length && (
              <div className="empty-catalog">
                <strong>No products in this level</strong>
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
