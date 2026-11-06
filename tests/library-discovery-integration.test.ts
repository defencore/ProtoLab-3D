import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalog from '../src/components/Catalog';
import { emptyDiscoveryFilters } from '../src/core/library-discovery';
import type { DiscoveryFilters } from '../src/core/discovery-types';
import type { LibraryLocation } from '../src/core/library-navigation';
import type { PartDefinition } from '../src/core/types';
import { parts } from '../src/parts';

const physical = (id: string) => parts.find((part) => part.id === id)!;
const servo = physical('servo-motor');
const definitions = [
  physical('waveshare-ups-3s'),
  physical('panel-battery-module'),
  {
    ...servo,
    presets: servo.presets.filter((preset) => /ST3215|X10 Mini Pro/i.test(preset.name)),
  },
  { ...physical('camera'), presets: physical('camera').presets.slice(0, 2) },
  { ...physical('bec'), presets: physical('bec').presets.slice(0, 2) },
];
const batteryLocation: LibraryLocation = {
  level: 'subgroup',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
};

function render(query: string, location?: LibraryLocation, filters?: DiscoveryFilters): string {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts: definitions,
        selected: physical('waveshare-ups-3s'),
        query,
        location,
        discoveryFilters: filters ?? emptyDiscoveryFilters(),
        onSelect() {
          assert.fail('Rendering search results must not select a family.');
        },
        onSelectPreset() {
          assert.fail('Rendering search results must not apply a configuration.');
        },
        onQueryChange() {
          assert.fail('Rendering must preserve the typed query.');
        },
        onDiscoveryFiltersChange() {
          assert.fail('Rendering must preserve manual characteristics.');
        },
        onClose() {},
      }),
    );
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

const cards = (html: string) =>
  [
    ...html.matchAll(/<button\b[^>]*class="library-discovery-candidate"[^>]*>[\s\S]*?<\/button>/g),
  ].map(([card]) => card);

test('the actual catalog immediately offers an exact battery configuration from cells and PCB width', () => {
  const html = render('3S width 60');
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-label="Matching configurations"/);
  const choices = cards(html);
  assert.equal(choices.length, 1);
  assert.match(choices[0], /aria-label="Preview Waveshare UPS Module 3S · bare holder"/);
  assert.match(choices[0], /Battery support: 3S/);
  assert.match(choices[0], /PCB width: 60 mm/);
  assert.doesNotMatch(choices[0], /RunCam|UBEC|ST3215/);
});

test('power and width produce concrete compatible servo, camera and regulator options without a type name', () => {
  const html = render('12 V width <= 25');
  const choices = cards(html);
  assert.ok(choices.length >= 3);
  assert.ok(choices.length <= 4, 'the initial live list stays compact');
  const combined = choices.join(' ');
  assert.match(combined, /ST3215-HS/);
  assert.match(combined, /Case width: 24.72 mm/);
  assert.match(combined, /RunCam Phoenix 2 SPV5/);
  assert.match(combined, /Supply voltage: 5–36 V/);
  assert.match(combined, /Hobbywing UBEC 3 A/);
  assert.match(combined, /Input voltage: 5.5–26 V/);
  assert.doesNotMatch(combined, /X10 Mini Pro|Waveshare UPS Module 3S/);
});

test('scoped discovery cannot leak matching configurations from outside a breadcrumb subgroup', () => {
  const html = render('width 60', batteryLocation);
  const choices = cards(html);
  assert.equal(choices.length, 1);
  assert.match(choices[0], /Waveshare UPS Module 3S · bare holder/);
  assert.doesNotMatch(choices.join(' '), /RunCam|UBEC|ST3215/);
  assert.match(html, /Search in Batteries &amp; holders/);
  const incompatible = render('12 V width <= 25', batteryLocation);
  assert.equal(cards(incompatible).length, 0);
  assert.doesNotMatch(incompatible, /aria-label="Preview (?:RunCam|Hobbywing|Waveshare ST3215)/);
});

test('the live configuration list also responds to explicit characteristics with an empty text query', () => {
  const html = render('', undefined, {
    ...emptyDiscoveryFilters(),
    power: '3S',
    width: { min: '60', max: '60' },
  });
  assert.equal(cards(html).length, 1);
  assert.match(cards(html)[0], /Waveshare UPS Module 3S · bare holder/);
  assert.match(html, /aria-label="Remove Power: 3S"/);
});
