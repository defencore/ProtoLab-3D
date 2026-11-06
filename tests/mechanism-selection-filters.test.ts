import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import {
  emptyMechanismFilters,
  filterMechanismExecutions,
  matchingMechanismPreset,
  mechanismExecutionChoices,
  mechanismParametersMatch,
} from '../src/core/mechanism-catalog';
import type { PartDefinition } from '../src/core/types';
import { parts } from '../src/parts';

register(
  `data:text/javascript,${encodeURIComponent(`export async function load(url, context, nextLoad) { if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true }; return nextLoad(url, context); }`)}`,
  import.meta.url,
);
const { default: MechanismCatalogPicker } =
  await import('../src/components/MechanismCatalogPicker');

const members = parts.filter((part) => part.mechanismExecution);
const base = members[0];
const fixture = (
  id: string,
  changes: Partial<NonNullable<PartDefinition['mechanismExecution']>> = {},
): PartDefinition => ({
  ...base,
  id,
  name: id,
  keywords: [],
  description: 'Fixture assembly',
  presets: [],
  mechanismExecution: {
    outputs: 1,
    construction: 'Fixture frame',
    description: 'Fixture assembly',
    screws: [{ designation: 'SFK0825', kind: 'ball-screw', lead: 2.5 }],
    motors: [{ model: 'Motor A' }],
    materials: ['Steel', 'Bronze'],
    processes: ['Turning'],
    travelDegrees: 20,
    ...changes,
  },
});
const ball = fixture('ball');
const lead = fixture('lead', {
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  outputs: 4,
  motors: [{ model: 'Motor B' }],
  materials: ['Steel', 'Brass'],
  processes: ['Laser cutting', 'Drilling'],
});
const dual = fixture('dual', {
  screws: [
    {
      designation: 'TR8×2(P2)',
      kind: 'lead-screw',
      lead: 2,
      pitch: 2,
      starts: 1,
      when: { screwModel: 'tr8x2' },
    },
    {
      designation: 'TR8×8(P2)',
      kind: 'lead-screw',
      lead: 8,
      pitch: 2,
      starts: 4,
      when: { screwModel: 'tr8x8' },
    },
  ],
  outputs: 4,
  motors: [{ model: 'Motor C' }],
  materials: ['Aluminium'],
  processes: ['CNC milling'],
});
dual.defaults = { screwModel: 'tr8x2' };
dual.presets = ['tr8x2', 'tr8x8'].map((screwModel) => ({
  id: `dual-${screwModel}`,
  name: `Motor C · ${screwModel}`,
  description: 'Fixture assembly',
  parameters: { screwModel },
}));
const fixtures = [ball, lead, dual];
const ids = (definitions: PartDefinition[]) => definitions.map((part) => part.id);

test('component filters intersect screw type, motor, output count, material and production process', () => {
  const all = emptyMechanismFilters();
  assert.deepEqual(ids(filterMechanismExecutions(fixtures, all)), ['ball', 'lead', 'dual']);
  assert.deepEqual(
    ids(
      filterMechanismExecutions(fixtures, {
        ...all,
        screwKind: 'lead-screw',
        motor: 'Motor B',
        outputs: '4',
        material: 'Brass',
        process: 'Laser cutting',
      }),
    ),
    ['lead'],
  );
  assert.deepEqual(
    filterMechanismExecutions(fixtures, { ...all, motor: 'Motor A', outputs: '4' }),
    [],
  );
  assert.deepEqual(filterMechanismExecutions(fixtures, { ...all, material: 'Titanium' }), []);
  assert.deepEqual(
    filterMechanismExecutions(fixtures, {
      ...all,
      screwKind: 'ball-screw',
      process: 'Laser cutting',
    }),
    [],
  );
  assert.deepEqual(
    filterMechanismExecutions([{ ...ball, mechanismExecution: undefined }], all),
    [],
  );
});

test('lead ranges accept decimal commas, open bounds and inclusive endpoints, rejecting invalid ranges', () => {
  const all = emptyMechanismFilters();
  assert.deepEqual(
    ids(filterMechanismExecutions(fixtures, { ...all, lead: { min: '2,5', max: '2.5' } })),
    ['ball'],
  );
  assert.deepEqual(
    ids(filterMechanismExecutions(fixtures, { ...all, lead: { min: '', max: '2' } })),
    ['dual'],
  );
  assert.deepEqual(
    ids(filterMechanismExecutions(fixtures, { ...all, lead: { min: '8', max: '' } })),
    ['lead', 'dual'],
  );
  for (const range of [
    { min: '8', max: '2' },
    { min: 'NaN', max: '' },
    { min: '', max: 'Infinity' },
  ])
    assert.deepEqual(
      filterMechanismExecutions(fixtures, { ...all, lead: range }),
      [],
      JSON.stringify(range),
    );
});

