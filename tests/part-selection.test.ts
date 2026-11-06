import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import type { PartDefinition } from '../src/core/types';
import {
  availableModelState,
  defaultPartSelection,
  reconcilePartSelection,
} from '../src/core/part-selection';
import { parseConfiguration } from '../src/core/configuration';
import { validateParameters } from '../src/core/validation';
import { eskdIdentity, physicalProductState } from '../src/core/eskd';

function moduleDefinition(overrides: Partial<PartDefinition> = {}): PartDefinition {
  return {
    id: 'test-module',
    name: 'Test module',
    category: 'TEST',
    subgroup: 'MODULES',
    description: 'A replaceable part module.',
    product: {
      kind: 'detail',
      supply: 'manufactured',
      description: 'Manufactured test fixture.',
      processes: ['milling'],
      releaseRequirements: ['Review the configured fixture drawing.'],
    },
    keywords: [],
    icon: 'box',
    complexity: 'Simple',
    defaults: { width: 10, length: 20, style: 'plain' },
    parameters: [
      { key: 'width', label: 'Width', type: 'number', min: 1, max: 100, group: 'Size' },
      { key: 'length', label: 'Length', type: 'number', min: 1, max: 100, group: 'Size' },
      {
        key: 'style',
        label: 'Style',
        type: 'select',
        group: 'Size',
        options: [
          { label: 'Plain', value: 'plain' },
          { label: 'Ribbed', value: 'ribbed' },
        ],
      },
    ],
    presets: [],
    validate: () => [],
    buildGeometry: () => new Group(),
    python: () => '',
    dimensions: () => [10, 10, 10],
    ...overrides,
  };
}

test('module replacement updates untouched defaults and preserves valid user edits', () => {
  const previous = moduleDefinition();
  const next = moduleDefinition({ defaults: { ...previous.defaults, width: 12, length: 30 } });
  const selection = defaultPartSelection(previous);
  selection.parameters.length = 42;
  const result = reconcilePartSelection(next, previous, selection);
  assert.deepEqual(result.parameters, { width: 12, length: 42, style: 'plain' });
  assert.equal(result.presetId, 'custom');
});

test('replacement adds new fields, removes deleted fields, and repairs changed field contracts', () => {
  const previous = moduleDefinition();
  const next = moduleDefinition({
    defaults: { width: 12, enabled: true, style: 'smooth' },
    parameters: [
      { key: 'width', label: 'Width', type: 'number', min: 1, max: 25, group: 'Size' },
      { key: 'enabled', label: 'Enabled', type: 'boolean', group: 'Size' },
      {
        key: 'style',
        label: 'Style',
        type: 'select',
        group: 'Size',
        options: [{ label: 'Smooth', value: 'smooth' }],
      },
    ],
  });
  const selection = defaultPartSelection(previous);
  selection.parameters.width = 50;
  selection.parameters.style = 'ribbed';
  assert.deepEqual(reconcilePartSelection(next, previous, selection).parameters, next.defaults);
});

test('a changed constraint keeps independent edits and returns a valid model state', () => {
  const previous = moduleDefinition({
    states: [{ id: 'expanded', label: 'Expanded', description: '' }],
  });
  const next = moduleDefinition({
    states: [{ id: 'assembled', label: 'Assembled', description: '' }],
    validate: (values) =>
      Number(values.width) < Number(values.length) ? [] : ['Width must be smaller than length.'],
  });
  const selection = defaultPartSelection(previous);
  selection.parameters.width = 70;
  selection.parameters.length = 30;
  selection.parameters.style = 'ribbed';
  const result = reconcilePartSelection(next, previous, selection);
  assert.deepEqual(result.parameters, { width: 10, length: 30, style: 'ribbed' });
  assert.equal(result.modelState, 'assembled');
  assert.deepEqual(next.validate(result.parameters, result.modelState), []);
});

