import test from 'node:test';
import assert from 'node:assert/strict';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import {
  closestQuickPick,
  hasCatalogQuickSize,
  quickPickFields,
  quickPickLabel,
  quickPickMatches,
  quickPickOptions,
  updateQuickPickFilters,
} from '../src/core/quick-picks';

const bolt = parts.find((part) => part.id === 'bolt-screw')!;
test('catalog selectors come from each module and do not depend on its name or category', () => {
  const independent = {
    ...bolt,
    id: 'third-party-component',
    category: 'CUSTOM PARTS',
    subgroup: 'CUSTOM GROUP',
    catalogSelection: [
      { key: 'drive', label: 'Tool connection' },
      { key: 'diameter', label: 'Thread size', format: 'metric-thread' as const },
      { key: 'unknown' },
    ],
  };
  const fields = quickPickFields(independent);
  assert.deepEqual(
    fields.map((field) => field.key),
    ['drive', 'diameter'],
  );
  assert.equal(fields[0].label, 'Tool connection');
  assert.equal(fields[1].label, 'Thread size');
  assert.equal(quickPickLabel(fields[1], 3), 'M3');
  assert.deepEqual(quickPickFields({ ...independent, catalogSelection: [] }), []);
  assert.deepEqual(
    quickPickFields({
      ...independent,
      catalogSelection: undefined,
      presetMatchKeys: ['length'],
    }).map((field) => field.key),
    ['length'],
  );
});
test('M2 to length to head to drive narrows actual supplier listings without a dialog', () => {
  const fields = quickPickFields(bolt);
  assert.deepEqual(
    fields.map((field) => field.key),
    ['diameter', 'length', 'head', 'drive'],
  );
  assert.equal(quickPickLabel(fields[0], 2), 'M2');
  const lengths = quickPickOptions(bolt.presets, fields, { diameter: '2' }, 1);
  assert.ok(lengths.some((option) => option.value === '8' && option.count === 6));
  assert.equal(lengths.find((option) => option.value === '100')!.count, 0);
  let filters = { diameter: '2', length: '8' };
  assert.equal(quickPickMatches(bolt.presets, filters).length, 6);
  const countersunk = quickPickMatches(bolt.presets, { ...filters, head: 'countersunk' });
  assert.equal(countersunk.length, 2);
  const cross = quickPickMatches(bolt.presets, { ...filters, head: 'countersunk', drive: 'cross' });
  assert.equal(cross.length, 1);
  assert.equal(cross[0].catalog!.standard, 'DIN 965');
  assert.equal(cross[0].parameters.threadMode, 'envelope');
  assert.deepEqual(validateParameters(bolt, cross[0].parameters, 'default'), []);
});
test('changing a size preserves other manual filters and leaves incompatible combinations visible', () => {
  const fields = quickPickFields(bolt);
  const before = { diameter: '6', length: '100', head: 'hex', drive: 'none' };
  const after = updateQuickPickFilters(fields, before, 0, '2');
  assert.deepEqual(after, { diameter: '2', length: '100', head: 'hex', drive: 'none' });
  const candidates = quickPickMatches(bolt.presets, after);
  assert.equal(candidates.length, 0);
  assert.equal(closestQuickPick(candidates, fields, bolt.defaults), undefined);
  const cleared = updateQuickPickFilters(fields, after, 1, '');
  assert.deepEqual(cleared, { diameter: '2', head: 'hex', drive: 'none' });
  const requested = { diameter: '2', length: '8', head: 'countersunk', drive: 'cross' };
  const picked = closestQuickPick(
    quickPickMatches(bolt.presets, requested),
    fields,
    bolt.defaults,
  )!;
  assert.deepEqual(validateParameters(bolt, picked.parameters, 'default'), []);
  assert.equal(picked.parameters.length, 8);
});
test('quick options use sourced dimensions and keep example-only values out of supplier matches', () => {
  const fields = quickPickFields(bolt);
  const fake = {
    ...bolt.presets[0],
    id: 'test-example',
    parameters: { ...bolt.presets[0].parameters, diameter: 2, length: 123.45 },
    catalog: undefined,
  };
  assert.ok(
    !quickPickOptions([...bolt.presets, fake], fields, { diameter: '2' }, 1).some(
      (option) => option.value === '123.45',
    ),
  );
  assert.deepEqual(quickPickMatches([fake], {}), []);
  assert.deepEqual(
    quickPickMatches([...bolt.presets, fake], {}).map((preset) => preset.id),
    bolt.presets.filter((preset) => preset.catalog).map((preset) => preset.id),
  );
});
test('nuts and ball screws expose their natural standard size choices', () => {
  const nut = parts.find((part) => part.id === 'hex-nut')!;
  const screw = parts.find((part) => part.id === 'ball-screw')!;
  assert.deepEqual(
    quickPickFields(nut).map((field) => field.key),
    ['bore'],
  );
  assert.equal(quickPickLabel(quickPickFields(nut)[0], 3), 'M3');
  assert.deepEqual(
    quickPickFields(screw).map((field) => field.key),
    ['family', 'shaftDiameter', 'lead', 'length'],
  );
  const options = quickPickOptions(
    screw.presets,
    quickPickFields(screw),
    { family: 'SFK', shaftDiameter: '8', lead: '2' },
    3,
  );
  assert.deepEqual(
    options.filter((option) => option.count > 0).map((option) => Number(option.value)),
    [100, 150, 200, 250, 300, 350, 400, 450, 500, 550],
  );
});
test('catalog length alternatives stay available until an exact user choice requests a complete preview', () => {
  const chosen = quickPickMatches(bolt.presets, { diameter: '8', length: '30', head: 'hex' })[0];
  assert.ok(chosen);
  const fields = quickPickFields(bolt);
  const lengths = quickPickOptions(bolt.presets, fields, { diameter: '8' }, 1);
  assert.ok(lengths.some((option) => option.value === '30'));
  assert.ok(lengths.some((option) => option.value !== '30'));
  const requested = updateQuickPickFilters(fields, { diameter: '8' }, 1, '30');
  assert.deepEqual(requested, { diameter: '8', length: '30' });
  const candidates = quickPickMatches(bolt.presets, requested);
  const preview = closestQuickPick(candidates, fields, chosen.parameters)!;
  assert.equal(preview.parameters.diameter, 8);
  assert.equal(preview.parameters.length, 30);
  assert.deepEqual(validateParameters(bolt, preview.parameters, 'default'), []);
  assert.equal(hasCatalogQuickSize(bolt, chosen.parameters), true);
  assert.equal(hasCatalogQuickSize(bolt, { ...chosen.parameters, diameter: 6.3 }), false);
  assert.equal(hasCatalogQuickSize(bolt, { ...chosen.parameters, threadMode: 'envelope' }), true);
});

