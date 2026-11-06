import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
import LibraryIdentity, { LibraryId } from '../src/components/LibraryIdentity';
import type { Parameters, PartDefinition } from '../src/core/types';
import jaw from '../src/parts/jaw-coupling/part';
import { parts } from '../src/parts';
import { defaultPartSelection } from '../src/core/part-selection';
import { libraryEntryId } from '../src/core/library-identity';
import { configurationLink } from '../src/core/configuration-link';
import type { AssemblyComponent } from '../src/core/product-types';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url,
);
const { default: App } = await import('../src/App');
const { default: Configurator } = await import('../src/components/Configurator');
const { default: AssemblyStructurePanel } =
  await import('../src/components/AssemblyStructurePanel');

const fixture: PartDefinition = {
  ...jaw,
  id: 'physical-coupling',
  browseFamily: { id: 'grouped-couplings', label: 'Couplings' },
  parameters: [{ key: 'length', type: 'number', label: 'Length', group: 'Dimensions' }],
  defaults: { length: 20 },
  presets: [
    { id: 'length-20', name: '20 mm coupling', description: 'Fixture', parameters: { length: 20 } },
  ],
};

function renderNode(node: React.ReactNode) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(node);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

function render(parameters: Parameters, presetId: string, part = fixture) {
  return renderNode(
    React.createElement(LibraryIdentity, {
      part,
      parameters,
      presetId,
      configurationKey: 'CONFIGURATION-FINGERPRINT',
    }),
  );
}

test('the workspace displays its copyable ID immediately below the title outside the mobile-hidden panel', () => {
  const html = renderNode(React.createElement(App));
  const heading = html.indexOf('<div class="part-heading">');
  const titleEnd = html.indexOf('</h1>', heading) + '</h1>'.length;
  const strip = html.indexOf('<div class="library-id-strip"', titleEnd);
  const description = html.indexOf('<p>', titleEnd);
  const panel = html.indexOf('class="config-wrapper');
  assert.ok(heading >= 0 && titleEnd > heading);
  assert.equal(strip, titleEnd, 'Library ID must follow the title without other content.');
  assert.ok(strip < description && strip < panel, 'ID must be outside the settings panel.');
  const initial = parts.find((part) => part.defaultSelection) ?? parts[0];
  const selected = defaultPartSelection(initial);
  const confirmed = initial.presets.find((preset) => preset.id === selected.presetId);
  const id = libraryEntryId(initial.id, confirmed?.id);
  const stripHtml = html.slice(strip, description);
  assert.ok(stripHtml.includes(`title="${id}"`));
  assert.match(stripHtml, /aria-label="Copy ID"/);
  assert.match(stripHtml, /<span>Copy ID<\/span>/);
});

test('the compact ID uses the confirmed model or physical family for a custom configuration', () => {
  const selected = renderNode(
    React.createElement(LibraryId, {
      part: fixture,
      parameters: { length: 20 },
      presetId: 'length-20',
    }),
  );
  assert.match(selected, /<code[^>]*>physical-coupling:length-20<\/code>/);
  assert.match(selected, /aria-label="Copy ID"/);
  const custom = renderNode(
    React.createElement(LibraryId, {
      part: fixture,
      parameters: { length: 21 },
      presetId: 'length-20',
    }),
  );
  assert.match(custom, /<code[^>]*>physical-coupling<\/code>/);
  assert.doesNotMatch(custom, /physical-coupling:length-20|grouped-couplings/);
});

test('detailed library metadata precedes model choosers in the settings panel', () => {
  const noop = () => {};
  const html = renderNode(
    React.createElement(Configurator, {
      part: fixture,
      familyParts: [fixture],
      browseQuery: { query: '', revision: 0 },
      parameters: fixture.defaults,
      modelState: 'default',
      presetId: 'length-20',
      errors: [],
      onBrowseQueryChange: noop,
      onChange: noop,
      onState: noop,
      onBrowse: noop,
      onFindMatching: noop,
      onReset: noop,
      onSave: noop,
      onPreset: noop,
      onSelectPart: noop,
      onSelectModel: noop,
    }),
  );
  assert.match(html, /<div class="config-scroll"><section class="library-identity"/);
  assert.ok(html.indexOf('aria-label="Library identity"') < html.indexOf('class="preset-section"'));
});

test('element metadata exposes the physical family and qualified model IDs as copyable values', () => {
  const html = render({ length: 20 }, 'length-20');
  assert.match(html, /aria-label="Family ID"[^>]*readOnly=""[^>]*value="physical-coupling"/);
  assert.match(html, /aria-label="Model ID"[^>]*value="physical-coupling:length-20"/);
  assert.match(html, /aria-label="Copy family id"/);
  assert.match(html, /aria-label="Copy model id"/);
  assert.match(html, /aria-label="Configuration key"[^>]*value="CONFIGURATION-FINGERPRINT"/);
  assert.doesNotMatch(html, /grouped-couplings/);
});

test('custom and stale preset selections retain the family ID without claiming a model ID', () => {
  for (const html of [render({ length: 21 }, 'length-20'), render({ length: 20 }, 'custom')]) {
    assert.match(html, /value="physical-coupling"/);
    assert.match(html, /value="CONFIGURATION-FINGERPRINT"/);
    assert.doesNotMatch(html, /aria-label="Model ID"|physical-coupling:custom|length-20/);
  }
});

