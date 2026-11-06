import assert from 'node:assert/strict';
import test from 'node:test';
import { searchableFields } from '../src/core/catalog-models';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  getFilterFields,
} from '../src/core/preset-search';
import axis from '../src/parts/ball-screw-axis/part';
import leadScrew from '../src/parts/lead-screw-axis/part';
import linearActuator from '../src/parts/linear-actuator/part';
import toggle from '../src/parts/servo-toggle-actuator/part';
import worm from '../src/parts/worm-fin-actuator/part';

test('guided screw axis names identify the exact screw and both guide rails', () => {
  assert.match(axis.name, /axis.*dual profile guides/i);
  assert.doesNotMatch(axis.name, /motor/i);
  for (const preset of axis.presets) {
    assert.ok(preset.name.includes(String(preset.parameters.screwSize)), preset.id);
    assert.ok(
      preset.name.includes(`2× ${String(preset.parameters.guideSize).toUpperCase()}`),
      preset.id,
    );
    assert.ok(preset.name.includes(`${preset.parameters.length} mm axis`), preset.id);
  }
  const index = buildPresetIndex([axis]);
  const fields = getFilterFields([axis]);
  const guideField = fields.find((field) => field.key === 'guideSize')!;
  const lengthField = fields.find((field) => field.key === 'length')!;
  assert.deepEqual(
    filterPresets(index, {
      ...emptyPresetFilters(axis),
      parameters: {
        [guideField.id]: { value: 'mgn15h' },
        [lengthField.id]: { min: '500', max: '500' },
      },
    }).items.map((item) => item.preset.id),
    ['long', 'large'],
  );
});

test('screw, motor housing and worm-sector variants retain their physical distinctions in search', () => {
  for (const preset of leadScrew.presets) {
    assert.match(preset.name, /screw and flange nut/i);
    assert.ok(preset.name.includes(`lead ${preset.parameters.pitch} mm`), preset.id);
  }
  for (const preset of linearActuator.presets) {
    assert.ok(preset.name.includes(`${preset.parameters.stroke} mm stroke`), preset.id);
    assert.ok(preset.name.includes(`Ø${preset.parameters.rod} mm rod`), preset.id);
  }
  for (const preset of worm.presets) {
    assert.ok(preset.name.includes('TR8×8(P2)'), preset.id);
    assert.ok(preset.name.includes(String(preset.parameters.frontBearing)), preset.id);
    assert.ok(preset.name.includes(`±${Number(preset.parameters.travel) / 2}°`), preset.id);
  }
  const matches = filterPresets(buildPresetIndex([toggle]), {
    ...emptyPresetFilters(toggle),
    query: 'ST3215 ASW-07D',
  }).items;
  assert.equal(matches.length, toggle.presets.length);
  for (const { preset } of matches) assert.match(preset.name, /ST3215 \/ ASW-07D/);
});

test('assembly selection exposes static characteristics and excludes inspection poses', () => {
  for (const [part, poses, summaries] of [
    [axis, ['position', 'detail'], ['screwSize', 'guideSize', 'length']],
    [leadScrew, ['position', 'turns'], ['form', 'diameter', 'length', 'pitch']],
    [linearActuator, ['extension'], ['diameter', 'bodyLength', 'rod', 'stroke']],
    [toggle, ['phase', 'manualState'], ['mechanism', 'baseLength', 'baseWidth']],
    [worm, ['outputAngle'], ['frontBearing', 'wormBearing', 'travel']],
  ] as const) {
    const fields = searchableFields(part);
    for (const key of poses)
      assert.ok(!fields.some((field) => field.key === key), `${part.id}/${key}`);
    for (const key of summaries)
      assert.ok(
        fields.some((field) => field.key === key && field.catalogSummary),
        `${part.id}/${key}`,
      );
  }
});
