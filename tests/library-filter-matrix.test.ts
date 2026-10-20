import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import { parts } from '../src/parts';
import { presetValue } from '../src/core/catalog-models';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
  getFilterFields,
  type PresetEntry,
  type ParameterFilter,
} from '../src/core/preset-search';
import type { ParameterDefinition, PartDefinition } from '../src/core/types';

function offeredValue(
  part: PartDefinition,
  field: ParameterDefinition,
  entry: PresetEntry,
): number | string | boolean | undefined {
  const { preset } = entry;
  const catalog = preset.catalog;
  const attribute = part.catalogFilterFields?.some((candidate) => candidate.key === field.key);
  if (
    !attribute &&
    field.visibleWhen &&
    !field.visibleWhen({ ...part.defaults, ...preset.parameters })
  )
    return undefined;
  const rawRange = catalog?.parameterRanges?.[field.key];
  if (rawRange !== undefined) {
    if (
      field.type !== 'number' ||
      typeof rawRange.min !== 'number' ||
      typeof rawRange.max !== 'number' ||
      !Number.isFinite(rawRange.min) ||
      !Number.isFinite(rawRange.max) ||
      rawRange.min > rawRange.max
    )
      return undefined;
    return rawRange.min / 2 + rawRange.max / 2;
  }
  const sourced =
    !catalog ||
    catalog.attributes?.[field.key] !== undefined ||
    (catalog.verifiedParameters.includes(field.key) && Object.hasOwn(preset.parameters, field.key));
  if (!sourced) return undefined;
  const value = presetValue(preset, field.key) ?? (!catalog ? part.defaults[field.key] : undefined);
  if (field.type === 'number')
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : undefined;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

test('every library model satisfies its own eligible filters while unpublished or inactive fields remain excluded', (t) => {
  const summary = {
    parts: parts.length,
    presets: parts.reduce((count, part) => count + part.presets.length, 0),
    sourceModels: 0,
    fields: 0,
    valueGroups: 0,
    ownModelChecks: 0,
    unknownModelChecks: 0,
    inclusiveRangeChecks: 0,
    numbers: 0,
    strings: 0,
    booleans: 0,
  };
  for (const part of parts) {
    const index = buildPresetIndex([part]);
    assert.deepEqual(
      index.map((entry) => entry.id),
      part.presets.map((preset) => `${part.id}:${preset.id}`),
      `${part.id}: every registered preset is covered`,
    );
    assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);
    summary.sourceModels += index.filter((entry) => entry.preset.catalog).length;
    for (const field of getFilterFields([part])) {
      summary.fields++;
      const id = fieldId(field);
      const groups = new Map<
        string,
        { value: number | string | boolean; entries: PresetEntry[] }
      >();
      const unknown: PresetEntry[] = [];
      for (const entry of index) {
        const value = offeredValue(part, field, entry);
        if (value === undefined) {
          unknown.push(entry);
          continue;
        }
        const key = JSON.stringify([typeof value, value]);
        const group = groups.get(key);
        if (group) group.entries.push(entry);
        else groups.set(key, { value, entries: [entry] });
      }
      assert.equal(
        [...groups.values()].reduce((count, group) => count + group.entries.length, unknown.length),
        index.length,
        `${part.id}/${field.key}: every model is classified for this field`,
      );
      for (const group of groups.values()) {
        const filter: ParameterFilter =
          typeof group.value === 'number'
            ? { min: String(group.value), max: String(group.value) }
            : { value: String(group.value) };
        const result = filterPresets(group.entries, {
          ...emptyPresetFilters(part),
          parameters: { [id]: filter },
        });
        assert.deepEqual(result.errors, [], `${part.id}/${field.key}: valid source choice`);
        assert.deepEqual(
          result.items.map((entry) => entry.id),
          group.entries.map((entry) => entry.id),
          `${part.id}/${field.key}/${String(group.value)}: exact source models`,
        );
        summary.valueGroups++;
        summary.ownModelChecks += group.entries.length;
        summary[
          typeof group.value === 'number'
            ? 'numbers'
            : typeof group.value === 'boolean'
              ? 'booleans'
              : 'strings'
        ] += group.entries.length;
      }
      const probe = groups.values().next().value as
        { value: number | string | boolean } | undefined;
      const request: ParameterFilter =
        field.type === 'number'
          ? { min: String(probe?.value ?? 0), max: String(probe?.value ?? 0) }
          : {
              value: String(
                probe?.value ?? (field.type === 'boolean' ? false : 'unpublished-source-value'),
              ),
            };
      const rejected = filterPresets(unknown, {
        ...emptyPresetFilters(part),
        parameters: { [id]: request },
      });
      assert.equal(
        rejected.items.length,
        0,
        `${part.id}/${field.key}: unknown/inactive values must not match`,
      );
      summary.unknownModelChecks += unknown.length;
      if (field.type === 'number' && groups.size) {
        const known = [...groups.values()].flatMap((group) => group.entries);
        const bounds = known.flatMap((entry) => {
          const range = entry.preset.catalog?.parameterRanges?.[field.key];
          return range ? [range.min, range.max] : [offeredValue(part, field, entry) as number];
        });
        const min = Math.min(...bounds),
          max = Math.max(...bounds);
        for (const request of [
          { min: String(min) },
          { max: String(max) },
          { min: String(min), max: String(max) },
        ]) {
          const result = filterPresets(known, {
            ...emptyPresetFilters(part),
            parameters: { [id]: request },
          });
          assert.equal(
            result.items.length,
            known.length,
            `${part.id}/${field.key}: inclusive/open source bounds`,
          );
          summary.inclusiveRangeChecks += known.length;
        }
      }
    }
  }
  assert.ok(summary.ownModelChecks > 0 && summary.unknownModelChecks > 0 && summary.booleans > 0);
  t.diagnostic(JSON.stringify(summary));
  if (process.env.FILTER_MATRIX_PROOF)
    writeFileSync(process.env.FILTER_MATRIX_PROOF, JSON.stringify(summary, null, 2) + '\n');
});
