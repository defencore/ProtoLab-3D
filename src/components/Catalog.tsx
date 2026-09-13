import { useRef, useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, X, ArrowUpRight, Box, FolderOpen } from 'lucide-react';
import type { PartDefinition } from '../core/types';
import { PartIcon } from './PartIcon';

interface Props {
  parts: PartDefinition[];
  selected: PartDefinition;
  onSelect: (part: PartDefinition) => void;
  onClose: () => void;
}

export default function Catalog({ parts, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([selected.category]);
  const [subgroups, setSubgroups] = useState<string[]>([selected.subgroup]);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setExpanded((current) => [...new Set([...current, selected.category])]);
    setSubgroups((current) => [...new Set([...current, selected.subgroup])]);
  }, [selected]);
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
  const searchIndex = useMemo(
    () =>
      parts.map((part) => ({
        part,
        text: `${part.name} ${part.category} ${part.subgroup} ${part.description} ${part.keywords.join(' ')} ${part.presets.map((preset) => `${preset.name} ${preset.description} ${preset.catalog?.designation ?? ''} ${preset.catalog?.manufacturer ?? ''} ${preset.catalog?.standard ?? ''} ${preset.catalog?.sourceName ?? ''} ${preset.catalog?.productCodes?.join(' ') ?? ''}`).join(' ')}`.toLowerCase(),
      })),
    [parts],
  );
  const normalizedQuery = query.toLowerCase().trim();
  const filtered = searchIndex
    .filter(({ text }) => text.includes(normalizedQuery))
    .map(({ part }) => part);
  const categories = [...new Set(filtered.map((part) => part.category))];
  const toggle = (name: string, items: string[], update: (items: string[]) => void) =>
    update(items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  return (
    <aside className="catalog">
      <div className="panel-label">
        <span>PART LIBRARY</span>
        <span className="count-label">{parts.length}</span>
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
          placeholder="Search parts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>
      <div className="catalog-scroll">
        <div className="library-heading">
          <Box size={15} />
          <span>All components</span>
          <span>{parts.length}</span>
        </div>
        {query && (
          <div className="search-count">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'} found
          </div>
        )}
        {categories.map((category) => {
          const items = filtered.filter((part) => part.category === category);
          const open = expanded.includes(category) || !!query;
          return (
            <div className="category" key={category}>
              <button
                className={`category-button ${selected.category === category ? 'current-category' : ''}`}
                onClick={() => toggle(category, expanded, setExpanded)}
                aria-expanded={open}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <PartIcon type={items[0].icon} size={17} />
                <span>{category}</span>
                <small>{parts.filter((part) => part.category === category).length}</small>
              </button>
              {open && (
                <div className="category-content">
                  {[...new Set(items.map((part) => part.subgroup))].map((subgroup) => {
                    const groupOpen = subgroups.includes(subgroup) || !!query;
                    return (
                      <div key={subgroup} className="subgroup">
                        <button
                          className="subgroup-button"
                          onClick={() => toggle(subgroup, subgroups, setSubgroups)}
                          aria-expanded={groupOpen}
                        >
                          {groupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>{subgroup}</span>
                        </button>
                        {groupOpen &&
                          items
                            .filter((part) => part.subgroup === subgroup)
                            .map((part) => (
                              <button
                                key={part.id}
                                className={`part-button ${selected.id === part.id ? 'selected' : ''}`}
                                onClick={() => {
                                  onSelect(part);
                                  onClose();
                                }}
                                aria-current={selected.id === part.id ? 'true' : undefined}
                              >
                                <span className="tree-point" />
                                <span>{part.name}</span>
                                {part.id === selected.id && <span className="selected-indicator" />}
                              </button>
                            ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <div className="empty-catalog">
            <Search size={24} />
            <strong>No matching parts</strong>
            <p>Try “spring”, “bolt” or a bearing size.</p>
            <button className="text-button" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )}
      </div>
      <div className="catalog-footer">
        <div>
          <FolderOpen size={18} />
          <strong>A library that grows with you.</strong>
        </div>
        <p>One module. Endless possibilities.</p>
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
