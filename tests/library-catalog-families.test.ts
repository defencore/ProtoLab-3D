import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalog from '../src/components/Catalog';
import { groupBrowseFamilies, familyMembers } from '../src/core/browse-families';
import { libraryCatalogFamily, libraryCatalogGroups } from '../src/core/library';
import { libraryNavigationGroups } from '../src/core/library-navigation';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { catalogValue } from '../src/core/catalog-models';
import {
  configureProduct,
  createProject,
  addProduct,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import { presetBrowserScope, presetBrowserSelection } from '../src/core/preset-browser';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
} from '../src/core/preset-search';
import type { PartDefinition, Preset } from '../src/core/types';
import { parts } from '../src/parts';
import nativeHS from '../src/parts/servo-motor/lib/waveshare/native.json';
import nativeBus from '../src/core/assembly/recovery/st3215-native.json';

register(
  `data:text/javascript,${encodeURIComponent(`
  export async function load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
    return nextLoad(url, context);
  }
`)}`,
  import.meta.url,
);
const { default: CatalogModelPicker } = await import('../src/components/CatalogModelPicker');

const curated = parts.filter((part) => libraryCatalogFamily(part.id));
const originals = new Map<string, PartDefinition>(
  await Promise.all(
    curated.map(
      async (part) =>
        [
          part.id,
          (await import(`../src/parts/${part.id}/part`)).default as PartDefinition,
        ] as const,
    ),
  ),
);
const byId = (id: string) => {
  const part = parts.find((candidate) => candidate.id === id);
  assert.ok(part, id);
  return part;
};
const servo = byId('servo-motor');
const busServo = byId('bus-servo');
const feedServo = byId('cnc-feed-servo');
const servoFamily = familyMembers(parts, servo);
const hs = servo.presets.find((preset) => preset.id === 'waveshare-st3215-hs')!;
const bus = busServo.presets.find((preset) => preset.id === 'waveshare-st3215-12v')!;

test('catalog grouping retains the complete physical library and every original source model', () => {
  assert.ok(parts.length >= 298, 'catalog grouping retains the reviewed library baseline');
  assert.ok(
    parts.reduce((count, part) => count + part.presets.length, 0) >= 19870,
    'new mechanisms may add presets without replacing the reviewed source models',
  );
  assert.equal(new Set(parts.map((part) => part.id)).size, parts.length);
  for (const part of curated) {
    const original = originals.get(part.id)!;
    assert.equal(part.id, original.id);
    assert.equal(part.name, original.name);
    for (const key of [
      'product',
      'defaults',
      'parameters',
      'presets',
      'catalogFilterFields',
      'states',
      'buildGeometry',
      'python',
      'dimensions',
      'composition',
      'fabricationFiles',
    ] as const)
      assert.equal(part[key], original[key], `${part.id}: original ${key}`);
  }
});

test('every curated catalog has exactly its declared members, one primary and consistent engineering classification', () => {
  const used = new Set<string>();
  for (const catalog of libraryCatalogGroups) {
    const members = parts.filter((part) => part.browseFamily?.id === catalog.id);
    assert.deepEqual(
      members.map((part) => part.id).sort(),
      [...catalog.members].sort(),
      catalog.id,
    );
    assert.deepEqual(
      members.filter((part) => part.browseFamily?.primary).map((part) => part.id),
      [catalog.members[0]],
    );
    for (const part of members) {
      assert.ok(
        !used.has(part.id),
        `${part.id}: a physical definition belongs to one curated catalog`,
      );
      used.add(part.id);
      assert.equal(part.category, members[0].category);
      assert.equal(part.subgroup, members[0].subgroup);
      assert.deepEqual(part.browseFamily, libraryCatalogFamily(part.id));
    }
    const grouped = groupBrowseFamilies(members);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].primary.id, catalog.members[0]);
    assert.equal(grouped[0].label, catalog.label);
  }
  assert.equal(used.size, curated.length);
  for (const id of [
    'bus-servo-driver',
    'servo-toggle-actuator',
    'rocket-release',
    'manufactured-detail',
    'unknown-model',
  ])
    assert.equal(
      libraryCatalogFamily(id),
      undefined,
      `${id}: unrelated products are not automatically merged`,
    );
  const descriptor = libraryCatalogFamily(servo.id)!;
  descriptor.label = 'Modified by a caller';
  assert.notEqual(
    libraryCatalogFamily(servo.id)!.label,
    descriptor.label,
    'metadata lookup cannot mutate the shared catalog declaration',
  );
});

