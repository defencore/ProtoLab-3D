import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
import jaw from '../src/parts/jaw-coupling/part';
import jawModule from '../src/parts/jaw-coupling/index';
import type { Parameters, PartDefinition } from '../src/core/types';
import { validateParameters } from '../src/core/validation';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url,
);
const { default: Configurator } = await import('../src/components/Configurator');

const fixture: PartDefinition = {
  ...jaw,
  parameters: [
    {
      key: 'frame',
      label: 'Frame',
      type: 'select',
      group: 'Configuration',
      options: [
        { label: 'Compact', value: 'compact' },
        { label: 'Large', value: 'large' },
      ],
    },
    {
      key: 'option',
      label: 'Execution',
      type: 'select',
      group: 'Configuration',
      options: [
        { label: 'Universal', value: 'universal' },
        { label: 'Compact bore', value: 'small', availableWhen: (p) => p.frame === 'compact' },
        { label: 'Large bore', value: 'big', availableWhen: (p) => p.frame === 'large' },
      ],
    },
  ],
  defaults: { frame: 'compact', option: 'universal' },
  catalogSelection: [],
  presetMatchKeys: [],
  presets: [],
  validate: () => [],
};

function configurationHtml(parameters: Parameters, definition: PartDefinition = fixture) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  const noop = () => {};
  try {
    return renderToStaticMarkup(
      React.createElement(Configurator, {
        part: definition,
        familyParts: [definition],
        browseQuery: { query: '', revision: 0 },
        onBrowseQueryChange: noop,
        parameters,
        modelState: 'assembly',
        presetId: '',
        errors: [],
        onChange: noop,
        onState: noop,
        onBrowse: noop,
        onFindMatching: noop,
        onReset: noop,
        onSave: noop,
        onPreset: noop,
        onSelectPart: noop,
        onSelectModel: noop,
      }),
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('generic select controls show only choices compatible with the complete configuration', () => {
  const compact = configurationHtml({ frame: 'compact', option: 'small' });
  assert.match(compact, /value="universal"/);
  assert.match(compact, /value="small" selected=""/);
  assert.doesNotMatch(compact, /value="big"/);
  const large = configurationHtml({ frame: 'large', option: 'big' });
  assert.match(large, /value="universal"/);
  assert.match(large, /value="big" selected=""/);
  assert.doesNotMatch(large, /value="small"/);
});

test('configuration validation rejects unavailable select options and keeps unconditional choices valid', () => {
  assert.deepEqual(
    validateParameters(fixture, { frame: 'compact', option: 'small' }, 'assembly'),
    [],
  );
  assert.deepEqual(validateParameters(fixture, { frame: 'large', option: 'big' }, 'assembly'), []);
  for (const frame of ['compact', 'large'])
    assert.deepEqual(validateParameters(fixture, { frame, option: 'universal' }, 'assembly'), []);
  assert.deepEqual(validateParameters(fixture, { frame: 'compact', option: 'big' }, 'assembly'), [
    'Choose a valid execution.',
  ]);
  assert.deepEqual(validateParameters(fixture, { frame: 'large', option: 'small' }, 'assembly'), [
    'Choose a valid execution.',
  ]);
});

test('Other hole opens editable bore inputs in the real coupling configurator', () => {
  const coupling = jawModule.part;
  const fixed = coupling.presets.find((row) => row.id === 'lf-d14-l22-clamp-3-4')!;
  const fixedHtml = configurationHtml(fixed.parameters, coupling);
  assert.doesNotMatch(fixedHtml, /id="parameter-boreA"/);
  assert.doesNotMatch(fixedHtml, /id="parameter-boreB"/);
  const custom = coupling.updateParameters!(
    { ...fixed.parameters, boreOption: 'other' },
    'boreOption',
  );
  const customHtml = configurationHtml(custom, coupling);
  assert.match(customHtml, /id="parameter-boreA"/);
  assert.match(customHtml, /id="parameter-boreB"/);
  assert.match(customHtml, /id="parameter-boreA"[^>]*value="3"/);
  assert.match(customHtml, /id="parameter-boreB"[^>]*value="4"/);
});
