import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { libraryAreas, libraryArea, libraryNavigationGroups } from '../src/core/library-navigation';
import { librarySections } from '../src/core/library';
import Catalog from '../src/components/Catalog';

const entries = groupBrowseFamilies(parts);
const part = (id: string) => parts.find((entry) => entry.id === id)!;

test('the six collections cover every browse family once and are independent of package order', () => {
  const groups = libraryAreas.map((area) =>
    entries.filter((entry) => libraryArea(entry.category) === area.id),
  );
  assert.ok(groups.every((group) => group.length));
  assert.equal(groups.flat().length, entries.length);
  assert.equal(new Set(groups.flat().map((entry) => entry.id)).size, entries.length);
  assert.deepEqual(groupBrowseFamilies([...parts].reverse()), entries);
  for (const definition of parts) {
    const section = librarySections.find((section) => section.name === definition.category);
    assert.ok(section, definition.id);
    assert.ok(section.groups.includes(definition.subgroup), definition.id);
  }
});

test('complete machines share one collection while their reusable components stay by function', () => {
  assert.deepEqual(
    entries
      .filter((entry) => libraryArea(entry.category) === 'machines')
      .map((entry) => entry.primary.id)
      .sort(),
    ['automatic-band-saw', 'automatic-tube-saw', 'cnc-milling-machine'],
  );
  for (const [id, area] of Object.entries({
    'cnc-guide-rail': 'motion',
    'cnc-precision-screw': 'motion',
    'cnc-feed-servo': 'motion',
    'machine-drive-motor': 'motion',
    'cnc-spindle-mount': 'hardware',
    'machine-control': 'electronics',
  })) {
    assert.equal(libraryArea(part(id).category), area, id);
  }
  assert.ok(
    librarySections.every((section) => section.groups.every((group) => !/\bCNC\b/.test(group))),
  );
});

test('workshop tools include fixtures, cutting tools, toolsetting and coolant rather than separate machine categories', () => {
  for (const id of [
    'tube-drill-jig',
    'drill-pattern-jig',
    'edge-dowel-jig',
    'router-template',
    'manual-miter-guide',
    'circular-saw-blade',
    'cnc-toolsetter-part',
    'cnc-process-accessory',
  ]) {
    assert.equal(libraryArea(part(id).category), 'workshop', id);
  }
  assert.equal(libraryArea(part('model-rocket-airframe').category), 'vehicles');
});

test('all alternate views retain scoped families and supplier identities without leaking other collections', () => {
  for (const area of libraryAreas) {
    const scoped = entries.filter((entry) => libraryArea(entry.category) === area.id);
    for (const view of ['engineering', 'product-kind', 'supply', 'process'] as const) {
      const groups = libraryNavigationGroups(scoped, view);
      assert.deepEqual(
        [...new Set(groups.flatMap((group) => group.entries.map((entry) => entry.id)))].sort(),
        scoped.map((entry) => entry.id).sort(),
        `${area.id}/${view}`,
      );
      for (const entry of groups.flatMap((group) => group.entries)) {
        assert.ok(scoped.includes(entry));
        assert.strictEqual(entry.primary, part(entry.primary.id));
      }
    }
  }
});

function render(selectedId: string, query = '') {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts,
        selected: part(selectedId),
        query,
        onSelect() {},
        onClose() {},
        onQueryChange() {},
      }),
    );
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('global search produces a flat list with locations and no forced-open folder tree', () => {
  const html = render('cnc-guide-rail', 'jig');
  assert.match(html, /Search all collections/);
  assert.match(html, /Tube drilling jig with end stop/);
  assert.match(html, /Workshop tools › Drilling jigs/);
  assert.ok(!html.includes('class="category-button'));
  assert.ok(!html.includes('class="subgroup-button'));
});

test('machine and workshop browsing skip their redundant category layer and singleton folders', () => {
  const machines = render('automatic-band-saw');
  assert.ok(!machines.includes('class="category-button'));
  assert.match(machines, /CNC milling machines/);

  const workshop = render('tube-drill-jig');
  assert.ok(!workshop.includes('class="category-button'));
  assert.match(workshop, /Drilling jigs/);
  assert.match(workshop, /Circular saw blade/);
  assert.ok(!workshop.includes('aria-expanded="false"><span>Saw blades'));
});

test('functional collections split components by use and retain imported categories visibly', () => {
  assert.deepEqual(
    libraryAreas.map((area) => area.id),
    ['hardware', 'motion', 'electronics', 'workshop', 'machines', 'vehicles'],
  );
  const routes = {
    hardware: ['STRUCTURAL PARTS', 'FASTENERS & THREADS', 'SPRINGS'],
    motion: [
      'BEARINGS & SEALS',
      'LINEAR MOTION',
      'TRANSMISSION & LINKAGES',
      'MOTORS & ACTUATORS',
      'PNEUMATICS & GAS',
    ],
    electronics: [
      'SWITCHES & BUTTONS',
      'POWER & MOTOR CONTROL',
      'ELECTRONICS & VISION',
      'CONNECTORS & INTERFACES',
    ],
    workshop: ['WORKSHOP TOOLS'],
    machines: ['MACHINE TOOLS'],
    vehicles: ['VEHICLE STRUCTURES'],
  };
  const routedCategories = Object.values(routes).flat();
  assert.equal(new Set(routedCategories).size, librarySections.length);
  assert.deepEqual(
    [...routedCategories].sort(),
    librarySections.map((section) => section.name).sort(),
  );
  for (const [area, categories] of Object.entries(routes))
    for (const category of categories) assert.equal(libraryArea(category), area, category);
  assert.equal(libraryArea('Imported custom components'), 'hardware');
  assert.equal(libraryArea('constructor'), 'hardware');
  assert.ok(libraryAreas.every((area) => area.description.length > 10));
});

test('switches lead Electronics with control families and their servo actuator directly accessible', () => {
  const groups = libraryNavigationGroups(
    entries.filter((entry) => libraryArea(entry.category) === 'electronics'),
    'engineering',
  );
  assert.equal(groups[0].id, 'SWITCHES & BUTTONS');
  assert.equal(groups[0].label, 'Switches & buttons');
  assert.deepEqual(
    groups[0].entries.map((entry) => entry.primary.id),
    ['panel-switch', 'panel-control', 'servo-toggle-actuator'],
  );
  assert.equal(part('panel-switch').name, 'Toggle switches & buttons');
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify([JSON.stringify(['electronics', 'engineering', 'SWITCHES & BUTTONS'])]),
    },
  });
  try {
    const html = render('panel-switch');
    assert.match(html, /<span>Toggle switches &amp; buttons<\/span>/);
    assert.match(html, /<span>Panel button, knob and beacon<\/span>/);
    assert.match(html, /<span>Servo toggle actuator<\/span>/);
    assert.doesNotMatch(html, /class="subgroup-button"/);
  } finally {
    if (previousSession) Object.defineProperty(globalThis, 'sessionStorage', previousSession);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
  const search = render('panel-switch', 'toggle');
  assert.match(search, /Switches &amp; buttons › Panel controls/);
});