test('a fixed catalog model keeps its model ID when independent pose controls change', () => {
  const part: PartDefinition = {
    ...fixture,
    catalogSelectionOnly: true,
    parameters: [
      {
        key: 'model',
        type: 'select',
        label: 'Model',
        group: 'Selection',
        options: [{ value: 'a', label: 'A' }],
      },
      { key: 'angle', type: 'number', label: 'Angle', group: 'Operation', filterable: false },
    ],
    defaults: { model: 'a', angle: 0 },
    presets: [
      {
        id: 'supplier-a',
        name: 'Supplier A',
        description: 'Fixture',
        parameters: { model: 'a', angle: 0 },
        catalog: {
          designation: 'SUPPLIER-ORDER-CODE',
          sourceName: 'Supplier',
          sourceUrl: 'https://example.test/a',
          verifiedParameters: ['model'],
        },
      },
    ],
  };
  const html = render({ model: 'a', angle: 45 }, 'supplier-a', part);
  assert.match(html, /value="physical-coupling:supplier-a"/);
  assert.doesNotMatch(html, /SUPPLIER-ORDER-CODE/);
});

const linkedCarrier = parts.find((part) => part.id === 'compute-module-carrier')!;
const linkedPreset = linkedCarrier.presets.find(
  (preset) => preset.id === 'waveshare-cm5-io-base-a',
)!;
const linkedComponent: AssemblyComponent = {
  id: 'installed-carrier',
  libraryId: linkedCarrier.id,
  name: 'Installed carrier',
  parameters: { ...linkedPreset.parameters },
  state: 'assembled',
  presetId: linkedPreset.id,
  quantity: 2,
  supply: 'purchased',
  placement: { translation: [100, 200, 300], rotation: [0, 0, 90] },
};

function renderWithHash(node: React.ReactNode, hash: string): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { hash, href: 'https://example.org/ProtoLab-3D/' + hash } },
  });
  try {
    return renderNode(node);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

function workspaceIdentity(html: string): string {
  const start = html.indexOf('<div class="part-heading">');
  const end = html.indexOf('<div class="part-badges">', start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}

test('linked App startup retains the exact supplier preset or an explicitly unselected custom identity', () => {
  const confirmed = renderWithHash(React.createElement(App), configurationLink(linkedComponent));
  assert.ok(
    workspaceIdentity(confirmed).includes(`title="${linkedCarrier.id}:${linkedPreset.id}"`),
  );
  const custom = renderWithHash(
    React.createElement(App),
    configurationLink({ ...linkedComponent, presetId: undefined }),
  );
  const strip = workspaceIdentity(custom);
  assert.ok(strip.includes(`title="${linkedCarrier.id}"`));
  assert.ok(
    !strip.includes(`title="${linkedCarrier.id}:${linkedPreset.id}"`),
    'matching model parameters must not invent a supplier preset',
  );
  assert.ok(custom.includes('Custom'));
});

test('invalid configuration links show an error and retain a valid default workspace', () => {
  const html = renderWithHash(React.createElement(App), '#configuration=%');
  assert.ok(html.includes('The linked component could not be opened:'));
  assert.match(html, /class="toast toast--error"/);
  assert.ok(workspaceIdentity(html).includes('library-id-strip'));
});

test('Components renders a native new-tab link with its exact child configuration and source identity', () => {
  const components = Object.freeze([Object.freeze(linkedComponent)]);
  const before = structuredClone(components);
  const host: PartDefinition = {
    ...linkedCarrier,
    id: 'host-assembly',
    product: {
      ...linkedCarrier.product,
      kind: 'assembly',
      supply: 'manufactured',
      processes: ['assembly'],
    },
    composition: () => ({ components: [...components], issues: [] }),
  };
  const html = renderWithHash(
    React.createElement(AssemblyStructurePanel, {
      part: host,
      libraryParts: [host, linkedCarrier],
      parameters: host.defaults,
      selectedComponentId: linkedComponent.id,
      hiddenComponentIds: [linkedComponent.id],
    }),
    '#host',
  );
  const link = html.match(
    /<a\b[^>]*class="assembly-structure-icon assembly-structure-open"[^>]*>/,
  )?.[0];
  assert.ok(link);
  assert.ok(link.includes(`href="${configurationLink(linkedComponent)}"`));
  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noopener noreferrer"/);
  assert.ok(link.includes('(new tab)'));
  assert.deepEqual(components, before);
});

test('the hidden avionics tube remains a Reference row in Assembly components', () => {
  const avionics = parts.find((part) => part.id === 'modular-tube-avionics')!;
  for (const preset of avionics.presets) {
    const html = renderWithHash(
      React.createElement(App),
      configurationLink({
        ...linkedComponent,
        libraryId: avionics.id,
        presetId: preset.id,
        state: 'assembled',
        parameters: { ...preset.parameters, showTube: false },
      }),
    );
    assert.ok(workspaceIdentity(html).includes(`${avionics.id}:${preset.id}`));
    assert.match(html, /Show reference:[^"]*D16T cut tube/);
    assert.match(html, /assembly-structure-supply is-reference[^>]*>Reference/);
    assert.ok(
      !avionics.composition!(preset.parameters).components.some(
        ({ id }) => id === 'tube-reference',
      ),
    );
  }
});
