import assert from 'node:assert/strict';
import test from 'node:test';
import screw from '../src/parts/ball-screw/part';
import nut from '../src/parts/ball-nut/part';
import {
  ballScrewReferences,
  sfuReferences,
  sfkReferences,
  sfsReferences,
  internalReturnReferences,
} from '../src/catalog/ball-screw-reference';
import { miniatureShaftLengths } from '../src/catalog/ball-screws';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
} from '../src/core/preset-search';
import { parseConfiguration } from '../src/core/configuration';
import { validateParameters } from '../src/core/validation';
import type { PartDefinition } from '../src/core/types';

const index = buildPresetIndex([screw, nut]);
const id = (part: PartDefinition, key: string) => {
  const field = part.parameters.find((candidate) => candidate.key === key);
  assert.ok(field, `The ${part.id} configurator exposes ${key}.`);
  return fieldId(field);
};

test('all 27 rows from the supplied SFU drawing retain their designations and dimensional sentinels', () => {
  assert.deepEqual(
    sfuReferences.map((r) => r.designation),
    [
      'SFU1204-4',
      'SFU1604-4',
      'SFU1605-4',
      'SFU1610-3',
      'SFU2004-4',
      'SFU2005-4',
      'SFU2504-4',
      'SFU2505-4',
      'SFU2506-4',
      'SFU2508-4',
      'SFU2510-4',
      'SFU3204-4',
      'SFU3205-4',
      'SFU3206-4',
      'SFU3208-4',
      'SFU3210-4',
      'SFU4005-4',
      'SFU4006-4',
      'SFU4008-4',
      'SFU4010-4',
      'SFU5010-4',
      'SFU5020-4',
      'SFU6310-4',
      'SFU6320-4',
      'SFU8010-4',
      'SFU8020-4',
      'SFU10020-4',
    ],
  );
  const dimensions = [
    'shaftDiameter',
    'lead',
    'ballDiameter',
    'nutDiameter',
    'flangeDiameter',
    'flangeThickness',
    'nutLength',
    'mountCircle',
    'flangeWidth',
    'mountHoleDiameter',
    'circuits',
  ];
  assert.deepEqual(
    dimensions.map((key) => sfuReferences[0].parameters[key]),
    [12, 4, 2.381, 24, 40, 10, 40, 32, 30, 4.5, 4],
  );
  assert.deepEqual(
    dimensions.map((key) => sfuReferences.at(-1)!.parameters[key]),
    [100, 20, 9.525, 150, 202, 30, 180, 170, 155, 17.5, 4],
  );
  const large = sfuReferences.find((r) => r.designation === 'SFU6320-4')!;
  assert.equal(large.parameters.flangeDiameter, 135);
  assert.equal(large.parameters.flangeThickness, 20);
  assert.equal(large.parameters.nutLength, 149);
  assert.equal(sfuReferences.find((r) => r.designation === 'SFU1610-3')!.parameters.circuits, 3);
  for (const reference of sfuReferences) {
    assert.equal(reference.catalog!.sourceKind, 'attachment');
    assert.equal(reference.catalog!.sourceKind, 'attachment');
    assert.equal(reference.catalog!.sourceUrl, '');
  }
});

test('all 11 miniature listing options expose ten shaft lengths while ambiguous SFK602 remains a prototype', () => {
  assert.deepEqual(miniatureShaftLengths, [100, 150, 200, 250, 300, 350, 400, 450, 500, 550]);
  assert.deepEqual(
    sfkReferences.map((r) => r.designation),
    [
      'SFK0401',
      'SFK0601',
      'SFK0801',
      'SFK0802',
      'SFK082.5',
      'SFK1002',
      'SFK1004',
      'SFK1202',
      'SFK1402',
      'SFK1602',
    ],
  );
  const miniature = screw.presets.filter((p) => p.parameters.family === 'SFK');
  assert.equal(miniature.length, 110);
  assert.equal(miniature.filter((p) => p.catalog).length, 100);
  for (const reference of ballScrewReferences.filter((r) => r.parameters.family === 'SFK')) {
    const variants = miniature.filter((p) =>
      p.catalog
        ? p.catalog.designation === reference.designation
        : p.name.startsWith(reference.designation),
    );
    assert.deepEqual(
      variants.map((p) => p.parameters.length),
      miniatureShaftLengths,
    );
    for (const preset of variants) {
      assert.equal(preset.parameters.endMachining, 'none');
      assert.deepEqual(validateParameters(screw, preset.parameters, 'assembled'), []);
      if (preset.catalog) {
        assert.ok(preset.catalog.verifiedParameters.includes('length'));
        assert.ok(preset.catalog.alternateSourceUrls?.every((url) => url.startsWith('https://')));
      } else {
        assert.match(preset.name, /SFK602 \/ SFK0602.*unverified listing/);
        assert.match(preset.description, /provisional/);
      }
    }
  }
  const miniatureNuts = nut.presets.filter((p) => p.parameters.family === 'SFK');
  assert.equal(miniatureNuts.length, 11);
  assert.ok(miniatureNuts.every((p) => !p.catalog?.verifiedParameters.includes('length')));
});