test('an unchanged selected preset follows updated catalog data and a removed preset keeps its dimensions', () => {
  const preset = {
    id: 'catalog-item',
    name: 'Catalog item',
    description: '',
    parameters: { width: 15, length: 40, style: 'plain' },
  };
  const previous = moduleDefinition({ presets: [preset] });
  const selection = {
    partId: previous.id,
    parameters: { ...preset.parameters },
    modelState: 'default',
    presetId: preset.id,
  };
  const next = moduleDefinition({
    presets: [{ ...preset, parameters: { ...preset.parameters, length: 45 } }],
  });
  const result = reconcilePartSelection(next, previous, selection);
  assert.equal(result.parameters.length, 45);
  assert.equal(result.presetId, preset.id);
  const removed = reconcilePartSelection(moduleDefinition(), previous, selection);
  assert.deepEqual(removed.parameters, preset.parameters);
  assert.equal(removed.presetId, 'custom');
});

test('removing the selected module resets to the replacement module instead of reusing unrelated values', () => {
  const previous = moduleDefinition();
  const replacement = moduleDefinition({
    id: 'another-module',
    defaults: { width: 5, length: 6, style: 'plain' },
  });
  assert.deepEqual(
    reconcilePartSelection(replacement, previous, defaultPartSelection(previous)),
    defaultPartSelection(replacement),
  );
});

test('module replacement keeps edited text and follows untouched text defaults', () => {
  const previous = moduleDefinition({
    parameters: [
      ...moduleDefinition().parameters,
      { key: 'recipe', label: 'Recipe', type: 'text', group: 'Definition' },
    ],
    defaults: { ...moduleDefinition().defaults, recipe: 'original recipe' },
  });
  const next = {
    ...previous,
    defaults: { ...previous.defaults, recipe: 'updated recipe' },
  };
  const selection = defaultPartSelection(previous);
  assert.equal(
    reconcilePartSelection(next, previous, selection).parameters.recipe,
    'updated recipe',
  );
  selection.parameters.recipe = 'custom recipe\nwith independent text';
  assert.equal(
    reconcilePartSelection(next, previous, selection).parameters.recipe,
    selection.parameters.recipe,
  );
  selection.parameters.recipe = 123;
  assert.equal(
    reconcilePartSelection(next, previous, selection).parameters.recipe,
    'updated recipe',
  );
});

test('module replacement preserves the selected source when multiple presets share dimensions', () => {
  const first = {
    id: 'source-a',
    name: 'Source A',
    description: 'Same physical identity from a different source.',
    parameters: { width: 15, length: 40, style: 'plain' },
  };
  const second = { ...first, id: 'source-b', name: 'Source B' };
  const previous = moduleDefinition({ presets: [first, second] });
  const selected = {
    partId: previous.id,
    parameters: { ...second.parameters },
    modelState: 'default',
    presetId: second.id,
  };
  const replacement = { ...previous, description: 'Updated metadata.' };
  assert.equal(reconcilePartSelection(replacement, previous, selected).presetId, second.id);
  assert.equal(
    reconcilePartSelection({ ...replacement, presets: [first] }, previous, selected).presetId,
    first.id,
  );
});

test('default selection and module replacement choose a state available for the actual parameters', () => {
  const part = moduleDefinition({
    states: [
      {
        id: 'ribbed-inspection',
        label: 'Ribbed inspection',
        description: 'Inspection for the ribbed execution.',
        availableWhen: (values) => values.style === 'ribbed',
      },
      { id: 'assembled', label: 'Assembled', description: 'Canonical installed configuration.' },
    ],
  });
  assert.equal(defaultPartSelection(part).modelState, 'assembled');
  assert.equal(availableModelState(moduleDefinition(), part.defaults, 'removed-state'), 'default');

  const previous = { ...part, states: part.states!.map(({ availableWhen, ...state }) => state) };
  const selection = {
    ...defaultPartSelection(previous),
    parameters: { ...part.defaults, length: 42 },
  };
  assert.equal(selection.modelState, 'ribbed-inspection');
  const reconciled = reconcilePartSelection(part, previous, selection);
  assert.equal(reconciled.modelState, 'assembled');
  assert.equal(reconciled.parameters.length, 42);
  assert.deepEqual(validateParameters(part, reconciled.parameters, reconciled.modelState), []);
});