test('one screw alternative must satisfy designation, type and lead together', () => {
  const all = emptyMechanismFilters();
  assert.deepEqual(
    ids(
      filterMechanismExecutions(fixtures, {
        ...all,
        drive: 'TR8×2(P2)',
        screwKind: 'lead-screw',
        lead: { min: '2', max: '2' },
      }),
    ),
    ['dual'],
  );
  assert.deepEqual(
    filterMechanismExecutions(fixtures, {
      ...all,
      drive: 'TR8×2(P2)',
      lead: { min: '8', max: '8' },
    }),
    [],
  );
  assert.deepEqual(
    filterMechanismExecutions(fixtures, {
      ...all,
      drive: 'TR8×8(P2)',
      screwKind: 'ball-screw',
    }),
    [],
  );
  assert.deepEqual(filterMechanismExecutions(fixtures, { ...all, query: 'TR8x2 TR8x8' }), []);
});

test('facet counts include other filters and query while keeping unavailable values visible', () => {
  const all = emptyMechanismFilters();
  const choices = mechanismExecutionChoices(fixtures, {
    ...all,
    screwKind: 'ball-screw',
    motor: 'Motor A',
    query: 'fixture',
  });
  assert.deepEqual(
    choices.facets.motor.map(({ value, count }) => [value, count]),
    [
      ['Motor A', 1],
      ['Motor B', 0],
      ['Motor C', 0],
    ],
  );
  assert.equal(choices.facets.screwKind.find((option) => option.value === 'ball-screw')?.count, 1);
  assert.equal(choices.facets.screwKind.find((option) => option.value === 'lead-screw')?.count, 0);
  const outputs = mechanismExecutionChoices(fixtures, { ...all, outputs: '4' }).facets.outputs;
  assert.deepEqual(
    outputs.map(({ value, count }) => [value, count]),
    [
      ['1', 1],
      ['4', 2],
    ],
  );
  assert.ok(
    mechanismExecutionChoices(fixtures, { ...all, query: 'missing-fixture' }).facets.motor.every(
      (option) => option.count === 0,
    ),
  );
});

test('a chosen mechanism resolves a preset compatible with the requested screw alternative', () => {
  const filters = { ...emptyMechanismFilters(), drive: 'TR8×8(P2)' };
  assert.equal(matchingMechanismPreset(dual, filters)?.id, 'dual-tr8x8');
  assert.equal(mechanismParametersMatch(dual, dual.defaults, filters), false);
  assert.equal(mechanismParametersMatch(dual, { screwModel: 'tr8x8' }, filters), true);
  assert.equal(
    matchingMechanismPreset(dual, { ...filters, lead: { min: '2', max: '2' } }),
    undefined,
  );
  assert.equal(
    dual.defaults.screwModel,
    'tr8x2',
    'finding a match does not change the current model',
  );
});

test('motor and screw filters must refer to one available preset configuration', () => {
  const configured = {
    ...dual,
    defaults: { screwModel: 'tr8x2', motorModel: 'a' },
    mechanismExecution: {
      ...dual.mechanismExecution!,
      motors: [
        { model: 'MotorA100', when: { motorModel: 'a' } },
        { model: 'MotorB200', when: { motorModel: 'b' } },
      ],
    },
    presets: [
      {
        id: 'fine-a',
        name: 'Fine MotorA100',
        description: 'Fixture',
        parameters: { screwModel: 'tr8x2', motorModel: 'a' },
      },
      {
        id: 'coarse-b',
        name: 'Coarse MotorB200',
        description: 'Fixture',
        parameters: { screwModel: 'tr8x8', motorModel: 'b' },
      },
    ],
  };
  const all = emptyMechanismFilters();
  assert.equal(matchingMechanismPreset(configured, { ...all, motor: 'MotorB200' })?.id, 'coarse-b');
  assert.deepEqual(
    filterMechanismExecutions([configured], { ...all, drive: 'TR8×2(P2)', motor: 'MotorB200' }),
    [],
  );
  assert.deepEqual(
    filterMechanismExecutions([configured], { ...all, query: 'TR8x2 MotorB200' }),
    [],
  );
});

