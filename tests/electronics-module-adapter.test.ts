import assert from 'node:assert/strict';
import test from 'node:test';
import adapter from '../src/parts/electronics-module-adapter/part';
import { adapterShape } from '../src/parts/electronics-module-adapter/lib/model';
import { libraryArea } from '../src/core/library-navigation';
import { librarySections } from '../src/core/library';
import { translateSearchQuery } from '../src/core/search-query';
import mechanism from '../src/parts/servo-toggle-actuator/part';
import { configured } from '../src/parts/servo-toggle-actuator/lib/model';
import { parseDetailRecipe } from '../src/core/component-recipes';

test('module adapter family exposes independent ready fits and editable horizontal/upright templates', () => {
  assert.equal(libraryArea(adapter.category), 'electronics');
  assert.ok(
    librarySections.find((s) => s.name === adapter.category)?.groups.includes(adapter.subgroup),
  );
  assert.equal(adapter.product.kind, 'detail');
  assert.equal(adapter.product.supply, 'manufactured');
  assert.equal(adapter.presets.length, 9);
  assert.equal(new Set(adapter.presets.map((p) => p.parameters.model)).size, 9);
  for (const preset of adapter.presets)
    assert.deepEqual(
      adapter.validate({ ...adapter.defaults, ...preset.parameters }, 'default'),
      [],
      preset.id,
    );
  assert.equal(
    translateSearchQuery(
      '\u043f\u0435\u0440\u0435\u0445\u0456\u0434\u043d\u0438\u043a\u0438 \u0434\u043b\u044f \u043c\u043e\u0434\u0443\u043b\u0456\u0432',
    ),
    'adapter module',
  );
});

test('standalone fitted adapters export the same normalized shapes as the installed case parts', () => {
  const preset = mechanism.presets.find((p) => p.parameters.mechanism === 'case-panel')!;
  const installed = configured(
    { ...mechanism.defaults, ...preset.parameters, phase: 'off' },
    'assembled',
  );
  const fitted = adapter.presets.filter((p) => !String(p.parameters.model).startsWith('universal-'));
  assert.equal(fitted.length, 7);
  for (const fit of fitted) {
    const id = `case-electronics-${fit.parameters.model}-adapter`;
    const occurrence = installed.find((p) => p.component.id === id)!.component;
    assert.deepEqual(
      adapterShape({ ...adapter.defaults, ...fit.parameters }),
      parseDetailRecipe(String(occurrence.parameters.recipe)),
      id,
    );
  }
});

test('changing a PCB fit preserves M3 interface instead of scaling mounting features', () => {
  const a = adapterShape(adapter.defaults);
  const b = adapterShape({
    ...adapter.defaults,
    boardWidth: 64,
    boardDepth: 42,
    boardThickness: 2.1,
  });
  assert.notDeepEqual(a, b);
  const bores = (s: unknown): unknown[] => {
    if (!s || typeof s !== 'object') return [];
    const v = s as Record<string, unknown>;
    if (v.kind === 'cylinder' && v.radius === 1.7)
      return [{ radius: v.radius, axis: v.axis, xy: (v.origin as number[]).slice(0, 2) }];
    return Object.values(v).flatMap((value) =>
      Array.isArray(value) ? value.flatMap(bores) : bores(value),
    );
  };
  assert.deepEqual(bores(a), bores(b));
  assert.equal(bores(a).length, 4);
  const upright = adapter.updateParameters!(
    { ...adapter.defaults, model: 'universal-vertical' },
    'model',
  );
  assert.equal(upright.mountSpanY, 20);
  assert.equal(bores(adapterShape(upright)).length, 4);
});

test('unsupported grids and stale adapter models fail clearly', () => {
  for (const invalid of [
    { ...adapter.defaults, mountSpanX: 25 },
    { ...adapter.defaults, mountSpanY: 0 },
    { ...adapter.defaults, mountSpanY: 40 },
    { ...adapter.defaults, model: 'retired-adapter' },
    { ...adapter.defaults, model: 'hat', boardWidth: 40 },
    { ...adapter.defaults, seatHeight: Number.NaN },
    { ...adapter.defaults, model: 'universal-vertical', mountSpanY: 0 },
  ]) {
    assert.ok(adapter.validate(invalid, 'default').length);
    assert.throws(() => adapterShape(invalid));
  }
});
