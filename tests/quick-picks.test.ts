import test from 'node:test';
import assert from 'node:assert/strict';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import {
  closestQuickPick,
  initialQuickPickFilters,
  hasCatalogQuickSize,
  reconcileQuickPickFilters,
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
  assert.deepEqual(
    reconcileQuickPickFilters(
      independent,
      { diameter: 3, drive: 'hex-socket' },
      { diameter: '3', length: '8' },
    ),
    { diameter: '3' },
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
  assert.ok(!lengths.some((option) => option.value === '100'));
  let filters = { diameter: '2', length: '8' };
  assert.equal(quickPickMatches(bolt.presets, filters).length, 6);
  const countersunk = quickPickMatches(bolt.presets, { ...filters, head: 'countersunk' });
  assert.equal(countersunk.length, 2);
  const cross = quickPickMatches(bolt.presets, { ...filters, head: 'countersunk', drive: 'cross' });
  assert.equal(cross.length, 1);
  assert.equal(cross[0].catalog!.standard, 'DIN 965');
  assert.equal(cross[0].parameters.threadMode, 'modeled');
  assert.deepEqual(validateParameters(bolt, cross[0].parameters, 'default'), []);
});
test('changing an upstream size clears incompatible later choices and picks a complete valid preview', () => {
  const fields = quickPickFields(bolt);
  const before = { diameter: '6', length: '100', head: 'hex', drive: 'none' };
  const after = updateQuickPickFilters(fields, before, 0, '2');
  assert.deepEqual(after, { diameter: '2' });
  const candidates = quickPickMatches(bolt.presets, after);
  const picked = closestQuickPick(candidates, fields, bolt.defaults)!;
  assert.equal(picked.parameters.diameter, 2);
  assert.deepEqual(validateParameters(bolt, picked.parameters, 'default'), []);
  assert.ok(candidates.includes(picked));
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
  assert.deepEqual(initialQuickPickFilters(bolt, bolt.defaults), { diameter: '6' });
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
    options.map((option) => Number(option.value)),
    [100, 150, 200, 250, 300, 350, 400, 450, 500, 550],
  );
});
test('external selections reconcile stale filters while progressive choices remain unset', () => {
  const chosen = quickPickMatches(bolt.presets, { diameter: '8', length: '30', head: 'hex' })[0];
  assert.ok(chosen);
  const updated = reconcileQuickPickFilters(bolt, chosen.parameters, {
    diameter: '2',
    length: '8',
  });
  assert.equal(updated.diameter, '8');
  assert.equal(updated.length, '30');
  assert.ok(quickPickMatches(bolt.presets, updated).includes(chosen));
  assert.deepEqual(reconcileQuickPickFilters(bolt, chosen.parameters, { diameter: '8' }), {
    diameter: '8',
  });
  assert.deepEqual(reconcileQuickPickFilters(bolt, chosen.parameters, {}), {});
  assert.equal(hasCatalogQuickSize(bolt, chosen.parameters), true);
  assert.equal(hasCatalogQuickSize(bolt, { ...chosen.parameters, diameter: 6.3 }), false);
  assert.equal(hasCatalogQuickSize(bolt, { ...chosen.parameters, threadMode: 'envelope' }), true);
});
test('miniature pinion quick selectors expose the supplied tooth counts', () => {
  const gear = parts.find((part) => part.id === 'spur-gear')!;
  const fields = quickPickFields(gear);
  assert.deepEqual(
    fields.map((field) => field.key),
    ['module', 'teeth', 'bore'],
  );
  assert.deepEqual(
    quickPickOptions(gear.presets, fields, { module: '0.5' }, 1).map((option) => option.value),
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
  const filters = reconcileQuickPickFilters(screw, preset.parameters, {
    family: 'SFK',
    length: '100',
  });
  assert.equal(filters.family, 'SFU');
  assert.equal(filters.length, undefined);
  assert.ok(quickPickMatches(screw.presets, filters).includes(preset));
});