test('each catalog facet counts every other manual constraint and keeps a removable unavailable selection', () => {
  const fields = quickPickFields(bolt);
  const filters = { diameter: '2', length: '8', head: 'countersunk', drive: 'cross' };
  for (const [index, field] of fields.entries()) {
    const others = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== field.key));
    for (const option of quickPickOptions(bolt.presets, fields, filters, index))
      assert.equal(
        option.count,
        quickPickMatches(bolt.presets, { ...others, [field.key]: option.value }).length,
        `${field.key}/${option.value}`,
      );
  }
  const unavailable = quickPickOptions(
    bolt.presets,
    fields,
    { diameter: '2', length: '123.45' },
    1,
  );
  assert.deepEqual(
    unavailable.find((option) => option.value === '123.45'),
    { value: '123.45', label: '123.45 mm', count: 0 },
  );
  const searched = quickPickMatches(bolt.presets, { diameter: '2', length: '8' });
  const queryOptions = quickPickOptions(bolt.presets, fields, {}, 1, searched);
  assert.equal(queryOptions.find((option) => option.value === '8')!.count, 6);
  assert.equal(queryOptions.find((option) => option.value === '100')!.count, 0);
  assert.ok(queryOptions.every((option) => option.value === '8' || option.count === 0));
});
test('miniature pinion quick selectors expose the supplied tooth counts', () => {
  const gear = parts.find((part) => part.id === 'spur-gear')!;
  const fields = quickPickFields(gear);
  assert.deepEqual(
    fields.map((field) => field.key),
    ['module', 'teeth', 'bore'],
  );
  assert.deepEqual(
    quickPickOptions(gear.presets, fields, { module: '0.5' }, 1)
      .filter((option) => option.count > 0)
      .map((option) => option.value),
    ['11', '13', '15', '17'],
  );
});
test('sourced ball screws keep catalog mode when assembly length is a prototype setting', () => {
  const screw = parts.find((part) => part.id === 'ball-screw')!;
  const preset = screw.presets.find(
    (preset) =>
      preset.catalog &&
      preset.parameters.family === 'SFU' &&
      !preset.catalog.verifiedParameters.includes('length'),
  )!;
  assert.ok(preset);
  assert.equal(hasCatalogQuickSize(screw, preset.parameters), true);
  assert.ok(quickPickMatches(screw.presets, { family: 'SFU' }).includes(preset));
  assert.ok(
    !quickPickMatches(screw.presets, {
      family: 'SFU',
      length: String(preset.parameters.length),
    }).includes(preset),
    'A prototype shaft length must not satisfy an explicit source-length filter',
  );
});

test('the selected DIN 915 reference retains its own source scope beside equal-size stock screws', () => {
  const screw = parts.find((part) => part.id === 'set-screw')!;
  const chosen = screw.presets.find((preset) => preset.id === 'reference-din915-m6')!;
  assert.ok(
    screw.presets.some(
      (preset) =>
        preset.id !== chosen.id &&
        preset.parameters.diameter === 6 &&
        preset.parameters.length === 16 &&
        preset.parameters.tip === 'dog',
    ),
  );
  assert.ok(quickPickMatches(screw.presets, { diameter: '6', tip: 'dog' }).includes(chosen));
  const exact = quickPickMatches(screw.presets, { diameter: '6', length: '16', tip: 'dog' });
  assert.ok(!exact.includes(chosen), 'The reference prototype length is not a supplier dimension');
  assert.ok(
    exact.some(
      (preset) =>
        preset.parameters.length === 16 && preset.catalog!.verifiedParameters.includes('length'),
    ),
    'Explicit length selection still finds real equal-size stock screws',
  );
});
