import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LibraryDiscoveryPanel, {
  type LibraryDiscoveryPanelProps,
} from '../src/components/LibraryDiscoveryPanel';
import type {
  DiscoveryCandidate,
  DiscoveryFilters,
  DiscoverySuggestion,
} from '../src/core/discovery-types';
import type { PartDefinition, Preset } from '../src/core/types';

const part = { id: 'fixture-axis', name: 'Fixture axis' } as PartDefinition;
const preset: Preset = {
  id: '12v-axis',
  name: 'Axis A · 12 V',
  description: 'A configured test fixture.',
  parameters: { width: 40 },
};
const candidate: DiscoveryCandidate = {
  id: 'fixture-axis:12v-axis',
  part,
  preset,
  family: {
    id: part.id,
    label: 'Linear axis',
    grouped: false,
    primary: part,
    members: [part],
    category: 'LINEAR MOTION',
    subgroup: 'LINEAR AXES',
    icon: 'rail',
  },
  entry: {
    id: 'fixture-axis:12v-axis',
    part,
    preset,
    searchText: 'axis a 12 v',
    compactName: 'axisa12v',
  },
  traits: [
    { kind: 'power', key: 'supply', label: 'Supply', value: '12 V DC' },
    { kind: 'bearing', key: 'bearing', label: 'Bearing', value: 'F686-2RS' },
    { kind: 'width', key: 'bodyWidth', label: 'Body width', value: 40, unit: 'mm' },
  ],
};
const suggestion: DiscoverySuggestion = {
  id: 'bearing-f686',
  kind: 'bearing',
  label: 'F686-2RS',
  detail: 'Bearing model',
  count: 2,
  filters: { bearing: 'F686-2RS' },
  query: '',
};
const emptyFilters = (): DiscoveryFilters => ({
  power: '',
  bearing: '',
  widthKind: '',
  width: { min: '', max: '' },
});
const props = (changes: Partial<LibraryDiscoveryPanelProps> = {}): LibraryDiscoveryPanelProps => ({
  query: '',
  filters: emptyFilters(),
  choices: { power: [], bearing: [], widthKind: [] },
  suggestions: [],
  candidates: [],
  total: 0,
  errors: [],
  expanded: false,
  onExpandedChange() {},
  onFiltersChange() {},
  onSuggestion() {},
  onSelect() {},
  suggestionListId: 'fixture-suggestions',
  ...changes,
});

function withReact<T>(run: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}
const render = (value: LibraryDiscoveryPanelProps) =>
  withReact(() => renderToStaticMarkup(React.createElement(LibraryDiscoveryPanel, value)));
type Interactive = React.ReactElement<Record<string, any>>;
function elements(value: LibraryDiscoveryPanelProps): Interactive[] {
  return withReact(() => {
    const result: Interactive[] = [];
    function visit(node: React.ReactNode) {
      if (!React.isValidElement(node)) return;
      const element = node as Interactive;
      if (typeof element.type === 'string') result.push(element);
      React.Children.forEach(element.props.children, visit);
    }
    visit(LibraryDiscoveryPanel(value));
    return result;
  });
}

test('discovery starts with a compact characteristic chooser and no automatic model choice', () => {
  let selected = false;
  const html = render(
    props({
      onSelect() {
        selected = true;
      },
    }),
  );
  assert.match(html, /Choose characteristics/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Matching configurations|No configuration matches/);
  assert.equal(selected, false);
});

test('characteristic controls retain decimal text, contextual counts and independently removable filters', () => {
  const filters: DiscoveryFilters = {
    power: '12v',
    bearing: 'F686-2RS',
    widthKind: 'bodyWidth',
    width: { min: '3,2', max: '40' },
  };
  const updates: DiscoveryFilters[] = [];
  const value = props({
    expanded: true,
    filters,
    onFiltersChange: (next) => updates.push(next),
    choices: {
      power: [
        { value: '12v', label: '12 V DC', count: 2 },
        { value: '24v', label: '24 V DC', count: 0 },
      ],
      bearing: [{ value: 'F686-2RS', label: 'F686-2RS', count: 0 }],
      widthKind: [{ value: 'bodyWidth', label: 'Body width', count: 2 }],
    },
  });
  const html = render(value);
  for (const label of [
    'Filter by power',
    'Filter by bearing',
    'Width meaning',
    'Minimum width',
    'Maximum width',
  ])
    assert.ok(html.includes(`aria-label="${label}"`), label);
  assert.match(html, /value="3,2"/);
  assert.match(html, /value="24v" disabled=""/);
  assert.doesNotMatch(html, /value="F686-2RS" disabled/);
  const nodes = elements(value);
  const removeBearing = nodes.find(
    (node) => node.props['aria-label'] === 'Remove Bearing: F686-2RS',
  )!;
  removeBearing.props.onClick();
  assert.deepEqual(updates.at(-1), { ...filters, bearing: '' });
  const minimum = nodes.find((node) => node.props['aria-label'] === 'Minimum width')!;
  minimum.props.onChange({ target: { value: '12,5' } });
  assert.deepEqual(updates.at(-1), { ...filters, width: { min: '12,5', max: '40' } });
  assert.equal(filters.width.min, '3,2');
});

test('suggestions remain selectable by their stable option IDs without moving search focus', () => {
  const chosen: DiscoverySuggestion[] = [];
  const value = props({
    query: 'F68',
    suggestions: [suggestion],
    activeSuggestion: 0,
    onSuggestion: (next) => chosen.push(next),
  });
  const html = render(value);
  assert.match(html, /role="listbox" aria-label="Search suggestions"/);
  assert.match(html, /role="option" id="fixture-suggestions-0" aria-selected="true"/);
  assert.match(html, /Bearing model/);
  assert.deepEqual(chosen, []);
  const option = elements(value).find((node) => node.props.role === 'option')!;
  let prevented = false;
  option.props.onMouseDown({
    preventDefault() {
      prevented = true;
    },
  });
  option.props.onClick();
  assert.equal(prevented, true);
  assert.deepEqual(chosen, [suggestion]);
});

test('matching cards expose exact variants and select only the explicitly clicked candidate', () => {
  const selected: DiscoveryCandidate[] = [];
  let more = 0;
  const value = props({
    query: '12 V',
    candidates: [candidate],
    total: 3,
    onSelect: (next) => selected.push(next),
    onShowMore: () => more++,
  });
  const html = render(value);
  assert.match(html, /Matching configurations/);
  assert.match(html, /Axis A · 12 V/);
  assert.match(html, /Linear axis · Prototype/);
  assert.match(html, /F686-2RS/);
  assert.match(html, /Body width/);
  assert.match(html, /Show more configurations · 1 of 3/);
  assert.deepEqual(selected, []);
  const nodes = elements(value);
  nodes.find((node) => node.props['aria-label'] === 'Preview Axis A · 12 V')!.props.onClick();
  nodes.find((node) => node.props.className === 'library-discovery-more')!.props.onClick();
  assert.deepEqual(selected, [candidate]);
  assert.equal(more, 1);
});

test('invalid ranges expose the error and suppress selectable configurations', () => {
  const html = render(
    props({
      expanded: true,
      query: 'axis',
      candidates: [candidate],
      total: 1,
      errors: ['Minimum width must not exceed maximum width.'],
    }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Minimum width must not exceed maximum width/);
  assert.match(html, /aria-invalid="true"/);
  assert.doesNotMatch(html, /aria-label="Preview Axis A/);
});