test('repairing parameters also reconciles a state that becomes unavailable during recovery', () => {
  const previous = moduleDefinition({
    states: [
      { id: 'assembled', label: 'Assembled', description: '' },
      {
        id: 'wide-inspection',
        label: 'Wide inspection',
        description: '',
        availableWhen: (values) => Number(values.width) >= 50,
      },
    ],
  });
  const next = {
    ...previous,
    validate: (values: PartDefinition['defaults']) =>
      Number(values.width) < Number(values.length) ? [] : ['Width must be smaller than length.'],
  };
  const selection = {
    ...defaultPartSelection(previous),
    parameters: { ...previous.defaults, width: 70, length: 30, style: 'ribbed' },
    modelState: 'wide-inspection',
  };
  const result = reconcilePartSelection(next, previous, selection);
  assert.deepEqual(result.parameters, { width: 10, length: 30, style: 'ribbed' });
  assert.equal(result.modelState, 'assembled');
  assert.deepEqual(validateParameters(next, result.parameters, result.modelState), []);
});

test('configuration imports reject an existing state that is unavailable for the selected execution', () => {
  const part = moduleDefinition({
    states: [
      { id: 'assembled', label: 'Assembled', description: '' },
      {
        id: 'ribbed-inspection',
        label: 'Ribbed inspection',
        description: '',
        availableWhen: (values) => values.style === 'ribbed',
      },
    ],
  });
  assert.deepEqual(validateParameters(part, part.defaults, 'assembled'), []);
  assert.ok(validateParameters(part, part.defaults, 'ribbed-inspection').length);
  const document = {
    version: 1,
    units: 'mm',
    part: part.id,
    parameters: part.defaults,
    state: 'ribbed-inspection',
  };
  assert.throws(() => parseConfiguration(JSON.stringify(document), [part]), /model state/);
  assert.equal(
    parseConfiguration(
      JSON.stringify({ ...document, parameters: { ...part.defaults, style: 'ribbed' } }),
      [part],
    ).state,
    'ribbed-inspection',
  );
});

test('configuration imports retain explicit source identity when executions share parameters', () => {
  const first = {
    id: 'source-a',
    name: 'Source A',
    description: 'First source.',
    parameters: moduleDefinition().defaults,
  };
  const second = { ...first, id: 'source-b', name: 'Source B' };
  const part = moduleDefinition({ presets: [first, second] });
  const document = {
    version: 1,
    units: 'mm',
    part: part.id,
    parameters: part.defaults,
    state: 'default',
  };
  for (const presetId of ['source-b', 'custom'])
    assert.equal(
      parseConfiguration(JSON.stringify({ ...document, presetId }), [part]).presetId,
      presetId,
    );
  assert.equal(parseConfiguration(JSON.stringify(document), [part]).presetId, undefined);
  for (const presetId of ['missing', '', 42, null, {}])
    assert.throws(() => parseConfiguration(JSON.stringify({ ...document, presetId }), [part]));
  assert.throws(() =>
    parseConfiguration(
      JSON.stringify({
        ...document,
        presetId: 'source-b',
        parameters: { ...part.defaults, length: 42 },
      }),
      [part],
    ),
  );
});

test('physical identity normalization uses states available for the actual configuration', () => {
  const part = moduleDefinition({
    states: [
      {
        id: 'assembled',
        label: 'Assembled',
        description: '',
        availableWhen: (values) => Number(values.width) < 50,
      },
      {
        id: 'wide',
        label: 'Wide execution',
        description: '',
        availableWhen: (values) => Number(values.width) >= 50,
      },
      { id: 'exploded', label: 'Exploded', description: 'Inspection only.' },
    ],
    physicalStates: ['wide'],
  });
  const wide = { ...part.defaults, width: 70 };
  assert.equal(physicalProductState(part, 'exploded', wide), 'wide');
  assert.equal(physicalProductState(part, 'wide', wide), 'wide');
  assert.equal(physicalProductState(part, 'wide', part.defaults), 'assembled');
  assert.equal(
    eskdIdentity(part, wide, 'exploded').configurationKey,
    eskdIdentity(part, wide, 'wide').configurationKey,
  );
});
