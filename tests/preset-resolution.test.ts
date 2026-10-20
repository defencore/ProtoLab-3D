import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { matchingPreset, selectedMatchingPreset } from '../src/core/preset-resolution';
import type { PartDefinition, Preset } from '../src/core/types';

function fixture(fixed: boolean): PartDefinition {
  const stock: Preset = {
    id: 'source-a',
    name: 'Source A',
    description: 'Published model.',
    parameters: { model: 'motor-a', angle: 0 },
    catalog: {
      designation: 'MOTOR-A',
      sourceName: 'Supplier A',
      sourceUrl: 'https://example.test/a',
      verifiedParameters: ['model'],
    },
  };
  return {
    id: 'preset-fixture',
    name: 'Preset fixture',
    description: 'Source identity fixture.',
    category: 'TEST',
    subgroup: 'TEST',
    keywords: [],
    icon: 'box',
    complexity: 'Simple',
    product: {
      kind: 'detail',
      supply: 'purchased',
      description: 'Supplier model.',
      processes: [],
      releaseRequirements: [],
    },
    catalogSelectionOnly: fixed,
    parameters: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        group: 'Model',
        options: [{ label: 'Motor A', value: 'motor-a' }],
      },
      { key: 'angle', label: 'Angle', type: 'number', group: 'Pose' },
    ],
    defaults: { ...stock.parameters },
    presets: [
      stock,
      {
        ...stock,
        id: 'source-b',
        name: 'Source B',
        catalog: {
          ...stock.catalog!,
          sourceName: 'Supplier B',
          sourceUrl: 'https://example.test/b',
        },
      },
    ],
    validate: () => [],
    dimensions: () => [1, 1, 1],
    buildGeometry: () => new Group(),
    python: () => 'shape = Part.makeBox(1, 1, 1)',
  };
}

test('fixed identity resolves pose changes and retains a preferred matching supplier', () => {
  const part = fixture(true);
  const pose = { ...part.defaults, angle: 45 };
  assert.equal(matchingPreset(part, pose)?.id, 'source-a');
  assert.equal(matchingPreset(part, pose, 'source-b')?.id, 'source-b');
  assert.equal(selectedMatchingPreset(part, pose, 'source-b')?.id, 'source-b');
  assert.equal(selectedMatchingPreset(part, { ...pose, model: 'motor-b' }, 'source-b'), undefined);
});

test('editable geometry requires a complete matching configuration', () => {
  const part = fixture(false);
  assert.equal(matchingPreset(part, part.defaults, 'source-b')?.id, 'source-b');
  assert.equal(matchingPreset(part, { ...part.defaults, angle: 45 }, 'source-b'), undefined);
  assert.equal(matchingPreset(part, { ...part.defaults, angle: 45, model: 'motor-b' }), undefined);
});

test('explicit supply resolution never infers a source from a missing or stale choice', () => {
  const part = fixture(true);
  for (const presetId of [undefined, '', 'custom', 'removed-source']) {
    assert.equal(selectedMatchingPreset(part, part.defaults, presetId), undefined);
    assert.equal(matchingPreset(part, part.defaults, presetId)?.id, 'source-a');
  }
});

test('a preferred source must match the configured identity before it can be retained', () => {
  const part = fixture(true);
  part.presets[1] = {
    ...part.presets[1],
    parameters: { ...part.presets[1].parameters, model: 'motor-b' },
  };
  assert.equal(selectedMatchingPreset(part, part.defaults, 'source-b'), undefined);
  assert.equal(matchingPreset(part, part.defaults, 'source-b')?.id, 'source-a');
  assert.equal(matchingPreset({ ...part, presets: [] }, part.defaults), undefined);
});
