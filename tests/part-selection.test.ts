import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import type { PartDefinition } from '../src/core/types';
import { defaultPartSelection, reconcilePartSelection } from '../src/core/part-selection';

function moduleDefinition(overrides: Partial<PartDefinition> = {}): PartDefinition {
  return {
    id: 'test-module',
    name: 'Test module',
    category: 'TEST',
    subgroup: 'MODULES',
    description: 'A replaceable part module.',
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