function sidebarHtml(definitions: PartDefinition[], selected: PartDefinition): string {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'engineering' },
  });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts: definitions,
        selected,
        query: '',
        onQueryChange: () => {},
        onSelect: () => {},
        onClose: () => {},
      }),
    );
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('motor, camera and bearing catalogs each have one sidebar row for every physical member', () => {
  for (const id of ['servo-motor', 'bldc-motor', 'camera', 'ball-bearing']) {
    const primary = byId(id);
    const members = familyMembers(parts, primary);
    assert.ok(members.length > 1, id);
    for (const selected of [members[0], members.at(-1)!]) {
      const html = sidebarHtml(members, selected);
      assert.equal((html.match(/class="part-button selected"/g) ?? []).length, 1, selected.id);
      assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1, selected.id);
      assert.match(html, /class="count-label">1<\/span>/);
    }
  }
});

test('the servo catalog keeps nineteen qualified models including two distinct ST3215 supplier executions', () => {
  assert.deepEqual(servoFamily.map((part) => part.id).sort(), [
    'bus-servo',
    'cnc-feed-servo',
    'qfs2025-servo',
    'servo-motor',
  ]);
  const index = buildPresetIndex(servoFamily);
  assert.equal(index.length, 19);
  assert.equal(new Set(index.map((entry) => entry.id)).size, 19);
  assert.ok(index.every((entry) => entry.id === `${entry.part.id}:${entry.preset.id}`));
  assert.equal(hs.name, 'Waveshare ST3215-HS');
  assert.equal(bus.name, 'Waveshare ST3215 12 V');
  assert.equal(hs.parameters.model, 'waveshare-st3215-hs');
  assert.equal(bus.parameters.model, 'st3215-12v');
  assert.notEqual(hs.catalog?.sourceUrl, bus.catalog?.sourceUrl);
  assert.equal(
    nativeHS.sourceSha256,
    '58e38e4dc49f97df738c5f229f9aa8a7dce64a0a1d01335486a52d53e6017e8a',
  );
  assert.equal(nativeHS.sourceSha256, nativeBus.sourceSha256);
  assert.equal(nativeHS.components.length, 8);
  assert.equal(
    nativeBus.components.length,
    9,
    'the 12 V unit retains its original output-retaining screw',
  );
  assert.ok(Object.hasOwn(hs.parameters, 'hornStyle'));
  assert.ok(Object.hasOwn(bus.parameters, 'hornMount'));
  assert.ok(!Object.hasOwn(bus.parameters, 'hornStyle'));
  for (const part of [servo, busServo, feedServo])
    for (const preset of part.presets) {
      const configured = configureProduct({
        part,
        parameters: preset.parameters,
        state: part.states?.[0]?.id ?? 'default',
        presetId: preset.id,
      });
      assert.equal(configured.libraryId, part.id);
      assert.equal(configured.name, preset.name);
      assert.equal(configured.procurement?.source, preset.catalog?.sourceUrl);
      assert.equal(configured.supply, 'purchased');
    }
});