test('the twelve requested SFS types preserve published shaft diameters rather than decoding their names', () => {
  assert.deepEqual(
    sfsReferences.map((r) => r.designation),
    [
      'SFS1205-2.8',
      'SFS1210-2.8',
      'SFS1605-3.8',
      'SFS1610-2.8',
      'SFS1616-1.8',
      'SFS1620-1.8',
      'SFS2010-3.8',
      'SFS2510-3.8',
      'SFS2525-1.8',
      'SFS3210-3.8',
      'SFS3220-2.8',
      'SFS3232-1.8',
    ],
  );
  for (const reference of sfsReferences.filter((r) => r.designation.startsWith('SFS16')))
    assert.equal(reference.parameters.shaftDiameter, 15);
  for (const reference of sfsReferences.filter((r) => r.designation.startsWith('SFS32')))
    assert.equal(reference.parameters.shaftDiameter, 31);
});

test('all nine nut families are present and both ambiguous listing names remain outside sourced presets', () => {
  assert.deepEqual([...new Set(ballScrewReferences.map((r) => r.parameters.family))].sort(), [
    'DFI',
    'DFU',
    'SFE',
    'SFH',
    'SFI',
    'SFK',
    'SFS',
    'SFU',
    'SFY',
  ]);
  assert.equal(ballScrewReferences.length, 131);
  assert.equal(ballScrewReferences.filter((r) => r.catalog).length, 129);
  assert.equal(screw.presets.length, 230);
  assert.equal(nut.presets.length, 131);
  const ambiguous = ballScrewReferences.filter((r) => !r.catalog);
  assert.deepEqual(
    ambiguous.map((r) => r.designation),
    ['SFK602 / SFK0602 · unverified listing', 'SFE3210 · unverified listing'],
  );
  const sfe = ambiguous[1];
  assert.equal(sfe.parameters.shaftDiameter, 32);
  assert.equal(sfe.parameters.lead, 10);
  assert.match(sfe.note!, /No matching manufacturer dimension table/);
  for (const part of [screw, nut]) {
    const result = filterPresets(index, {
      ...emptyPresetFilters(part),
      query: 'SFE3210',
      kind: 'catalog',
    });
    assert.equal(result.items.length, 0);
    const example = filterPresets(index, {
      ...emptyPresetFilters(part),
      query: 'SFE3210',
      kind: 'examples',
    });
    assert.equal(example.items.length, 1);
    assert.equal(example.items[0].preset.catalog, undefined);
  }
});

test('counterbored flange variants preserve actual mounting dimensions and source verification', () => {
  const sfk = sfkReferences.find((r) => r.designation === 'SFK1004')!;
  assert.equal(sfk.parameters.mountCounterboreDiameter, 8);
  assert.equal(sfk.parameters.mountCounterboreDepth, 4.5);
  assert.equal(internalReturnReferences.filter((r) => r.parameters.family === 'SFI').length, 12);
  assert.equal(internalReturnReferences.filter((r) => r.parameters.family === 'DFI').length, 10);
  const sfi = internalReturnReferences.find((r) => r.designation === 'SFI1605-4')!;
  const dfi = internalReturnReferences.find((r) => r.designation === 'DFI8010-4')!;
  assert.deepEqual(
    ['mountHoleDiameter', 'mountCounterboreDiameter', 'mountCounterboreDepth', 'nutLength'].map(
      (key) => sfi.parameters[key],
    ),
    [4.5, 8, 4.5, 50],
  );
  assert.deepEqual(
    ['mountHoleDiameter', 'mountCounterboreDiameter', 'mountCounterboreDepth', 'nutLength'].map(
      (key) => dfi.parameters[key],
    ),
    [14, 20, 13, 182],
  );
  for (const reference of [sfk, ...internalReturnReferences]) {
    const p = reference.parameters;
    assert.ok(Number(p.mountCounterboreDiameter) > Number(p.mountHoleDiameter));
    assert.ok(Number(p.mountCounterboreDepth) < Number(p.flangeThickness));
    assert.ok(reference.catalog!.verifiedParameters.includes('mountCounterboreDiameter'));
    assert.ok(reference.catalog!.verifiedParameters.includes('mountCounterboreDepth'));
    if (reference !== sfk) {
      assert.equal(p.mountHoleCount, '6');
      assert.equal(p.flangeWidth, p.flangeDiameter);
    }
  }
});