test('Ukrainian mechanism queries find components and materials in the same assembly', () => {
  const all = emptyMechanismFilters();
  assert.deepEqual(
    ids(
      filterMechanismExecutions(fixtures, {
        ...all,
        query: '\u0428\u0412\u041f \u0431\u0440\u043e\u043d\u0437\u0430',
      }),
    ),
    ['ball'],
  );
  assert.deepEqual(
    ids(
      filterMechanismExecutions(fixtures, {
        ...all,
        query:
          '\u0442\u0440\u0430\u043f\u0435\u0446\u0435\u0457\u0434\u0430\u043b\u044c\u043d\u0438\u0439 \u0441\u0442\u0430\u043b\u044c',
      }),
    ),
    ['lead'],
  );
  assert.deepEqual(
    filterMechanismExecutions(fixtures, {
      ...all,
      query: '\u0428\u0412\u041f \u0430\u043b\u044e\u043c\u0456\u043d\u0456\u0439',
    }),
    [],
  );
});

test('real motor KV and screw start queries cannot combine facts from alternative configurations', () => {
  const all = emptyMechanismFilters();
  const index = buildLibrarySearchIndex(groupBrowseFamilies(members));
  for (const query of ['2838 3100KV', '2845 5700KV', 'TR8x2 four start']) {
    assert.deepEqual(ids(filterMechanismExecutions(members, { ...all, query })), [], query);
    assert.deepEqual(searchLibrary(index, query), [], `library: ${query}`);
  }
  for (const query of ['2838 5700KV', 'TR8x8 four start'])
    assert.equal(searchLibrary(index, query).length, 1, `library: ${query}`);
  assert.deepEqual(
    ids(filterMechanismExecutions(members, { ...all, query: '2838 5700KV' })).sort(),
    ['tr8-geared-rocker-actuator', 'tr8-quad-geared-rocker-actuator'],
  );
  const fourStart = filterMechanismExecutions(members, { ...all, query: 'TR8x8 four start' });
  assert.ok(fourStart.length > 0);
  assert.ok(fourStart.some((part) => part.id === 'tr8-quad-surpass-actuator'));
  for (const part of fourStart) {
    const preset = matchingMechanismPreset(part, { ...all, query: 'TR8x8 four start' })!;
    assert.ok(
      part.mechanismExecution!.screws.some(
        (screw) =>
          screw.designation === 'TR8×8(P2)' &&
          screw.starts === 4 &&
          (!screw.when ||
            Object.entries(screw.when).every(([key, value]) => preset.parameters[key] === value)),
      ),
    );
  }
});

test('the selected Surpass row summarizes its actual single-start screw with empty or compatible queries', () => {
  const selectedPart = members.find((part) => part.id === 'tr8-quad-surpass-actuator')!;
  const parameters = { ...selectedPart.defaults, screwModel: 'tr8x2-p2' };
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    for (const query of ['', '3100KV']) {
      const html = renderToStaticMarkup(
        React.createElement(MechanismCatalogPicker, {
          parts: members,
          selectedPart,
          parameters,
          query,
          onQueryChange: () => {},
          onSelectPart: () => {},
        }),
      );
      const selected = [
        ...html.matchAll(/<button\b[^>]*class="mechanism-execution-card"[^>]*>[\s\S]*?<\/button>/g),
      ]
        .map(([button]) => button)
        .filter((button) => button.includes('aria-pressed="true"'));
      assert.equal(selected.length, 1);
      const summary = selected[0]
        .split('<span class="mechanism-execution-summary">')[1]
        .split('<span class="mechanism-execution-description">')[0]
        .replace(/<[^>]*>/g, '');
      assert.match(summary, /TR8×2\(P2\) · lead 2 mm\/rev/);
      assert.match(summary, /1 start/);
      assert.doesNotMatch(summary, /TR8×8|lead 8|4 starts/);
      const displayedConfiguration = selected[0].match(
        /class="mechanism-execution-configuration">([\s\S]*?)<\/span>/,
      )?.[1];
      if (displayedConfiguration)
        assert.doesNotMatch(displayedConfiguration, /TR8×8|lead 8|4 starts/);
    }
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});

test('the catalog presents component filters and keeps the current assembly visible outside results', () => {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    const html = renderToStaticMarkup(
      React.createElement(MechanismCatalogPicker, {
        parts: members,
        selectedPart: base,
        query: 'no-matching-execution-99999',
        onQueryChange: () => {},
        onSelectPart: () => {},
      }),
    );
    for (const label of ['Screw type', 'Motor', 'Material', 'Manufacturing', 'Lead'])
      assert.match(html, new RegExp(label, 'i'));
    assert.match(html, /outside these filters/);
    assert.match(html, /No .*match/);
    assert.match(html, /aria-pressed="true"/);
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