test('ST3215 filtering uses each source publication without borrowing the HS ratings for the 12 V row', () => {
  const index = buildPresetIndex(servoFamily);
  const filters = emptyPresetFilters(servo);
  assert.equal(filterPresets(index, filters).items.length, 19);
  assert.deepEqual(
    filterPresets(index, { ...filters, query: 'ST3215' })
      .items.map((entry) => entry.id)
      .sort(),
    ['bus-servo:waveshare-st3215-12v', 'servo-motor:waveshare-st3215-hs'],
  );
  assert.deepEqual(
    filterPresets(index, { ...filters, query: 'ST3215-HS' }).items.map((entry) => entry.id),
    ['servo-motor:waveshare-st3215-hs'],
  );
  assert.deepEqual(
    filterPresets(index, { ...filters, query: 'ST3215 retaining screw' }).items.map(
      (entry) => entry.id,
    ),
    ['bus-servo:waveshare-st3215-12v'],
  );
  for (const key of ['stallTorque', 'noLoadCurrent', 'stallCurrent', 'referenceVoltage'])
    assert.equal(catalogValue(bus, key), undefined, key);
  assert.equal(catalogValue(hs, 'stallTorque'), 20);
  assert.equal(catalogValue(hs, 'noLoadCurrent'), 0.24);
  const torque = servo.catalogFilterFields!.find((field) => field.key === 'stallTorque')!;
  const current = servo.catalogFilterFields!.find((field) => field.key === 'noLoadCurrent')!;
  for (const field of [torque, current]) {
    const result = filterPresets(index, {
      ...filters,
      parameters: { [fieldId(field)]: { min: '0' } },
    });
    assert.deepEqual(result.errors, []);
    assert.ok(result.items.length > 0);
    assert.ok(
      result.items.every((entry) => entry.part.id === servo.id),
      'only the source that publishes this characteristic may match',
    );
    assert.ok(!result.items.some((entry) => entry.part.id === busServo.id));
  }
});

test('same-named numeric characteristics in different units remain independent within a shared model picker', () => {
  const torque = servo.catalogFilterFields!.find((field) => field.key === 'stallTorque')!;
  const metric: PartDefinition = { ...servo, presets: [hs] };
  const newtonMetres: PartDefinition = {
    ...servo,
    id: 'servo-newton-metres-fixture',
    catalogFilterFields: servo.catalogFilterFields!.map((field) =>
      field.key === torque.key ? { ...field, unit: 'N·m' } : field,
    ),
    presets: [
      {
        ...hs,
        catalog: { ...hs.catalog!, attributes: { ...hs.catalog!.attributes, stallTorque: 20 } },
      },
    ],
  };
  const index = buildPresetIndex([metric, newtonMetres, busServo]);
  const fields = getFilterFields([metric, newtonMetres, busServo]).filter(
    (field) => field.key === torque.key,
  );
  assert.equal(fields.length, 2);
  assert.equal(new Set(fields.map((field) => field.id)).size, 2);
  const filters = emptyPresetFilters(servo);
  const selected = (id: string) =>
    filterPresets(index, { ...filters, parameters: { [id]: { min: '20', max: '20' } } });
  assert.deepEqual(
    selected(fieldId(torque)).items.map((entry) => entry.part.id),
    [servo.id],
  );
  assert.deepEqual(
    selected(fieldId({ ...torque, unit: 'N·m' })).items.map((entry) => entry.part.id),
    [newtonMetres.id],
  );
  assert.equal(
    filterPresets(index, { ...filters, parameters: { [fieldId(torque)]: { min: '20.01' } } }).items
      .length,
    0,
  );
});

test('library search forwards a real model query and rejects facts split across different supplier rows', () => {
  for (const selected of [servo, byId('camera'), byId('li-ion-cell')]) {
    const members = familyMembers(parts, selected);
    const index = buildLibrarySearchIndex(groupBrowseFamilies(members));
    const preset = selected.presets.find((entry) => entry.catalog?.designation)!;
    const query = preset.catalog!.designation;
    const matches = searchLibrary(index, query);
    assert.equal(matches.length, 1, query);
    assert.equal(matches[0].articleQuery, query);
    const rows = filterPresets(buildPresetIndex(members), {
      ...emptyPresetFilters(selected),
      query,
    }).items;
    assert.ok(rows.some((entry) => entry.part.id === selected.id && entry.preset.id === preset.id));
  }
  const servoIndex = buildLibrarySearchIndex(groupBrowseFamilies(servoFamily));
  assert.equal(searchLibrary(servoIndex, 'ST3215').length, 1);
  for (const query of ['ST3215 Delta', 'ST3215 brake', 'Waveshare C20807SS1'])
    assert.deepEqual(
      searchLibrary(servoIndex, query).map((match) => match.family.id),
      [],
      query,
    );
});