test('source badges never verify editable end journals, accuracy classes or undocumented internal geometry', () => {
  const unverified = [
    'accuracy',
    'endMachining',
    'fixedJournalDiameter',
    'fixedJournalLength',
    'driveJournalDiameter',
    'driveJournalLength',
    'supportJournalDiameter',
    'supportJournalLength',
    'nutPosition',
    'rotation',
    'hand',
    'detail',
    'starts',
    'oilHoleDiameter',
  ];
  for (const part of [screw, nut])
    for (const preset of part.presets) {
      if (!preset.catalog) continue;
      const verified = preset.catalog.verifiedParameters;
      assert.equal(new Set(verified).size, verified.length);
      for (const key of verified)
        assert.notEqual(preset.parameters[key], undefined, `${preset.name}: ${key}`);
      for (const key of unverified)
        assert.ok(!verified.includes(key), `${preset.name}: ${key} must remain unsourced`);
      if (preset.parameters.family !== 'SFK') assert.ok(!verified.includes('length'));
    }
});

test('family and inclusive numeric ranges find real miniature presets at the selected shaft length', () => {
  const filters = emptyPresetFilters(screw);
  filters.kind = 'catalog';
  filters.parameters[id(screw, 'family')] = { value: 'SFK' };
  filters.parameters[id(screw, 'shaftDiameter')] = { min: '8', max: '10' };
  filters.parameters[id(screw, 'lead')] = { min: '2', max: '4' };
  filters.parameters[id(screw, 'length')] = { min: '350', max: '350' };
  const result = filterPresets(index, filters);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.items.map((r) => r.preset.catalog!.designation).sort(), [
    'SFK0802',
    'SFK082.5',
    'SFK1002',
    'SFK1004',
  ]);
  assert.ok(result.items.every((r) => r.part === screw && r.preset.parameters.length === 350));
  filters.parameters[id(screw, 'lead')] = { min: '2.5', max: '4' };
  assert.deepEqual(
    filterPresets(index, filters)
      .items.map((r) => r.preset.catalog!.designation)
      .sort(),
    ['SFK082.5', 'SFK1004'],
  );
});

test('SFS diameter filtering uses the measured table column rather than the nominal series digits', () => {
  const filters = emptyPresetFilters(nut);
  filters.kind = 'catalog';
  filters.parameters[id(nut, 'family')] = { value: 'SFS' };
  filters.parameters[id(nut, 'shaftDiameter')] = { min: '15', max: '15' };
  const result = filterPresets(index, filters);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.items.map((r) => r.preset.catalog!.designation).sort(), [
    'SFS1605-3.8',
    'SFS1610-2.8',
    'SFS1616-1.8',
    'SFS1620-1.8',
  ]);
  filters.parameters[id(nut, 'shaftDiameter')] = { min: '16', max: '16' };
  assert.equal(filterPresets(index, filters).items.length, 0);
});

test('standalone nuts hide shared assembly metadata from filters while preserving complete JSON configuration', () => {
  const assemblyKeys = [
    'length',
    'accuracy',
    'endMachining',
    'fixedJournalDiameter',
    'fixedJournalLength',
    'driveJournalDiameter',
    'driveJournalLength',
    'supportJournalDiameter',
    'supportJournalLength',
    'nutPosition',
    'rotation',
  ];
  const nutFields = getFilterFields([nut]);
  const screwFields = getFilterFields([screw]);
  const combinedFields = getFilterFields([nut, screw]);
  for (const key of assemblyKeys) {
    assert.ok(nut.parameters.some((field) => field.key === key && field.filterable === false));
    assert.ok(!nutFields.some((field) => field.key === key));
    assert.ok(screwFields.some((field) => field.key === key));
    assert.deepEqual(combinedFields.find((field) => field.key === key)!.partIds, [screw.id]);
  }
  for (const key of ['family', 'shaftDiameter', 'lead', 'nutLength', 'mountCircle', 'hand'])
    assert.ok(nutFields.some((field) => field.key === key));
  for (const preset of nut.presets) {
    const result = parseConfiguration(
      JSON.stringify({
        version: 1,
        units: 'mm',
        part: nut.id,
        state: 'assembled',
        parameters: preset.parameters,
      }),
      [nut, screw],
    );
    assert.deepEqual(result.parameters, preset.parameters);
    assert.equal(result.part, nut);
  }
});

test('irrelevant shaft metadata cannot make a standalone nut match text searches', () => {
  for (const query of ['C7', 'full length raceway']) {
    assert.equal(filterPresets(index, { ...emptyPresetFilters(nut), query }).items.length, 0);
    assert.ok(filterPresets(index, { ...emptyPresetFilters(screw), query }).items.length > 0);
  }
  const length = 123.456789;
  const selectedNut = {
    ...nut,
    presets: [
      {
        ...nut.presets[0],
        parameters: { ...nut.presets[0].parameters, fixedJournalLength: length },
      },
    ],
  };
  const selectedScrew = {
    ...screw,
    presets: [
      {
        ...screw.presets[0],
        parameters: { ...screw.presets[0].parameters, fixedJournalLength: length },
      },
    ],
  };
  const selectedIndex = buildPresetIndex([selectedNut, selectedScrew]);
  assert.deepEqual(
    filterPresets(selectedIndex, { ...emptyPresetFilters(), query: String(length) }).items.map(
      (entry) => entry.part.id,
    ),
    [screw.id],
  );
});
