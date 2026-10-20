import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parts } from '../src/parts';
import {
  filterProductLibrary,
  groupProductLibrary,
  specificationSection,
  validateProductProfile,
} from '../src/core/product-library';
import type { ProductProfile } from '../src/core/product-types';

const part = (id: string) => {
  const result = parts.find((entry) => entry.id === id);
  assert.ok(result, `Missing library family ${id}.`);
  return result;
};

test('every registered family owns a valid product classification and release requirements', async () => {
  for (const definition of parts) {
    const profile = JSON.parse(
      await readFile(
        new URL(`../src/parts/${definition.id}/product.json`, import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual(validateProductProfile(profile), [], definition.id);
    assert.deepEqual(definition.product, profile, `${definition.id}: package owns its profile`);
    assert.notEqual(profile.description.trim(), '');
  }
});

test('reference size tables and functional envelopes do not silently become purchasable products', () => {
  assert.ok(part('thread-tool').presets.every((preset) => preset.catalog));
  assert.equal(part('thread-tool').product.kind, 'reference');
  assert.equal(part('thread-tool').product.supply, 'reference');
  for (const id of ['fluid-cylinder', 'fluid-valve', 'industrial-motor', 'industrial-sensor']) {
    assert.equal(part(id).product.kind, 'reference', id);
    assert.equal(part(id).product.supply, 'reference', id);
    assert.throws(() => specificationSection(part(id)), /Resolve engineering references/);
  }
  assert.equal(part('linear-guide').product.supply, 'purchased');
  assert.notEqual(part('linear-guide').product.supply, 'standard');
  assert.equal(part('bevel-gear-pair').product.kind, 'assembly');
  assert.equal(part('bevel-gear-pair').product.supply, 'manufactured');
});

test('purchased assembly internals remain supplier units while own mechanisms require assembly routes', () => {
  for (const id of ['ball-bearing', 'faulhaber-planetary', 'stepper-motor']) {
    assert.equal(part(id).product.kind, 'assembly');
    assert.equal(part(id).product.supply, 'purchased');
    assert.deepEqual(part(id).product.processes, []);
    assert.equal(specificationSection(part(id)), 'other-products');
  }
  for (const id of [
    'automatic-band-saw',
    'automatic-tube-saw',
    'rocket-release',
    'ball-screw-axis',
  ]) {
    assert.equal(part(id).product.kind, 'assembly');
    assert.equal(part(id).product.supply, 'manufactured');
    assert.ok(part(id).product.processes.includes('assembly'));
    assert.equal(specificationSection(part(id)), 'assemblies');
  }
  assert.ok(part('shaft').product.processes.includes('turning'));
  assert.ok(part('sheet-bracket').product.processes.includes('bending'));
  assert.ok(part('compression-spring').product.processes.includes('winding'));
});

test('specification sections follow configured supply and retain stock in the materials section', () => {
  assert.equal(specificationSection(part('bolt-screw')), 'standard-products');
  assert.equal(specificationSection(part('shaft')), 'details');
  assert.equal(specificationSection(part('shaft'), 'purchased'), 'other-products');
  assert.equal(specificationSection(part('shaft'), 'standard'), 'standard-products');
  assert.equal(specificationSection(part('aluminium-profile')), 'materials');
  assert.equal(specificationSection(part('aluminium-profile'), 'standard'), 'materials');
  const complex: ProductProfile = {
    kind: 'complex',
    supply: 'manufactured',
    description: 'Separate interconnected equipment.',
    processes: ['assembly'],
    releaseRequirements: ['Verify all equipment interfaces.'],
  };
  assert.equal(specificationSection(complex), 'complexes');
  assert.equal(specificationSection({ ...complex, kind: 'kit' }), 'kits');
  assert.throws(() => specificationSection(complex, 'reference'), /Resolve engineering references/);
});

test('engineering, product and supply views cover every family exactly once in stable order', () => {
  for (const view of ['engineering', 'product-kind', 'supply'] as const) {
    const groups = groupProductLibrary(parts, view);
    const ids = groups.flatMap((group) => group.parts.map((entry) => entry.id));
    assert.equal(ids.length, parts.length, view);
    assert.equal(new Set(ids).size, parts.length, view);
    assert.deepEqual(groupProductLibrary([...parts].reverse(), view), groups);
    for (const group of groups) assert.ok(group.parts.length);
  }
});

test('process filtering intersects product type and supply without inventing routes for suppliers', () => {
  const filtered = filterProductLibrary(parts, {
    kind: 'detail',
    supply: 'manufactured',
    process: 'turning',
  });
  assert.ok(filtered.some((entry) => entry.id === 'shaft'));
  assert.ok(filtered.every((entry) => entry.product.kind === 'detail'));
  assert.ok(filtered.every((entry) => entry.product.supply === 'manufactured'));
  assert.ok(filtered.every((entry) => entry.product.processes.includes('turning')));
  assert.deepEqual(
    filtered,
    filterProductLibrary([...parts].reverse(), {
      kind: 'detail',
      supply: 'manufactured',
      process: 'turning',
    }),
  );
  const groups = groupProductLibrary(parts, 'process');
  assert.equal(
    new Set(groups.flatMap((group) => group.parts.map((entry) => entry.id))).size,
    parts.length,
  );
  const supplier = part('faulhaber-planetary');
  assert.ok(groups.find((group) => group.id === 'no-process')?.parts.includes(supplier));
  assert.ok(!groups.find((group) => group.id === 'assembly')?.parts.includes(supplier));
  assert.ok(groups.find((group) => group.id === 'turning')?.parts.includes(part('shaft')));
  assert.ok(groups.find((group) => group.id === 'milling')?.parts.includes(part('shaft')));
});

test('portable profiles reject unknown classifications, duplicate routes and incomplete manufacturing policy', () => {
  const valid = part('shaft').product;
  assert.ok(validateProductProfile(undefined).length);
  assert.ok(validateProductProfile({ ...valid, kind: 'dimensioned-shape' }).length);
  assert.ok(validateProductProfile({ ...valid, supply: 'supplier-looking' }).length);
  assert.ok(validateProductProfile({ ...valid, description: ' ' }).length);
  assert.ok(validateProductProfile({ ...valid, processes: [] }).length);
  assert.ok(validateProductProfile({ ...valid, processes: ['turning', 'turning'] }).length);
  assert.ok(validateProductProfile({ ...valid, processes: ['laser-wish'] }).length);
  assert.ok(validateProductProfile({ ...valid, releaseRequirements: [] }).length);
  assert.ok(validateProductProfile({ ...valid, releaseRequirements: [' ', ' '] }).length);
  assert.ok(validateProductProfile({ ...valid, kind: 'reference' }).length);
  assert.ok(validateProductProfile({ ...valid, supply: 'reference' }).length);
});
