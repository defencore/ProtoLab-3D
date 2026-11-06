import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalog from '../src/components/Catalog';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { eskdIdentity } from '../src/core/eskd';
import { familyLabel } from '../src/core/library-labels';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { registerPartModules, type PartModule } from '../src/core/part-modules';
import type { PartDefinition } from '../src/core/types';
import { parts } from '../src/parts';

const definition = (id: string) => parts.find((part) => part.id === id)!;
const labels = {
  'worm-fin-actuator': 'Worm-sector actuator',
  'servo-toggle-actuator': 'Servo toggle actuator',
  'ball-screw-axis': 'Ball screw axis',
  'bevel-gearbox-42': 'Bevel gearbox',
  'underwater-thruster': 'Underwater thruster',
  'mpr-10-demonstrator': 'Mechanism demonstrator',
  'handheld-lora-controller': 'Handheld LoRa controller',
};

test('standalone assembly navigation names types while detailed constructions remain inside', () => {
  for (const [id, label] of Object.entries(labels)) {
    const part: PartDefinition = { ...definition(id), browseFamily: undefined };
    assert.equal(familyLabel(part), label, id);
    const entry = groupBrowseFamilies([part])[0];
    assert.equal(entry.label, label, id);
    assert.equal(entry.id, id, id);
    assert.equal(entry.grouped, false, id);
    assert.strictEqual(entry.primary, part, id);
    assert.deepEqual(entry.members, [part], id);
  }
  assert.match(definition('worm-fin-actuator').name, /TR8×8\(P2\)/);
  assert.match(definition('servo-toggle-actuator').name, /ST3215.*ASW-07D/);
  assert.ok(
    definition('worm-fin-actuator').presets.every((preset) => preset.name.includes('TR8×8(P2)')),
  );
});

test('standalone navigation labels are optional, nonempty and trimmed', () => {
  const part = definition('worm-fin-actuator');
  const module: PartModule = { apiVersion: 2, order: 1, part };
  assert.equal(registerPartModules([module]).length, 1);
  assert.equal(
    registerPartModules([{ ...module, part: { ...part, browseLabel: undefined } }]).length,
    1,
  );
  for (const value of ['', ' ', ' Worm-sector actuator ', 42, null])
    assert.throws(
      () =>
        registerPartModules([
          {
            ...module,
            part: { ...part, browseLabel: value as PartDefinition['browseLabel'] },
          },
        ]),
      /Browse label/,
    );
});

test('generic navigation still finds actual screws and installed components', () => {
  const definitions = [definition('worm-fin-actuator'), definition('servo-toggle-actuator')];
  const index = buildLibrarySearchIndex(groupBrowseFamilies(definitions));
  for (const [query, id, label] of [
    ['TR8x8', 'worm-fin-actuator', 'Worm-sector actuator'],
    ['F6802ZZ', 'worm-fin-actuator', 'Worm-sector actuator'],
    ['ST3215 ASW-07D', 'servo-toggle-actuator', 'Servo toggle actuator'],
  ]) {
    const match = searchLibrary(index, query).find((item) => item.family.id === id);
    assert.ok(match, query);
    assert.equal(match.family.label, label, query);
    assert.strictEqual(match.family.primary, definition(id), query);
  }
});

test('rendered library rows use generic labels in browsing and component search', () => {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    const part = definition('worm-fin-actuator');
    for (const query of ['', 'TR8x8']) {
      const html = renderToStaticMarkup(
        React.createElement(Catalog, {
          parts: [part],
          selected: part,
          query,
          onSelect() {},
          onClose() {},
          onQueryChange() {},
        }),
      );
      assert.match(html, /<span>Worm-sector actuator<\/span>/, query);
      assert.doesNotMatch(html, /<span>TR8×8\(P2\) worm-sector actuator<\/span>/, query);
      assert.match(html, /aria-current="true"/, query);
    }
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});

test('navigation labels do not change configurations, CAD identity or physical factories', () => {
  for (const id of Object.keys(labels)) {
    const part = definition(id);
    const physical: PartDefinition = { ...part, browseLabel: undefined };
    assert.equal(part.name, physical.name, id);
    assert.strictEqual(part.presets, physical.presets, id);
    assert.strictEqual(part.defaults, physical.defaults, id);
    assert.strictEqual(part.buildGeometry, physical.buildGeometry, id);
    assert.strictEqual(part.python, physical.python, id);
    assert.strictEqual(part.composition, physical.composition, id);
    const state = part.states?.[0]?.id ?? 'default';
    assert.deepEqual(
      eskdIdentity(part, part.defaults, state),
      eskdIdentity(physical, physical.defaults, state),
      id,
    );
  }
});
