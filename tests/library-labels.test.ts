import assert from 'node:assert/strict';
import test from 'node:test';
import { familyLabel, libraryLabel, presetLabels } from '../src/core/library-labels';
import type { Preset } from '../src/core/types';

test('section labels preserve acronyms and leave curated mixed-case labels unchanged', () => {
  assert.equal(libraryLabel('MOTORS & ACTUATORS'), 'Motors & actuators');
  assert.equal(libraryLabel('CNC SCREW SUPPORTS'), 'CNC screw supports');
  assert.equal(libraryLabel('DC MOTORS & BEC MODULES'), 'DC motors & BEC modules');
  assert.equal(libraryLabel('PCB & SRS ACCESSORIES'), 'PCB & SRS accessories');
  assert.equal(libraryLabel('LED MODULES'), 'LED modules');
  assert.equal(libraryLabel('Custom i²C collection'), 'Custom i²C collection');
});

test('family titles do not replace the physical member name', () => {
  const member = {
    name: 'Threaded spacer',
    browseFamily: { id: 'spacers', label: 'Spacers & standoffs' },
  };
  assert.equal(familyLabel(member), 'Spacers & standoffs');
  assert.equal(member.name, 'Threaded spacer');
  assert.equal(familyLabel({ ...member, browseFamily: undefined }), 'Threaded spacer');
});

test('preset presentation keeps canonical titles and original source records independent', () => {
  const preset: Preset = {
    id: 'model-x1',
    name: 'Maker X1 · 4 mm',
    description: 'A naming fixture.',
    parameters: { model: 'x1', length: 4 },
    catalog: {
      designation: 'SOURCE-004',
      sourceName: 'Original catalog',
      sourceUrl: 'https://example.com/model-x1',
      verifiedParameters: ['length'],
    },
  };
  const snapshot = structuredClone(preset);
  assert.deepEqual(presetLabels(preset), {
    name: 'Maker X1 · 4 mm',
    designation: 'SOURCE-004',
  });
  assert.deepEqual(presetLabels({ ...preset, catalog: undefined }), {
    name: preset.name,
    designation: undefined,
  });
  assert.deepEqual(
    presetLabels({ ...preset, catalog: { ...preset.catalog!, designation: preset.name } }),
    { name: preset.name, designation: undefined },
  );
  assert.deepEqual(preset, snapshot);
});
