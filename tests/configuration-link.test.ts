import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { configurationLink, parseConfigurationLink } from '../src/core/configuration-link';
import type { AssemblyComponent } from '../src/core/product-types';
import type { PartDefinition, Preset } from '../src/core/types';

function definition(id = 'custom-detail'): PartDefinition {
  return {
    id,
    name: 'Identical display name',
    category: 'TEST',
    subgroup: 'TEST',
    description: 'Configuration link fixture.',
    keywords: [],
    icon: 'box',
    complexity: 'Fixture',
    product: {
      kind: 'detail',
      supply: 'manufactured',
      description: 'Editable fixture.',
      processes: ['milling'],
      releaseRequirements: ['Verify interfaces.'],
    },
    defaults: {
      model: 'a',
      size: 12,
      label: 'Default',
      recipe: '{"kind":"box","width":12}',
      enabled: true,
      manual: 0,
    },
    parameters: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        group: 'Design',
        options: ['a', 'b'].map((value) => ({ value, label: value })),
      },
      { key: 'size', label: 'Size', type: 'number', min: 1, max: 1000, group: 'Design' },
      { key: 'label', label: 'Label', type: 'text', group: 'Design' },
      { key: 'recipe', label: 'Geometry recipe', type: 'text', group: 'Design' },
      { key: 'enabled', label: 'Enabled', type: 'boolean', group: 'Design' },
      {
        key: 'manual',
        label: 'Manual control',
        type: 'number',
        group: 'Operation',
        visibleWhen: (p) => p.model === 'b',
        optionalWhenHidden: true,
      },
    ],
    presets: [],
    states: [
      { id: 'assembled', label: 'Assembled', description: 'Installed state.' },
      {
        id: 'exploded',
        label: 'Exploded',
        description: 'Available for model B.',
        availableWhen: (p) => p.model === 'b',
      },
      { id: 'screw-only', label: 'Screw only', description: 'A physical selection.' },
      { id: 'nut-only', label: 'Nut only', description: 'A physical selection.' },
    ],
    physicalStates: ['screw-only', 'nut-only'],
    validate(parameters) {
      try {
        JSON.parse(String(parameters.recipe));
        return [];
      } catch {
        return ['Choose a valid geometry recipe.'];
      }
    },
    buildGeometry: () => new Group(),
    python: () => 'shape = Part.makeBox(1, 1, 1)',
    dimensions: () => [1, 1, 1],
  };
}

