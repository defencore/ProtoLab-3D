import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  familyId,
  familyLabel,
  familyMembers,
  groupBrowseFamilies,
} from '../src/core/browse-families';
import { groupProductLibrary, type ProductLibraryView } from '../src/core/product-library';
import { registerPartModules, type PartModule } from '../src/core/part-modules';
import type { PartDefinition } from '../src/core/types';
import Catalog from '../src/components/Catalog';
import pcb from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import sleeve from '../src/parts/dremec-spacer-sleeve/part';
import spacer from '../src/parts/spacer/part';

const members = [insert, spacer, sleeve, pcb];

test('shared navigation coalesces four constructions while retaining exact physical definitions and a declared primary', () => {
  const entries = groupBrowseFamilies(members);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'spacers-standoffs');
  assert.equal(entries[0].label, 'Spacers & standoffs');
  assert.equal(entries[0].primary, pcb);
  assert.equal(entries[0].grouped, true);
  for (const part of members) {
    assert.equal(familyId(part), 'spacers-standoffs');
    assert.equal(familyLabel(part), 'Spacers & standoffs');
    assert.ok(entries[0].members.includes(part));
    assert.deepEqual(familyMembers(members, part), entries[0].members);
  }
  assert.deepEqual(members, [insert, spacer, sleeve, pcb], 'input order remains unchanged');
  const independent: PartDefinition = {
    ...spacer,
    id: 'independent',
    name: 'Independent detail',
    browseFamily: undefined,
  };
  assert.equal(familyId(independent), independent.id);
  assert.equal(familyLabel(independent), independent.name);
  assert.equal(groupBrowseFamilies([...members, independent]).length, 2);
  assert.deepEqual(familyMembers([...members, independent], independent), [independent]);
  assert.equal(
    groupBrowseFamilies([insert])[0].primary,
    insert,
    'a portable subset needs no absent primary',
  );
});

test('physical classification and specification identities remain independent of browse grouping', () => {
  assert.equal(insert.product.kind, 'assembly');
  assert.equal(pcb.product.kind, 'detail');
  assert.equal(spacer.product.supply, 'manufactured');
  assert.equal(sleeve.product.supply, 'purchased');
  const groups = groupProductLibrary(members, 'product-kind');
  assert.equal(groups.find((group) => group.id === 'detail')!.parts.length, 3);
  assert.deepEqual(groups.find((group) => group.id === 'assembly')!.parts, [insert]);
  assert.equal(groups.flatMap((group) => group.parts).length, 4);
});

function module(id: string, browseFamily?: PartDefinition['browseFamily']): PartModule {
  return {
    apiVersion: 2,
    order: 1,
    part: { ...spacer, id, name: id, presets: [], browseFamily },
  };
}

test('module boundaries reject invalid or ambiguous navigation metadata and allow a partial family', () => {
  const family = { id: 'navigation-family', label: 'Navigation family' };
  assert.equal(registerPartModules([module('alpha', family)]).length, 1);
  assert.equal(
    registerPartModules([module('alpha', { ...family, primary: true }), module('beta', family)])
      .length,
    2,
  );
  for (const bad of [
    { ...family, id: 'Invalid_ID' },
    { ...family, label: ' ' },
    { ...family, primary: 'yes' },
    null,
    [],
  ])
    assert.throws(
      () => registerPartModules([module('alpha', bad as PartDefinition['browseFamily'])]),
      /Browse family requires/,
    );
  assert.throws(
    () =>
      registerPartModules([
        module('alpha', { ...family, primary: true }),
        module('beta', { ...family, primary: true }),
      ]),
    /more than one primary/,
  );
  assert.throws(
    () =>
      registerPartModules([
        module('alpha', family),
        module('beta', { ...family, label: 'Different label' }),
      ]),
    /inconsistent labels/,
  );
  const wrongSubgroup = module('beta', family);
  wrongSubgroup.part = { ...wrongSubgroup.part, subgroup: 'OTHER GROUP' };
  assert.throws(
    () => registerPartModules([module('alpha', family), wrongSubgroup]),
    /share its engineering category and subgroup/,
  );
  assert.throws(
    () => registerPartModules([module('alpha', { id: 'beta', label: 'Family' }), module('beta')]),
    /conflicts with an unrelated physical part/,
  );
});

function catalogHtml(selected: PartDefinition, view: ProductLibraryView, query = ''): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => view },
  });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts: members,
        selected,
        onSelect: () => {},
        onClose: () => {},
        query,
        onQueryChange: () => {},
      }),
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('engineering navigation has one direct family button and retains its marker for every physical member', () => {
  for (const selected of members) {
    const html = catalogHtml(selected, 'engineering');
    assert.equal((html.match(/Spacers &amp; standoffs/g) ?? []).length, 1);
    assert.equal((html.match(/class="part-button selected"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
    assert.ok(!html.includes('SPACERS &amp; STANDOFFS'), 'no redundant subgroup folder');
    assert.match(html, /class="count-label">1<\/span>/);
    for (const part of members) assert.ok(!html.includes(`>${part.name}<`));
  }
});

test('mixed product-kind, supply and process navigation lists the family once without misclassifying its primary', () => {
  for (const [view, label] of [
    ['product-kind', 'Multiple product types'],
    ['supply', 'Multiple supply policies'],
    ['process', 'Multiple manufacturing processes'],
  ] as const) {
    const html = catalogHtml(insert, view);
    assert.equal((html.match(/Spacers &amp; standoffs/g) ?? []).length, 1);
    assert.ok(html.includes(label));
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(html, /class="count-label">1<\/span>/);
  }
});

test('sidebar size and construction queries match one actual catalog item before coalescing the family', () => {
  for (const query of ['M3 10', 'brass M3 10', 'M3 ×10', 'metal insert', 'standoffs']) {
    const html = catalogHtml(insert, 'engineering', query);
    assert.equal((html.match(/<span>Spacers &amp; standoffs<\/span>/g) ?? []).length, 1, query);
    assert.match(html, /1 result found/, query);
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1, query);
    assert.ok(
      html.includes(`value="${query}"`),
      'the original query remains available to seed selection',
    );
  }
  const absent = catalogHtml(pcb, 'engineering', 'M3 999999');
  assert.ok(!absent.includes('Spacers &amp; standoffs'));
  assert.match(absent, /No matching parts/);
});