test('references remain explicit alongside purchased catalog executions', () => {
  const reference = byId('industrial-motor');
  const members = familyMembers(parts, reference);
  assert.equal(reference.product.kind, 'reference');
  assert.equal(reference.product.supply, 'reference');
  assert.ok(members.some((part) => part.product.supply === 'purchased'));
  const navigation = libraryNavigationGroups(groupBrowseFamilies(members), 'supply');
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0].id, 'mixed-families');
  const index = buildPresetIndex(members);
  const all = filterPresets(index, emptyPresetFilters(reference));
  assert.equal(
    all.items.length,
    members.reduce((count, part) => count + part.presets.length, 0),
  );
  assert.ok(all.items.some((entry) => entry.part.id === reference.id));
  const examples = filterPresets(index, { ...emptyPresetFilters(reference), kind: 'examples' });
  assert.ok(examples.items.some((entry) => entry.part.id === reference.id));
  assert.ok(examples.items.every((entry) => !entry.preset.catalog));
});

function pickerHtml(
  definitions: PartDefinition[],
  selected: PartDefinition,
  preset: Preset,
  query = '',
): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      React.createElement(CatalogModelPicker, {
        parts: definitions,
        part: selected,
        parameters: preset.parameters,
        presetId: preset.id,
        initialQuery: query,
        onQueryChange: () => {},
        onSelect: () => {},
        onSelectPart: () => {},
      }),
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}
const cards = (html: string) =>
  [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter((match) =>
    /class="[^"]*\bcatalog-model-result\b/.test(match[1]),
  );

test('the grouped model picker renders all nineteen servo titles and both ST3215 rows', () => {
  const all = cards(pickerHtml(servoFamily, servo, hs));
  assert.equal(all.length, 19);
  for (const part of servoFamily)
    for (const preset of part.presets)
      assert.ok(
        all.some((card) => card[2].includes(`<strong>${preset.name}</strong>`)),
        preset.name,
      );
  const st3215 = cards(pickerHtml(servoFamily, servo, hs, 'ST3215'));
  assert.equal(st3215.length, 2);
  const busCard = st3215.find((card) => card[2].includes(`<strong>${bus.name}</strong>`))!;
  assert.ok(busCard);
  assert.ok(!busCard[2].includes('20 kgf'));
  assert.ok(!busCard[2].includes('0.24 A'));
});

test('equal preset IDs in different physical parts cannot select or pin the wrong supplier model', () => {
  const duplicateId = { ...busServo, presets: [{ ...bus, id: hs.id }] };
  const definitions = [{ ...servo, presets: [hs] }, duplicateId];
  const index = buildPresetIndex(definitions);
  assert.equal(index.length, 2);
  assert.notEqual(index[0].id, index[1].id);
  const selected = presetBrowserSelection(index, [index[0]], duplicateId, bus.parameters, hs.id);
  assert.equal(selected.selected?.part.id, busServo.id);
  assert.equal(selected.selectedOutsideResults, true);
  const chosen = cards(pickerHtml(definitions, duplicateId, duplicateId.presets[0])).filter(
    (card) => card[1].includes('aria-pressed="true"'),
  );
  assert.equal(chosen.length, 1);
  assert.ok(chosen[0][2].includes(`<strong>${bus.name}</strong>`));
});

test('cross-catalog project persistence retains exact physical library, model and supplier identities', () => {
  let project = createProject('Grouped supplier models');
  for (const part of [servo, busServo, feedServo]) {
    const preset = part.presets[0];
    project = addProduct(project, parts, {
      part,
      parameters: preset.parameters,
      state: part.states?.[0]?.id ?? 'default',
      presetId: preset.id,
    }).project;
    const configuration = project.configurations.find((item) => item.libraryId === part.id)!;
    assert.equal(configuration.presetId, preset.id);
    assert.equal(configuration.name, preset.name);
    assert.deepEqual(configuration.parameters, preset.parameters);
    assert.equal(configuration.procurement?.source, preset.catalog?.sourceUrl);
  }
  assert.equal(project.configurations.length, 3, 'purchased servos stay opaque supplier units');
  const encoded = serializeProject(project, parts);
  const decoded = parseProject(encoded, parts);
  assert.equal(serializeProject(decoded, parts), encoded);
  assert.deepEqual(decoded.configurations.map((item) => item.libraryId).sort(), [
    'bus-servo',
    'cnc-feed-servo',
    'servo-motor',
  ]);
  assert.equal(presetBrowserScope(parts, servo.category, 'servo-motors').scopeParts.length, 4);
});