function component(
  part: PartDefinition,
  patch: Partial<AssemblyComponent> = {},
): AssemblyComponent {
  return {
    id: 'installed-left',
    libraryId: part.id,
    name: 'An installation role',
    parameters: { ...part.defaults },
    state: 'assembled',
    supply: part.product.supply,
    quantity: 4,
    placement: { translation: [100, 200, 300], rotation: [0, 0, 90] },
    ...patch,
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function fragment(config: unknown): string {
  return '#configuration=' + encodeURIComponent(JSON.stringify(config));
}

test('component links round-trip complete Unicode custom parameters and recipes on the current application path', () => {
  const part = definition();
  const recipe = JSON.stringify({
    kind: 'compound',
    children: [
      {
        kind: 'box',
        label: '\u0412\u0442\u0443\u043b\u043a\u0430 Ø8 × 12 🚀',
        note: 'A&B #/?=% + "quote"\nnew line',
        width: 37.25,
      },
    ],
    annotation: 'κ'.repeat(4096),
  });
  const source = freeze(
    component(part, {
      parameters: {
        ...part.defaults,
        model: 'b',
        size: 37.25,
        label: '\u0414\u0435\u0442\u0430\u043b\u044c №2 · β + 50% # & ?',
        recipe,
        enabled: false,
        manual: 25,
      },
      state: 'exploded',
    }),
  );
  const before = structuredClone(source);
  const link = configurationLink(source);
  assert.ok(link.startsWith('#configuration='));
  const base = new URL('https://example.org/ProtoLab-3D/?workspace=host#previous');
  const target = new URL(link, base);
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, base.pathname);
  assert.equal(target.search, base.search);
  const restored = parseConfigurationLink(target.hash, freeze([part]));
  assert.ok(restored);
  assert.strictEqual(restored.part, part);
  assert.deepEqual(restored.parameters, source.parameters);
  assert.equal(restored.state, 'exploded');
  assert.equal(restored.presetId, 'custom');
  assert.notStrictEqual(restored.parameters, source.parameters);
  restored.parameters.size = 99;
  assert.equal(source.parameters.size, 37.25);
  assert.deepEqual(source, before);
  const document = JSON.parse(decodeURIComponent(link.slice('#configuration='.length)));
  assert.equal(document.part, part.id);
  assert.equal(document.version, 1);
  assert.equal(document.units, 'mm');
  for (const key of [
    'id',
    'name',
    'quantity',
    'placement',
    'children',
    'procurement',
    'manufacturing',
  ])
    assert.equal(
      Object.hasOwn(document, key),
      false,
      'installation data does not become library configuration',
    );
});

test('links preserve absent optional hidden fields and genuine physical states', () => {
  const part = definition();
  const parameters = { ...part.defaults };
  delete parameters.manual;
  for (const state of ['assembled', 'screw-only', 'nut-only']) {
    const restored = parseConfigurationLink(
      configurationLink(component(part, { parameters, state })),
      [part],
    );
    assert.ok(restored);
    assert.deepEqual(restored.parameters, parameters);
    assert.equal(Object.hasOwn(restored.parameters, 'manual'), false);
    assert.equal(restored.state, state);
  }
});

test('part and model identities resolve independently of duplicate display names', () => {
  const a = definition('first-family'),
    b = definition('second-family');
  const links = [
    component(a),
    component(b),
    component(a, { parameters: { ...a.defaults, model: 'b' } }),
    component(a, { parameters: { ...a.defaults, size: 34 } }),
  ].map((source) => configurationLink(source));
  assert.equal(new Set(links).size, 4);
  const restored = links.map((link) => parseConfigurationLink(link, [a, b])!);
  assert.deepEqual(
    restored.map((item) => item.part.id),
    [a.id, b.id, a.id, a.id],
  );
  assert.deepEqual(
    restored.map((item) => item.parameters.model),
    ['a', 'a', 'b', 'a'],
  );
  assert.equal(restored[3].parameters.size, 34);
});

test('an explicitly matching preferred source preset survives even when another preset has the same physical parameters', () => {
  const part = definition('fixed-model');
  part.catalogSelectionOnly = true;
  part.product.supply = 'purchased';
  part.defaults = { model: 'a', angle: 0, note: '' };
  part.parameters = [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      group: 'Selection',
      options: ['a', 'b'].map((value) => ({ value, label: value })),
    },
    { key: 'angle', label: 'Angle', type: 'number', group: 'Installation', filterable: false },
    { key: 'note', label: 'Note', type: 'text', group: 'Installation', filterable: false },
  ];
  part.validate = () => [];
  part.presets = ['source-a', '\u0434\u0436\u0435\u0440\u0435\u043b\u043e-β-Ø3'].map((id): Preset => ({
    id,
    name: 'Same catalog label',
    description: 'Preferred source fixture.',
    parameters: { ...part.defaults },
    catalog: {
      designation: id,
      manufacturer: 'Acme',
      sourceName: 'Source',
      sourceUrl: 'https://example.org/' + encodeURIComponent(id),
      verifiedParameters: ['model'],
    },
  }));
  const selected = part.presets[1];
  const source = component(part, {
    presetId: selected.id,
    parameters: { ...part.defaults, angle: 23, note: 'Installation note' },
  });
  const restored = parseConfigurationLink(configurationLink(source), [part]);
  assert.ok(restored);
  assert.equal(restored.presetId, selected.id);
  assert.deepEqual(restored.parameters, source.parameters);
  const custom = parseConfigurationLink(configurationLink(component(part)), [part]);
  assert.ok(custom);
  assert.equal(
    custom.presetId,
    'custom',
    'matching dimensions alone must not invent a supplier selection',
  );
  assert.equal(
    parseConfigurationLink(configurationLink(component(part, { presetId: 'custom' })), [part])!
      .presetId,
    'custom',
  );
});

test('explicit unknown or stale preset identities are rejected instead of silently selecting a different source', () => {
  const part = definition();
  part.presets = [
    { id: 'source', name: 'Source', description: 'Fixture.', parameters: { ...part.defaults } },
  ];
  assert.throws(() =>
    parseConfigurationLink(configurationLink(component(part, { presetId: 'missing' })), [part]),
  );
  assert.throws(() =>
    parseConfigurationLink(
      configurationLink(
        component(part, { presetId: 'source', parameters: { ...part.defaults, size: 20 } }),
      ),
      [part],
    ),
  );
});

test('missing configuration fragments are harmless while malformed or invalid deep links fail validation', () => {
  const part = definition();
  for (const hash of ['', '#', '#unrelated', '#tab=bom'])
    assert.equal(parseConfigurationLink(hash, [part]), undefined);
  const valid = {
    version: 1,
    units: 'mm',
    part: part.id,
    parameters: part.defaults,
    state: 'assembled',
  };
  for (const config of [
    null,
    [],
    {},
    { ...valid, version: 2 },
    { ...valid, units: 'inch' },
    { ...valid, part: 'unknown-part' },
    { ...valid, parameters: [] },
    { ...valid, parameters: null },
    { ...valid, parameters: { ...part.defaults, size: 0 } },
    { ...valid, parameters: { ...part.defaults, size: '12' } },
    { ...valid, parameters: { ...part.defaults, enabled: 'false' } },
    { ...valid, parameters: { ...part.defaults, recipe: 'not JSON' } },
    { ...valid, state: 'missing' },
    { ...valid, state: 'exploded' },
    { ...valid, presetId: 42 },
    { ...valid, presetId: {} },
    { ...valid, presetId: '' },
  ])
    assert.throws(() => parseConfigurationLink(fragment(config), [part]));
  for (const hash of [
    '#configuration',
    '#configuration=',
    '#configuration=%',
    '#configuration=%E0%A4%A',
    '#configuration=not-json',
    fragment(valid) + '&other=value',
  ])
    assert.throws(() => parseConfigurationLink(hash, [part]));
});
