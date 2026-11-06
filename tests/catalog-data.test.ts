import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import { buildPresetIndex, filterPresets, seedCurrentFilters } from '../src/core/preset-search';
import { affectedParts } from './helpers/part-scope';

test('matching a sourced preset can find the same preset again', () => {
  for (const part of affectedParts(parts)) {
    const index = buildPresetIndex([part]);
    for (const preset of part.presets.filter((preset) => preset.catalog)) {
      const result = filterPresets(index, seedCurrentFilters(part, preset.parameters));
      assert.ok(
        result.items.some((entry) => entry.part.id === part.id && entry.preset.id === preset.id),
        `${part.id}/${preset.id}: current matching must not demand unsourced internal dimensions`,
      );
    }
  }
});

test('sourced presets have auditable dimensions and complete valid configurations', () => {
  let count = 0;
  for (const part of parts) {
    const keys = new Set(part.parameters.map((field) => field.key));
    for (const key of part.presetMatchKeys ?? []) assert.ok(keys.has(key), `${part.id}: ${key}`);
    for (const preset of part.presets) {
      if (!preset.catalog) continue;
      count++;
      const { catalog } = preset;
      if (catalog.sourceUrl && /^\/?references\//.test(catalog.sourceUrl)) {
        assert.equal(
          catalog.sourceKind,
          'attachment',
          `${part.id}/${preset.id}: local source evidence`,
        );
        assert.ok(
          !catalog.sourceUrl.split('/').includes('..'),
          'Reference paths stay within public assets.',
        );
        assert.ok(
          existsSync(path.resolve('public', catalog.sourceUrl.replace(/^\//, ''))),
          `${part.id}/${preset.id}: bundled source must exist`,
        );
      } else if (catalog.sourceUrl) assert.equal(new URL(catalog.sourceUrl).protocol, 'https:');
      else
        assert.equal(
          catalog.sourceKind,
          'attachment',
          'Only supplied references may lack a public URL.',
        );
      assert.ok(catalog.designation && catalog.sourceName);
      assert.ok(catalog.verifiedParameters.length > 0);
      assert.equal(new Set(catalog.verifiedParameters).size, catalog.verifiedParameters.length);
      for (const key of catalog.verifiedParameters) {
        assert.ok(keys.has(key), `${part.id}/${preset.id}: unknown sourced key ${key}`);
        assert.notEqual(preset.parameters[key], undefined);
      }
      const states = part.states
        ?.filter((state) => !state.availableWhen || state.availableWhen(preset.parameters))
        .map((state) => state.id) ?? ['default'];
      assert.ok(states.length, `${part.id}/${preset.id}: an available state is required`);
      for (const key of Object.keys(preset.parameters))
        assert.ok(keys.has(key), `${part.id}/${preset.id}: unknown parameter ${key}`);
      for (const state of states) {
        for (const field of part.parameters) {
          const optional =
            field.optionalWhenHidden &&
            field.visibleWhen &&
            !field.visibleWhen(preset.parameters, state);
          if (!optional)
            assert.ok(
              Object.hasOwn(preset.parameters, field.key),
              `${part.id}/${preset.id}/${state}: missing parameter ${field.key}`,
            );
        }
        assert.deepEqual(validateParameters(part, preset.parameters, state), []);
      }
    }
  }
  assert.ok(count >= 3500, 'The supplier catalog must retain the full imported geometry range.');
  // Preserve the imported supplier families without imposing that supplier on
  // later additions sourced from other manufacturers (e.g. IKO eccentric rollers).
  const importedBearingIds = [
    'ball-bearing',
    'self-aligning-bearing',
    'angular-contact-bearing',
    'double-row-bearing',
    'double-row-angular-contact-bearing',
    'roller-bearing',
    'spherical-roller-bearing',
    'tapered-roller-bearing',
    'needle-bearing',
    'thrust-bearing',
    'flange-2-bolt-bearing',
    'flange-4-bolt-bearing',
    'pillow-block-bearing',
    'insert-bearing',
    'thrust-roller-bearing',
    'spherical-thrust-bearing',
    'combined-bearing',
    'zarn-bearing',
    'plain-bearing',
    'adapter-sleeve',
    'radial-oil-seal',
  ];
  for (const id of importedBearingIds) {
    const part = parts.find((part) => part.id === id);
    assert.ok(part, `${id}: imported bearing family must remain registered`);
    assert.equal(part.category, 'BEARINGS & SEALS');
    assert.ok(
      part.presets.some((preset) => preset.catalog?.sourceName === 'Promtehimport'),
      `${part.id}: each requested bearing family has supplier presets`,
    );
  }
});

test('FreeCAD source metadata follows an exact sourced configuration and clears after edits', () => {
  const part = parts.find((part) => part.id === 'hex-nut')!;
  const preset = part.presets.find((preset) => preset.catalog)!;
  const script = generateScript(part, preset.parameters, 'default');
  assert.ok(
    script.includes('obj.CatalogDesignation = ' + JSON.stringify(preset.catalog!.designation)),
  );
  assert.ok(script.includes('obj.CatalogSource = ' + JSON.stringify(preset.catalog!.sourceUrl)));
  assert.ok(script.includes('obj.CatalogDimensions'));
  assert.ok(
    !generateScript(
      part,
      { ...preset.parameters, height: Number(preset.parameters.height) + 0.1 },
      'default',
    ).includes('obj.CatalogSource'),
  );
});
